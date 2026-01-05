// ATS Tailored CV & Cover Letter - Popup Script
// Uses same approach as chrome-extension for reliable job detection

const SUPABASE_URL = 'https://wntpldomgjutwufphnpg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndudHBsZG9tZ2p1dHd1ZnBobnBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2MDY0NDAsImV4cCI6MjA4MjE4MjQ0MH0.vOXBQIg6jghsAby2MA1GfE-MNTRZ9Ny1W2kfUHGUzNM';

// Supported ATS platforms (excluding Lever and Ashby)
const SUPPORTED_HOSTS = [
  'greenhouse.io',
  'job-boards.greenhouse.io',
  'boards.greenhouse.io',
  'workday.com',
  'myworkdayjobs.com',
  'smartrecruiters.com',
  'bullhornstaffing.com',
  'bullhorn.com',
  'teamtailor.com',
  'workable.com',
  'apply.workable.com',
  'icims.com',
  'oracle.com',
  'oraclecloud.com',
  'taleo.net',
];

// Performance constants
const MAX_JD_LENGTH = 10000; // Limit JD to 10k chars for faster processing
const CACHE_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

class ATSTailor {
  constructor() {
    this.session = null;
    this.currentJob = null;
    this.generatedDocuments = { 
      cv: null, 
      coverLetter: null, 
      cvPdf: null, 
      coverPdf: null, 
      cvFileName: null, 
      coverFileName: null,
      matchScore: 0,
      matchedKeywords: [],
      missingKeywords: [],
      keywords: null
    };
    this.stats = { today: 0, total: 0, avgTime: 0, times: [] };
    this.currentPreviewTab = 'cv';
    this.autoTailorEnabled = true;
    
    // Performance: Caches for JD text and keywords per job URL
    this.jdCache = new Map(); // url -> { jd, timestamp }
    this.keywordCache = new Map(); // url -> { keywords, timestamp }
    
    // Keyword coverage report (diffs original CV vs boosted CV)
    this._coverageOriginalCV = '';
    this._defaultLocation = 'Dublin, IE';  // Will be loaded from storage
    
    // DOM element references (query once, reuse)
    this._domRefs = {};

    this.init();
  }

  // Cache DOM references for performance
  getDomRef(id) {
    if (!this._domRefs[id]) {
      this._domRefs[id] = document.getElementById(id);
    }
    return this._domRefs[id];
  }

  async init() {
    await this.loadSession();
    this.bindEvents();
    this.updateUI();

    // Auto-detect job when popup opens (but do NOT auto-tailor)
    if (this.session) {
      await this.refreshSessionIfNeeded();
      await this.detectCurrentJob();
    }
  }

  async refreshSessionIfNeeded() {
    try {
      if (!this.session?.refresh_token || !this.session?.access_token) return;

      const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${this.session.access_token}`,
        },
      });

      if (res.ok) return;

      const refreshRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ refresh_token: this.session.refresh_token }),
      });

      if (!refreshRes.ok) {
        console.warn('[ATS Tailor] refresh failed; clearing session');
        this.session = null;
        await chrome.storage.local.remove(['ats_session']);
        this.updateUI();
        return;
      }

      const data = await refreshRes.json();
      this.session = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        user: data.user || this.session.user,
      };
      await this.saveSession();
    } catch (e) {
      console.warn('[ATS Tailor] refreshSessionIfNeeded error', e);
    }
  }

  async loadSession() {
    return new Promise((resolve) => {
      chrome.storage.local.get(
        ['ats_session', 'ats_stats', 'ats_todayDate', 'ats_autoTailorEnabled', 'ats_lastGeneratedDocuments', 'ats_lastJob', 'ats_defaultLocation'],
        (result) => {
          this.session = result.ats_session || null;
          this.autoTailorEnabled = typeof result.ats_autoTailorEnabled === 'boolean' ? result.ats_autoTailorEnabled : true;
          
          // Load default location for Remote jobs
          this._defaultLocation = result.ats_defaultLocation || 'Dublin, IE';

          // Restore last job/documents for preview continuity
          this.currentJob = result.ats_lastJob || this.currentJob;
          if (result.ats_lastGeneratedDocuments) {
            this.generatedDocuments = { ...this.generatedDocuments, ...result.ats_lastGeneratedDocuments };
          }

          if (result.ats_stats) {
            this.stats = result.ats_stats;
          }

          const today = new Date().toDateString();
          if (result.ats_todayDate !== today) {
            this.stats.today = 0;
            chrome.storage.local.set({ ats_todayDate: today });
          }

          resolve();
        }
      );
    });
  }

  async saveSession() {
    await chrome.storage.local.set({ ats_session: this.session });
  }

  async saveStats() {
    await chrome.storage.local.set({
      ats_stats: this.stats,
      ats_todayDate: new Date().toDateString()
    });
  }

  bindEvents() {
    document.getElementById('loginBtn')?.addEventListener('click', () => this.login());
    document.getElementById('logoutBtn')?.addEventListener('click', () => this.logout());
    document.getElementById('tailorBtn')?.addEventListener('click', () => this.tailorDocuments({ force: true }));
    document.getElementById('refreshJob')?.addEventListener('click', () => this.detectCurrentJob());
    document.getElementById('downloadCv')?.addEventListener('click', () => this.downloadDocument('cv'));
    document.getElementById('downloadCover')?.addEventListener('click', () => this.downloadDocument('cover'));
    document.getElementById('attachBoth')?.addEventListener('click', () => this.attachBothDocuments());
    document.getElementById('copyContent')?.addEventListener('click', () => this.copyCurrentContent());
    document.getElementById('copyCoverageBtn')?.addEventListener('click', () => this.copyCoverageReport());
    
    // NEW: Text download buttons
    document.getElementById('downloadCvText')?.addEventListener('click', () => this.downloadTextVersion('cv'));
    document.getElementById('downloadCoverText')?.addEventListener('click', () => this.downloadTextVersion('cover'));

    // Bulk Apply Dashboard
    document.getElementById('openBulkApply')?.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('bulk-apply.html') });
    });
    document.getElementById('autoTailorToggle')?.addEventListener('change', (e) => {
      const enabled = !!e.target?.checked;
      this.autoTailorEnabled = enabled;
      chrome.storage.local.set({ ats_autoTailorEnabled: enabled });
      this.showToast(enabled ? 'Auto tailor enabled' : 'Auto tailor disabled', 'success');
    });
    
    // View Extracted Keywords Button (fast local extraction)
    document.getElementById('viewKeywordsBtn')?.addEventListener('click', () => this.viewExtractedKeywords());
    
    // AI Extract Keywords Button (GPT-4o-mini powered)
    document.getElementById('aiExtractBtn')?.addEventListener('click', () => this.aiExtractKeywords());
    
    // Skill Gap Analysis Button
    document.getElementById('skillGapBtn')?.addEventListener('click', () => this.showSkillGapPanel());
    document.getElementById('closeSkillGap')?.addEventListener('click', () => this.hideSkillGapPanel());

    // Workday Full Flow
    document.getElementById('runWorkdayFlow')?.addEventListener('click', () => this.runWorkdayFlow());
    document.getElementById('workdayAutoToggle')?.addEventListener('change', (e) => {
      const enabled = !!e.target?.checked;
      chrome.storage.local.set({ workday_auto_enabled: enabled });
      this.showToast(enabled ? 'Workday automation enabled' : 'Workday automation disabled', 'success');
    });
    document.getElementById('saveWorkdayCreds')?.addEventListener('click', () => this.saveWorkdayCredentials());
    
    // Default location setting for Remote jobs
    document.getElementById('saveLocationBtn')?.addEventListener('click', () => this.saveDefaultLocation());
    document.getElementById('defaultLocationInput')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.saveDefaultLocation();
    });
    
    // Load Workday settings and location settings
    this.loadWorkdaySettings();
    this.loadLocationSettings();

    // Preview tabs
    document.getElementById('previewCvTab')?.addEventListener('click', () => this.switchPreviewTab('cv'));
    document.getElementById('previewCoverTab')?.addEventListener('click', () => this.switchPreviewTab('cover'));
    document.getElementById('previewTextTab')?.addEventListener('click', () => this.switchPreviewTab('text'));

    // Enter key for login
    document.getElementById('password')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.login();
    });
    
    // Listen for runtime messages to trigger Extract & Apply Keywords button
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'TRIGGER_EXTRACT_APPLY' || message.action === 'POPUP_TRIGGER_EXTRACT_APPLY') {
        console.log('[ATS Tailor Popup] Received trigger message:', message.action, 'with animation:', message.showButtonAnimation);
        this.triggerExtractApplyWithUI(message.jobInfo, message.showButtonAnimation !== false);
        sendResponse({ status: 'triggered' });
        return true;
      }
    });
    
    // Check for pending automation trigger on popup open
    this.checkPendingAutomationTrigger();
  }
  
  // NEW: Download text version of CV/Cover Letter
  downloadTextVersion(type) {
    const content = type === 'cv' ? this.generatedDocuments.cv : this.generatedDocuments.coverLetter;
    if (!content) {
      this.showToast(`No ${type === 'cv' ? 'CV' : 'Cover Letter'} content to download`, 'error');
      return;
    }
    
    const fileName = type === 'cv' 
      ? (this.generatedDocuments.cvFileName || 'Resume').replace('.pdf', '') + '.txt'
      : (this.generatedDocuments.coverFileName || 'Cover_Letter').replace('.pdf', '') + '.txt';
    
    // Use ResumeBuilder if available
    if (typeof ResumeBuilder !== 'undefined' && ResumeBuilder.downloadTextVersion) {
      ResumeBuilder.downloadTextVersion(content, fileName);
    } else {
      // Fallback
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
    
    this.showToast(`Downloaded ${fileName}`, 'success');
  }
  
  /**
   * Check for pending automation trigger when popup opens
   * If automation triggered while popup was closed, execute it now
   */
  async checkPendingAutomationTrigger() {
    const result = await new Promise(resolve => {
      chrome.storage.local.get(['pending_extract_apply'], resolve);
    });

    if (result.pending_extract_apply?.triggeredFromAutomation) {
      const pendingTrigger = result.pending_extract_apply;
      const age = Date.now() - (pendingTrigger.timestamp || 0);

      // Only process if trigger is recent (within 30 seconds)
      if (age < 30000) {
        console.log('[ATS Tailor Popup] Found pending automation trigger, executing...');

        // Clear the pending trigger first (prevents double-runs)
        await chrome.storage.local.remove(['pending_extract_apply']);

        // Trigger immediately (visible button animation)
        requestAnimationFrame(() => {
          this.triggerExtractApplyWithUI(pendingTrigger.jobInfo, true);
        });
      } else {
        // Clear stale trigger
        await chrome.storage.local.remove(['pending_extract_apply']);
      }
    }
  }
  
  /**
   * Trigger Extract & Apply Keywords button with visible pressed/loading state
   * ULTRA-FAST 50ms SINGLE-STEP: Uses INSTANT_TAILOR_ATTACH for cache-first speed
   */
  async triggerExtractApplyWithUI(jobInfo, showAnimation = true) {
    const btn = document.getElementById('tailorBtn');
    if (!btn) {
      console.warn('[ATS Tailor Popup] tailorBtn not found');
      return;
    }
    
    const startTime = performance.now();
    
    // Show pressed/loading state with VISIBLE animation
    if (showAnimation) {
      btn.classList.add('pressed', 'loading', 'btn-animating');
      btn.disabled = true;
      
      // Animate the button press visually
      btn.style.transform = 'scale(0.95)';
      btn.style.boxShadow = 'inset 0 4px 12px rgba(0,0,0,0.4)';
      btn.style.background = 'linear-gradient(135deg, #ff6b35, #f7931e)';
      btn.style.transition = 'all 0.15s ease-in-out';
      
      // Flash effect
      setTimeout(() => {
        btn.style.transform = 'scale(0.98)';
        btn.style.boxShadow = 'inset 0 2px 8px rgba(0,0,0,0.3), 0 0 20px rgba(247, 147, 30, 0.5)';
      }, 100);
    }
    
    const btnText = btn.querySelector('.btn-text');
    const btnIcon = btn.querySelector('.btn-icon');
    const originalText = btnText?.textContent || 'Extract & Apply Keywords to CV';
    const originalIcon = btnIcon?.textContent || '🚀';
    
    if (btnText) {
      btnText.textContent = '⚡ 50ms Processing...';
    }
    if (btnIcon) {
      btnIcon.textContent = '⏳';
      btnIcon.style.animation = 'spin 1s linear infinite';
    }
    
    // If jobInfo provided, update current job
    if (jobInfo) {
      this.currentJob = jobInfo;
      this.updateJobDisplay();
    }
    
    try {
      // ============ ULTRA-FAST: Send INSTANT_TAILOR_ATTACH to content.js ============
      // This uses cached PDFs for ~25ms or runs turbo pipeline for ~50ms
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tab?.id) {
        const response = await chrome.tabs.sendMessage(tab.id, {
          action: 'INSTANT_TAILOR_ATTACH',
          jobUrl: tab.url || window.location.href,
          showTimer: true
        });
        
        const elapsed = Math.round(performance.now() - startTime);
        
        if (response?.status === 'attached') {
          console.log(`[ATS Tailor Popup] ⚡ INSTANT attach complete in ${response.timing}ms (cached: ${response.cached})`);
          
          // Success animation
          if (showAnimation) {
            btn.style.background = 'linear-gradient(135deg, #00c853, #69f0ae)';
            btn.style.transform = 'scale(1.02)';
            btn.style.boxShadow = '0 4px 20px rgba(0, 200, 83, 0.4)';
            if (btnIcon) btnIcon.textContent = '✅';
            if (btnText) btnText.textContent = `✅ ${response.timing}ms${response.cached ? ' (cached)' : ''}`;
          }
          
          this.showToast(`Attached in ${response.timing}ms!`, 'success');
        } else if (response?.status === 'pending') {
          // Full tailor running in background
          if (btnText) btnText.textContent = '⚡ Generating...';
          // Fall through to legacy tailorDocuments
          await this.tailorDocuments({ force: true });
        } else {
          throw new Error(response?.error || 'Unknown error');
        }
      } else {
        // No active tab - fall back to legacy flow
        await this.tailorDocuments({ force: true });
      }
      
      // Notify background that extraction is complete
      chrome.runtime.sendMessage({ action: 'EXTRACT_APPLY_COMPLETE' }).catch(() => {});
      
    } catch (error) {
      console.error('[ATS Tailor Popup] Error:', error);
      
      // Error animation
      if (showAnimation) {
        btn.style.background = 'linear-gradient(135deg, #ff1744, #ff5252)';
        if (btnIcon) btnIcon.textContent = '❌';
        if (btnText) btnText.textContent = 'Error!';
      }
      
      // Fallback to legacy flow
      try {
        await this.tailorDocuments({ force: true });
      } catch (e) {
        this.showToast(`Error: ${e.message}`, 'error');
      }
    } finally {
      // Remove pressed/loading state after completion
      setTimeout(() => {
        btn.classList.remove('pressed', 'loading', 'btn-animating');
        btn.disabled = false;
        btn.style.transform = '';
        btn.style.boxShadow = '';
        btn.style.background = '';
        btn.style.transition = '';
        if (btnText) btnText.textContent = originalText;
        if (btnIcon) {
          btnIcon.textContent = originalIcon;
          btnIcon.style.animation = '';
        }
      }, showAnimation ? 2500 : 0);
    }
  }
  
  /**
   * Trigger LazyApply 28s sync - schedules CV override after LazyApply attaches their CV
   */
  async triggerLazyApplySync() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        const response = await chrome.tabs.sendMessage(tab.id, {
          action: 'LAZYAPPLY_28S_SYNC'
        });
        this.showToast(`LazyApply override scheduled in ${response.delay / 1000}s`, 'success');
      }
    } catch (e) {
      this.showToast('Could not schedule LazyApply sync', 'error');
    }
  }

  async loadWorkdaySettings() {
    const result = await new Promise(resolve => {
      chrome.storage.local.get(['workday_email', 'workday_password', 'workday_verify_password', 'workday_auto_enabled'], resolve);
    });
    
    const emailInput = document.getElementById('workdayEmail');
    const passwordInput = document.getElementById('workdayPassword');
    const verifyPasswordInput = document.getElementById('workdayVerifyPassword');
    const autoToggle = document.getElementById('workdayAutoToggle');
    const emailDisplay = document.getElementById('workdayEmailDisplay');
    
    if (emailInput && result.workday_email) emailInput.value = result.workday_email;
    if (passwordInput && result.workday_password) passwordInput.value = result.workday_password;
    if (verifyPasswordInput && result.workday_verify_password) verifyPasswordInput.value = result.workday_verify_password;
    if (autoToggle) autoToggle.checked = result.workday_auto_enabled !== false;
    if (emailDisplay && result.workday_email) emailDisplay.textContent = result.workday_email;
  }

  saveWorkdayCredentials() {
    const email = document.getElementById('workdayEmail')?.value;
    const password = document.getElementById('workdayPassword')?.value;
    const verifyPassword = document.getElementById('workdayVerifyPassword')?.value;
    
    if (!email || !password) {
      this.showToast('Please enter email and password', 'error');
      return;
    }
    
    const emailDisplay = document.getElementById('workdayEmailDisplay');
    if (emailDisplay) emailDisplay.textContent = email;
    
    chrome.runtime.sendMessage({
      action: 'UPDATE_WORKDAY_CREDENTIALS',
      email: email,
      password: password,
      verifyPassword: verifyPassword || password
    });
    
    chrome.storage.local.set({
      workday_email: email,
      workday_password: password,
      workday_verify_password: verifyPassword || password
    });
    
    this.showToast('Workday credentials saved!', 'success');
  }
  
  // Load default location settings
  loadLocationSettings() {
    const locationInput = document.getElementById('defaultLocationInput');
    if (locationInput && this._defaultLocation) {
      locationInput.value = this._defaultLocation;
    }
  }
  
  // Save default location for Remote jobs
  saveDefaultLocation() {
    const locationInput = document.getElementById('defaultLocationInput');
    const location = locationInput?.value?.trim();
    
    if (!location) {
      this.showToast('Please enter a valid location', 'error');
      return;
    }
    
    this._defaultLocation = location;
    chrome.storage.local.set({ ats_defaultLocation: location });
    
    // Also update content script with new default location
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'UPDATE_DEFAULT_LOCATION',
          defaultLocation: location
        }).catch(() => {});
      }
    });
    
    this.showToast(`Default location set to: ${location}`, 'success');
  }

  async runWorkdayFlow() {
    if (!this.session) {
      this.showToast('Please login first', 'error');
      return;
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url?.includes('workday')) {
      this.showToast('Navigate to a Workday job page first', 'error');
      return;
    }

    this.showToast('Starting Workday automation...', 'success');
    this.setStatus('Running Workday Flow...', 'working');

    let candidateData = null;
    try {
      const profileRes = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${this.session.user.id}&select=*`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${this.session.access_token}`,
          },
        }
      );
      const profiles = await profileRes.json();
      candidateData = profiles?.[0] || null;
    } catch (e) {
      console.log('Could not fetch profile for Workday flow');
    }

    chrome.runtime.sendMessage({
      action: 'TRIGGER_WORKDAY_FLOW',
      candidateData: candidateData
    });

    setTimeout(() => {
      window.close();
    }, 1000);
  }

  copyCurrentContent() {
    const content = this.currentPreviewTab === 'cv' 
      ? this.generatedDocuments.cv 
      : this.generatedDocuments.coverLetter;
    
    if (content) {
      navigator.clipboard.writeText(content)
        .then(() => this.showToast('Copied to clipboard!', 'success'))
        .catch(() => this.showToast('Failed to copy', 'error'));
    } else {
      this.showToast('No content to copy', 'error');
    }
  }

  switchPreviewTab(tab) {
    this.currentPreviewTab = tab;
    
    document.getElementById('previewCvTab')?.classList.toggle('active', tab === 'cv');
    document.getElementById('previewCoverTab')?.classList.toggle('active', tab === 'cover');
    document.getElementById('previewTextTab')?.classList.toggle('active', tab === 'text');
    
    this.updatePreviewContent();
  }

  updatePreviewContent() {
    const previewContent = document.getElementById('previewContent');
    if (!previewContent) return;
    
    // Handle text view tab
    if (this.currentPreviewTab === 'text') {
      const cvContent = this.generatedDocuments.cv || '';
      if (cvContent) {
        // Show plain text version with monospace formatting
        previewContent.innerHTML = `<pre style="white-space: pre-wrap; font-family: 'Courier New', monospace; font-size: 10px; line-height: 1.3; padding: 8px; background: #f5f5f5; border-radius: 4px; overflow-x: auto;">${cvContent.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`;
        previewContent.classList.remove('placeholder');
      } else {
        previewContent.textContent = 'Generate CV to see text version...';
        previewContent.classList.add('placeholder');
      }
      return;
    }
    
    const content = this.currentPreviewTab === 'cv' 
      ? this.generatedDocuments.cv 
      : this.generatedDocuments.coverLetter;
    
    const hasPdf = this.currentPreviewTab === 'cv' 
      ? this.generatedDocuments.cvPdf 
      : this.generatedDocuments.coverPdf;
    
    if (content) {
      previewContent.innerHTML = this.formatPreviewContent(content, this.currentPreviewTab);
      previewContent.classList.remove('placeholder');
    } else if (hasPdf) {
      previewContent.textContent = `PDF generated - click Download to view the ${this.currentPreviewTab === 'cv' ? 'CV' : 'Cover Letter'}`;
      previewContent.classList.add('placeholder');
    } else {
      previewContent.textContent = 'Click "Tailor CV & Cover Letter" to generate...';
      previewContent.classList.add('placeholder');
    }
  }

  formatPreviewContent(content, type) {
    if (!content) return '';
    
    const escapeHtml = (text) => {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    };
    
    let formatted = escapeHtml(content);
    
    if (type === 'cv') {
      formatted = formatted
        .replace(/^(PROFESSIONAL SUMMARY|WORK EXPERIENCE|EXPERIENCE|EDUCATION|SKILLS|CERTIFICATIONS|ACHIEVEMENTS|PROJECTS|TECHNICAL PROFICIENCIES)/gm, 
          '<span class="section-header">$1</span>')
        .replace(/^([A-Z][A-Za-z\s&]+)\s*\|\s*(.+)$/gm, 
          '<strong>$1</strong> | <span class="date-line">$2</span>')
        .replace(/^[•▪]\s*/gm, '• ');
    } else {
      formatted = formatted
        .replace(/^(Date:.+)$/m, '<span class="date-line">$1</span>')
        .replace(/^(Dear .+,)$/m, '<strong>$1</strong>')
        .replace(/^(Sincerely,|Best regards,|Regards,)$/m, '<br><strong>$1</strong>');
    }
    
    return formatted;
  }

  updateUI() {
    const loginSection = document.getElementById('loginSection');
    const mainSection = document.getElementById('mainSection');
    const userEmail = document.getElementById('userEmail');
    
    if (!this.session) {
      loginSection?.classList.remove('hidden');
      mainSection?.classList.add('hidden');
      this.setStatus('Login Required', 'error');
    } else {
      loginSection?.classList.add('hidden');
      mainSection?.classList.remove('hidden');
      if (userEmail) userEmail.textContent = this.session.user?.email || 'Logged in';
      this.setStatus('Ready', 'ready');
    }
    
    document.getElementById('todayCount').textContent = this.stats.today;
    document.getElementById('totalCount').textContent = this.stats.total;
    document.getElementById('avgTime').textContent = this.stats.avgTime > 0 ? `${Math.round(this.stats.avgTime)}s` : '0s';
    
    const autoTailorToggle = document.getElementById('autoTailorToggle');
    if (autoTailorToggle) {
      autoTailorToggle.checked = this.autoTailorEnabled;
    }
    
    const hasDocuments = this.generatedDocuments.cv || 
                         this.generatedDocuments.coverLetter || 
                         this.generatedDocuments.cvPdf || 
                         this.generatedDocuments.coverPdf;
    if (hasDocuments) {
      document.getElementById('documentsCard')?.classList.remove('hidden');
      this.updateDocumentDisplay();
      this.updatePreviewContent();
    }
  }

  updateDocumentDisplay() {
    const cvFileName = document.getElementById('cvFileName');
    const coverFileName = document.getElementById('coverFileName');
    
    if (cvFileName && this.generatedDocuments.cvFileName) {
      cvFileName.textContent = this.generatedDocuments.cvFileName;
      cvFileName.title = this.generatedDocuments.cvFileName;
    }
    
    if (coverFileName && this.generatedDocuments.coverFileName) {
      coverFileName.textContent = this.generatedDocuments.coverFileName;
      coverFileName.title = this.generatedDocuments.coverFileName;
    }
    
    const cvSize = document.getElementById('cvSize');
    const coverSize = document.getElementById('coverSize');
    
    if (cvSize && this.generatedDocuments.cvPdf) {
      const sizeKB = Math.round(this.generatedDocuments.cvPdf.length * 0.75 / 1024);
      cvSize.textContent = `${sizeKB} KB`;
    }
    
    if (coverSize && this.generatedDocuments.coverPdf) {
      const sizeKB = Math.round(this.generatedDocuments.coverPdf.length * 0.75 / 1024);
      coverSize.textContent = `${sizeKB} KB`;
    }
    
    // Update AI Match Analysis Panel
    this.updateMatchAnalysisUI();
  }

  /**
   * OPTIMIZED: Update AI Match Analysis panel with keyword chips
   * Uses batch DOM updates for performance
   */
  updateMatchAnalysisUI() {
    const matchScore = this.generatedDocuments.matchScore || 0;
    const matchedKeywords = this.generatedDocuments.matchedKeywords || [];
    const missingKeywords = this.generatedDocuments.missingKeywords || [];
    const keywords = this.generatedDocuments.keywords || null;
    const totalKeywords = matchedKeywords.length + missingKeywords.length;
    
    // Update gauge
    this.updateMatchGauge(matchScore, matchedKeywords.length, totalKeywords);
    
    // Build keywords object if not present
    const cvText = this.generatedDocuments.cv || '';
    let keywordsObj = keywords;
    
    if (!keywordsObj || (!keywordsObj.highPriority && !keywordsObj.all)) {
      const allKeywords = [...matchedKeywords, ...missingKeywords];
      if (allKeywords.length > 0) {
        const highCount = Math.min(15, Math.ceil(allKeywords.length * 0.4));
        const medCount = Math.min(10, Math.ceil(allKeywords.length * 0.35));
        keywordsObj = {
          all: allKeywords,
          highPriority: allKeywords.slice(0, highCount),
          mediumPriority: allKeywords.slice(highCount, highCount + medCount),
          lowPriority: allKeywords.slice(highCount + medCount)
        };
      }
    }
    
    // BATCH DOM update for keyword chips
    if (keywordsObj && (keywordsObj.highPriority || keywordsObj.all)) {
      this.batchUpdateKeywordChips(keywordsObj, cvText, matchedKeywords);
    } else if (totalKeywords > 0) {
      // Fallback: manual chip rendering with batch update
      const highCount = Math.ceil(totalKeywords * 0.4);
      const medCount = Math.ceil(totalKeywords * 0.35);
      
      const allKeywords = [...matchedKeywords, ...missingKeywords];
      const fallbackObj = {
        highPriority: allKeywords.slice(0, highCount),
        mediumPriority: allKeywords.slice(highCount, highCount + medCount),
        lowPriority: allKeywords.slice(highCount + medCount)
      };
      this.batchUpdateKeywordChips(fallbackObj, cvText, matchedKeywords);
    }

    // NEW: Keyword coverage debug panel (injected locations)
    this.updateKeywordCoverageUI();
  }

  /**
   * OPTIMIZED: Update match gauge with animation
   */
  updateMatchGauge(score, matched, total) {
    const gaugeCircle = document.getElementById('matchGaugeCircle');
    if (gaugeCircle) {
      const circumference = 2 * Math.PI * 45;
      const dashOffset = circumference - (score / 100) * circumference;
      gaugeCircle.setAttribute('stroke-dashoffset', dashOffset.toString());
      
      let strokeColor = '#ff4757';
      if (score >= 90) strokeColor = '#2ed573';
      else if (score >= 70) strokeColor = '#00d4ff';
      else if (score >= 50) strokeColor = '#ffa502';
      gaugeCircle.setAttribute('stroke', strokeColor);
    }
    
    const matchPercentage = document.getElementById('matchPercentage');
    if (matchPercentage) matchPercentage.textContent = `${score}%`;
    
    const matchSubtitle = document.getElementById('matchSubtitle');
    if (matchSubtitle) {
      matchSubtitle.textContent = score >= 90 ? 'Excellent match!' : 
                                   score >= 70 ? 'Good match' : 
                                   score >= 50 ? 'Fair match - consider improvements' : 
                                   'Needs improvement';
    }
    
    const keywordCountBadge = document.getElementById('keywordCountBadge');
    if (keywordCountBadge) {
      keywordCountBadge.textContent = `${matched} of ${total} keywords matched`;
    }
  }

  /**
   * OPTIMIZED: Batch update all keyword chips in one DOM operation
   */
  batchUpdateKeywordChips(keywordsObj, cvText, matchedKeywords) {
    const cvTextLower = cvText.toLowerCase();
    const matchedSet = new Set(matchedKeywords.map(k => k.toLowerCase()));
    
    const sections = [
      { containerId: 'highPriorityChips', countId: 'highPriorityCount', keywords: keywordsObj.highPriority || [] },
      { containerId: 'mediumPriorityChips', countId: 'mediumPriorityCount', keywords: keywordsObj.mediumPriority || [] },
      { containerId: 'lowPriorityChips', countId: 'lowPriorityCount', keywords: keywordsObj.lowPriority || [] }
    ];
    
    sections.forEach(({ containerId, countId, keywords }) => {
      const container = document.getElementById(containerId);
      const countEl = document.getElementById(countId);
      if (!container) return;
      
      // Build HTML string for batch insert
      let matchCount = 0;
      const chipsHtml = keywords.map(kw => {
        const kwLower = kw.toLowerCase();
        const isMatched = matchedSet.has(kwLower) || cvTextLower.includes(kwLower);
        if (isMatched) matchCount++;
        
        const escapedKw = this.escapeHtml(kw);
        return `<span class="keyword-chip ${isMatched ? 'matched' : 'missing'}"><span class="chip-text">${escapedKw}</span><span class="chip-icon">${isMatched ? '✓' : '✗'}</span></span>`;
      }).join('');
      
      // Single DOM update
      container.innerHTML = chipsHtml;
      if (countEl) countEl.textContent = `${matchCount}/${keywords.length}`;
    });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  compactCoverageReport(report) {
    if (!report || !report.keywords) return null;

    const compact = {
      timestamp: report.timestamp,
      summary: report.summary,
      warnings: report.warnings,
      density: report.density,
      keywords: {},
    };

    for (const [keyword, data] of Object.entries(report.keywords)) {
      compact.keywords[keyword] = {
        priority: data.priority,
        finalCount: data.finalCount,
        targetMin: data.targetMin,
        targetMax: data.targetMax,
        meetsTarget: data.meetsTarget,
        overDensity: data.overDensity,
        locations: (data.locations || []).slice(0, 6).map((l) => ({
          section: l.section,
          context: l.context,
        })),
      };
    }

    return compact;
  }

  buildKeywordCoverageReport(keywords) {
    try {
      const originalCV = this._coverageOriginalCV || '';
      const tailoredCV = this.generatedDocuments.cv || '';
      if (!originalCV || !tailoredCV || !keywords?.all?.length) return;

      if (!window.TurboPipeline?.generateKeywordCoverageReport) return;

      const report = window.TurboPipeline.generateKeywordCoverageReport(originalCV, tailoredCV, keywords);
      const compact = this.compactCoverageReport(report);
      if (compact) {
        this.generatedDocuments.coverageReport = compact;
      }
    } catch (e) {
      console.warn('[ATS Tailor] Failed to build keyword coverage report:', e);
    }
  }

  updateKeywordCoverageUI() {
    const container = document.getElementById('coverageContainer');
    if (!container) return;

    const report = this.generatedDocuments.coverageReport;
    if (!report?.keywords) {
      container.classList.add('hidden');
      return;
    }

    container.classList.remove('hidden');

    const groups = { high: [], medium: [], low: [] };
    for (const [keyword, data] of Object.entries(report.keywords)) {
      const priority = data.priority || 'low';
      (groups[priority] || groups.low).push({ keyword, ...data });
    }

    const render = (items, listId, countId) => {
      const list = document.getElementById(listId);
      const countEl = document.getElementById(countId);
      if (!list) return;

      const total = items.length;
      const ok = items.filter((i) => i.meetsTarget).length;
      if (countEl) countEl.textContent = `${ok}/${total}`;

      const html = items
        .sort((a, b) => (b.finalCount || 0) - (a.finalCount || 0))
        .map((i) => {
          const status = i.overDensity ? 'over' : (i.meetsTarget ? 'ok' : 'under');
          const badge = i.overDensity ? 'OVER' : (i.meetsTarget ? 'OK' : 'LOW');
          const sections = Array.from(new Set((i.locations || []).map((l) => l.section))).filter(Boolean);

          const details = (i.locations || []).slice(0, 6).map((l) => {
            const sec = this.escapeHtml(l.section || 'OTHER');
            const ctx = this.escapeHtml((l.context || '').replace(/\s+/g, ' ').trim());
            return `<div class="coverage-location"><span class="coverage-section-label">${sec}</span>${ctx}</div>`;
          }).join('');

          return `
            <details class="coverage-item status-${status}">
              <summary>
                <div class="coverage-left">
                  <div class="coverage-keyword">${this.escapeHtml(i.keyword)}</div>
                  <div class="coverage-meta">${i.finalCount || 0}x • ${sections.join(', ') || '—'}</div>
                </div>
                <span class="coverage-badge">${badge}</span>
              </summary>
              <div class="coverage-details">${details || '<div class="coverage-location">No locations captured.</div>'}</div>
            </details>
          `;
        })
        .join('');

      list.innerHTML = html;
    };

    render(groups.high, 'coverageHighList', 'coverageHighCount');
    render(groups.medium, 'coverageMediumList', 'coverageMediumCount');
    render(groups.low, 'coverageLowList', 'coverageLowCount');
  }

  async copyCoverageReport() {
    try {
      const report = this.generatedDocuments.coverageReport;
      if (!report) {
        this.showToast('No coverage report available yet', 'error');
        return;
      }
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      this.showToast('Coverage report copied', 'success');
    } catch (e) {
      this.showToast('Failed to copy coverage report', 'error');
    }
  }

  setStatus(text, type = 'ready') {
    const indicator = document.getElementById('statusIndicator');
    const statusText = indicator?.querySelector('.status-text');
    
    if (indicator) {
      indicator.classList.remove('ready', 'error', 'working', 'success');
      indicator.classList.add(type);
    }
    if (statusText) statusText.textContent = text;
  }

  async login() {
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.getElementById('loginBtn');
    
    const email = emailInput?.value?.trim();
    const password = passwordInput?.value;
    
    if (!email || !password) {
      this.showToast('Please enter email and password', 'error');
      return;
    }
    
    loginBtn.disabled = true;
    loginBtn.textContent = 'Signing in...';
    
    try {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY
        },
        body: JSON.stringify({ email, password })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error_description || data.error || 'Login failed');
      }
      
      this.session = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        user: data.user
      };
      
      await this.saveSession();
      this.showToast('Logged in successfully!', 'success');
      this.updateUI();
      
      const found = await this.detectCurrentJob();
      if (found && this.currentJob) {
        this.tailorDocuments();
      }
      
    } catch (error) {
      console.error('Login error:', error);
      this.showToast(error.message || 'Login failed', 'error');
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = 'Sign In';
    }
  }

  async logout() {
    this.session = null;
    await chrome.storage.local.remove(['ats_session']);
    this.showToast('Logged out', 'success');
    this.updateUI();
  }

  isSupportedHost(hostname) {
    return SUPPORTED_HOSTS.some(h => hostname === h || hostname.endsWith(`.${h}`));
  }

  async detectCurrentJob() {
    this.setStatus('Scanning...', 'working');

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab?.id || !tab?.url) {
        this.currentJob = null;
        this.updateJobDisplay();
        this.setStatus('No active tab', 'error');
        return false;
      }

      if (
        tab.url.startsWith('chrome://') ||
        tab.url.startsWith('about:') ||
        tab.url.startsWith('edge://') ||
        tab.url.startsWith('chrome-extension://') ||
        tab.url.startsWith('moz-extension://')
      ) {
        this.currentJob = null;
        this.updateJobDisplay();
        this.setStatus('Navigate to a job page', 'error');
        return false;
      }

      const url = new URL(tab.url);
      if (!this.isSupportedHost(url.hostname)) {
        this.currentJob = null;
        this.updateJobDisplay();
        this.setStatus(`Unsupported: ${url.hostname}`, 'error');
        return false;
      }

      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractJobInfoFromPageInjected,
      });

      if (results?.[0]?.result) {
        this.currentJob = results[0].result;
        
        // PERFORMANCE: Limit JD length for faster processing
        if (this.currentJob.description && this.currentJob.description.length > MAX_JD_LENGTH) {
          this.currentJob.description = this.currentJob.description.substring(0, MAX_JD_LENGTH);
        }
        
        await chrome.storage.local.set({ ats_lastJob: this.currentJob });
        this.updateJobDisplay();
        this.setStatus('Job found!', 'ready');
        return true;
      }

      this.currentJob = null;
      this.updateJobDisplay();
      this.setStatus('No job found on page', 'error');
      return false;
    } catch (error) {
      console.error('Job detection error:', error);
      this.currentJob = null;
      this.updateJobDisplay();
      this.setStatus('Detection failed', 'error');
      return false;
    }
  }

  updateJobDisplay() {
    const titleEl = document.getElementById('jobTitle');
    const companyEl = document.getElementById('jobCompany');
    const locationEl = document.getElementById('jobLocation');
    const noJobBadge = document.getElementById('noJobBadge');
    
    if (this.currentJob) {
      if (titleEl) titleEl.textContent = this.currentJob.title || 'Job Position';
      // Hide "the company" fallback - only show real company names
      const company = this.currentJob.company || '';
      const isValidCompany = company && company.toLowerCase() !== 'the company' && company.toLowerCase() !== 'company';
      if (companyEl) {
        companyEl.textContent = isValidCompany ? company : '';
        companyEl.style.display = isValidCompany ? '' : 'none';
      }
      if (locationEl) locationEl.textContent = this.currentJob.location || '';
      if (noJobBadge) noJobBadge.classList.add('hidden');
    } else {
      if (titleEl) titleEl.textContent = 'No job detected';
      if (companyEl) companyEl.textContent = 'Navigate to a job posting';
      if (locationEl) locationEl.textContent = '';
      if (noJobBadge) noJobBadge.classList.remove('hidden');
    }
  }

  /**
   * OPTIMIZED: Extract keywords with mandatory pre-pass, caching, and parallel processing
   * 1. Mandatory pre-pass: Find all known important keywords
   * 2. TF-IDF extraction: Get JD-specific keywords
   * 3. Merge: Mandatory keywords get HIGH priority
   */
  extractKeywordsOptimized(jobDescription) {
    if (!jobDescription || jobDescription.length < 50) {
      return { all: [], highPriority: [], mediumPriority: [], lowPriority: [] };
    }
    
    const jobUrl = this.currentJob?.url || '';
    
    // Check cache first
    const cached = this.keywordCache.get(jobUrl);
    if (cached && (Date.now() - cached.timestamp) < CACHE_EXPIRY_MS) {
      console.log('[ATS Tailor] Using cached keywords for:', jobUrl);
      return cached.keywords;
    }
    
    const startTime = performance.now();
    
    // STEP 1: MANDATORY PRE-PASS - Find all known important keywords FIRST
    let mandatoryFromJD = [];
    if (window.MandatoryKeywords) {
      mandatoryFromJD = window.MandatoryKeywords.extractMandatoryFromJD(jobDescription);
      console.log('[ATS Tailor] Mandatory pre-pass found:', mandatoryFromJD.length, 'keywords');
    }
    
    // STEP 2: TF-IDF/Pattern extraction
    let keywords = { all: [], highPriority: [], mediumPriority: [], lowPriority: [] };
    
    if (window.ReliableExtractor) {
      keywords = window.ReliableExtractor.extractReliableKeywords(jobDescription, 35);
    } else if (window.KeywordExtractor) {
      keywords = window.KeywordExtractor.extractKeywords(jobDescription, 35);
    } else {
      keywords = this.fastKeywordExtraction(jobDescription);
    }
    
    // STEP 3: Merge mandatory keywords with extracted (mandatory = HIGH priority)
    if (window.MandatoryKeywords && mandatoryFromJD.length > 0) {
      keywords = window.MandatoryKeywords.mergeWithMandatory(keywords, mandatoryFromJD);
    }
    
    const elapsed = performance.now() - startTime;
    console.log(`[ATS Tailor] Keyword extraction completed in ${elapsed.toFixed(1)}ms, total: ${keywords.all?.length || 0}`);
    
    // Cache the result
    if (jobUrl) {
      this.keywordCache.set(jobUrl, { keywords, timestamp: Date.now() });
    }
    
    return keywords;
  }

  /**
   * View Extracted Keywords - extracts and displays keywords from current job
   */
  async viewExtractedKeywords() {
    const btn = document.getElementById('viewKeywordsBtn');
    if (btn) {
      btn.disabled = true;
      btn.querySelector('.btn-text').textContent = 'Extracting...';
    }
    
    try {
      // Ensure we have job info
      if (!this.currentJob?.description) {
        await this.detectCurrentJob();
      }
      
      if (!this.currentJob?.description) {
        this.showToast('No job description detected. Navigate to a job posting.', 'error');
        return;
      }
      
      // Extract keywords
      const keywords = this.extractKeywordsOptimized(this.currentJob.description);
      
      if (!keywords.all || keywords.all.length === 0) {
        this.showToast('No keywords found in job description.', 'error');
        return;
      }
      
      // Store keywords for UI display
      this.generatedDocuments.structuredKeywords = keywords;
      this.generatedDocuments.missingKeywords = keywords.all;
      this.generatedDocuments.matchedKeywords = [];
      this.generatedDocuments.matchScore = 0;
      
      // Update UI to show extracted keywords
      this.updateMatchAnalysisUI();
      
      // Ensure documents card is visible to show keywords
      const documentsCard = document.getElementById('documentsCard');
      if (documentsCard) {
        documentsCard.classList.remove('hidden');
      }
      
      // Scroll to keywords section
      const keywordsContainer = document.getElementById('keywordsContainer');
      if (keywordsContainer) {
        keywordsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      
      this.showToast(`Extracted ${keywords.all.length} keywords from job description`, 'success');
      
    } catch (error) {
      console.error('[ATS Tailor] Error extracting keywords:', error);
      this.showToast('Failed to extract keywords: ' + error.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.querySelector('.btn-text').textContent = 'View Extracted Keywords';
      }
    }
  }

  /**
   * AI-powered keyword extraction using GPT-4o-mini (Resume-Matcher style)
   * Uses user's OpenAI API key from profile
   */
  async aiExtractKeywords() {
    const btn = document.getElementById('aiExtractBtn');
    if (btn) {
      btn.disabled = true;
      btn.querySelector('.btn-text').textContent = 'AI Analyzing...';
    }
    
    try {
      // Ensure we have session
      if (!this.session?.access_token) {
        this.showToast('Please login to use AI keyword extraction', 'error');
        return;
      }
      
      // Ensure we have job info
      if (!this.currentJob?.description) {
        await this.detectCurrentJob();
      }
      
      if (!this.currentJob?.description) {
        this.showToast('No job description detected. Navigate to a job posting.', 'error');
        return;
      }
      
      // Call the AI extraction endpoint
      const response = await fetch(`${SUPABASE_URL}/functions/v1/extract-keywords-ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.session.access_token}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          jobDescription: this.currentJob.description,
          jobTitle: this.currentJob.title,
          company: this.currentJob.company,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (!result.all || result.all.length === 0) {
        this.showToast('AI could not extract keywords from this job description.', 'error');
        return;
      }
      
      // Store structured keywords for UI display
      const keywords = {
        all: result.all,
        highPriority: result.highPriority || [],
        mediumPriority: result.mediumPriority || [],
        lowPriority: result.lowPriority || [],
        structured: result.structured, // Full Resume-Matcher style breakdown
      };
      
      this.generatedDocuments.structuredKeywords = keywords;
      this.generatedDocuments.keywords = keywords;
      this.generatedDocuments.missingKeywords = keywords.all;
      this.generatedDocuments.matchedKeywords = [];
      this.generatedDocuments.matchScore = 0;
      
      // Update UI to show extracted keywords
      this.updateMatchAnalysisUI();
      
      // Ensure documents card is visible to show keywords
      const documentsCard = document.getElementById('documentsCard');
      if (documentsCard) {
        documentsCard.classList.remove('hidden');
      }
      
      // Scroll to keywords section
      const keywordsContainer = document.getElementById('keywordsContainer');
      if (keywordsContainer) {
        keywordsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      
      this.showToast(`AI extracted ${result.total} keywords (${result.highPriority?.length || 0} high priority)`, 'success');
      
      // Log structured breakdown to console for debugging
      console.log('[ATS Tailor] AI Structured Keywords:', result.structured);
      
    } catch (error) {
      console.error('[ATS Tailor] AI keyword extraction error:', error);
      this.showToast('AI extraction failed: ' + error.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.querySelector('.btn-text').textContent = 'AI Extract Keywords';
      }
    }
  }

  /**
   * Perform AI keyword extraction - reusable helper for tailorDocuments
   * Same logic as aiExtractKeywords but returns the result instead of updating UI
   * Includes retry logic with exponential backoff for transient failures
   * @returns {Promise<Object>} Keywords object with all, highPriority, mediumPriority, lowPriority
   */
  async performAIKeywordExtraction() {
    // Ensure we have job info
    if (!this.currentJob?.description) {
      await this.detectCurrentJob();
    }
    
    if (!this.currentJob?.description) {
      throw new Error('No job description detected');
    }
    
    // Retry configuration for keyword extraction
    const MAX_RETRIES = 4;
    const BASE_DELAY_MS = 500;
    const MAX_DELAY_MS = 5000;
    
    let lastError = null;
    
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000); // 20s timeout
        
        const response = await fetch(`${SUPABASE_URL}/functions/v1/extract-keywords-ai`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.session.access_token}`,
            apikey: SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            jobDescription: this.currentJob.description,
            jobTitle: this.currentJob.title || '',
            company: this.currentJob.company || '',
          }),
          signal: controller.signal,
          keepalive: true,
        });
        
        clearTimeout(timeout);
        
        if (!response.ok) {
          const errorText = await response.text();
          // Retry on 5xx errors or network issues
          if (response.status >= 500 || response.status === 0) {
            throw new Error(`Server error (${response.status}): ${errorText || 'retry'}`);
          }
          throw new Error(errorText || 'AI extraction failed');
        }
        
        const result = await response.json();
        
        if (result.error) {
          throw new Error(result.error);
        }
        
        // Build keywords object - ensure arrays
        const keywords = {
          all: Array.isArray(result.all) ? result.all : [],
          highPriority: Array.isArray(result.highPriority) ? result.highPriority : [],
          mediumPriority: Array.isArray(result.mediumPriority) ? result.mediumPriority : [],
          lowPriority: Array.isArray(result.lowPriority) ? result.lowPriority : [],
          structured: result.structured, // Full Resume-Matcher style breakdown
        };
        
        console.log('[ATS Tailor] AI extracted', keywords.all.length, 'keywords');
        return keywords;
        
      } catch (error) {
        lastError = error;
        
        // Don't retry on non-retryable errors
        if (error.name === 'AbortError') {
          console.warn(`[ATS Tailor] AI extraction timeout on attempt ${attempt + 1}/${MAX_RETRIES + 1}`);
        } else if (error.message?.includes('401') || error.message?.includes('403')) {
          // Auth errors - don't retry
          throw error;
        } else {
          console.warn(`[ATS Tailor] AI extraction attempt ${attempt + 1}/${MAX_RETRIES + 1} failed:`, error.message);
        }
        
        // If we have more retries left, wait with exponential backoff
        if (attempt < MAX_RETRIES) {
          const delay = Math.min(BASE_DELAY_MS * Math.pow(2, attempt), MAX_DELAY_MS);
          console.log(`[ATS Tailor] Retrying AI extraction in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // All retries exhausted
    throw lastError || new Error('AI keyword extraction failed after retries');
  }

  /**
   * OPTIMIZED: Fast single-pass keyword extraction fallback
   */
  fastKeywordExtraction(text) {
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'it', 'its', 'you', 'your', 'we', 'our', 'they', 'their', 'who', 'what', 'which', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'also', 'now', 'here', 'there', 'then', 'if', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'once', 'any']);
    
    // Single-pass frequency map
    const freq = new Map();
    const words = text.toLowerCase().replace(/[^a-z0-9\-\/\+\#\.]+/g, ' ').split(/\s+/);
    
    for (const word of words) {
      if (word.length > 2 && !stopWords.has(word)) {
        freq.set(word, (freq.get(word) || 0) + 1);
      }
    }
    
    // Sort by frequency and get top 35
    const sorted = [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 35)
      .map(([word]) => word);
    
    // Distribute into priority buckets
    const highCount = Math.ceil(sorted.length * 0.4);
    const medCount = Math.ceil(sorted.length * 0.35);
    
    return {
      all: sorted,
      highPriority: sorted.slice(0, highCount),
      mediumPriority: sorted.slice(highCount, highCount + medCount),
      lowPriority: sorted.slice(highCount + medCount)
    };
  }

  /**
   * OPTIMIZED: Calculate match score with single-pass matching
   */
  calculateMatchScore(cvText, keywords) {
    if (!cvText || !keywords?.all || keywords.all.length === 0) {
      return { matchScore: 0, matchedKeywords: [], missingKeywords: keywords?.all || [] };
    }
    
    const cvTextLower = cvText.toLowerCase();
    const matched = [];
    const missing = [];
    
    for (const kw of keywords.all) {
      if (cvTextLower.includes(kw.toLowerCase())) {
        matched.push(kw);
      } else {
        missing.push(kw);
      }
    }
    
    const matchScore = keywords.all.length > 0 ? Math.round((matched.length / keywords.all.length) * 100) : 0;
    
    return { matchScore, matchedKeywords: matched, missingKeywords: missing };
  }

  /**
   * OPTIMIZED: Boost CV to 95%+ match with internal keyword injection
   * Called automatically by tailorDocuments - no separate button needed
   */
  async boostCVTo95Plus(cvText, keywords, updateProgress) {
    if (!cvText || !keywords?.all || keywords.all.length === 0) {
      return { tailoredCV: cvText, finalScore: 0, matchedKeywords: [], missingKeywords: [] };
    }
    
    const initial = this.calculateMatchScore(cvText, keywords);
    
    if (initial.matchScore >= 95) {
      return { 
        tailoredCV: cvText, 
        finalScore: initial.matchScore, 
        matchedKeywords: initial.matchedKeywords, 
        missingKeywords: initial.missingKeywords,
        keywords 
      };
    }
    
    let tailorResult = null;
    
    // Try optimized tailoring modules
    if (window.TailorUniversal) {
      tailorResult = await window.TailorUniversal.tailorCV(cvText, keywords.all, { targetScore: 95 });
    } else if (window.AutoTailor95) {
      const tailor = new window.AutoTailor95({
        onProgress: updateProgress,
        onScoreUpdate: (score) => {
          this.updateMatchGauge(score, 0, keywords.all.length);
        }
      });
      tailorResult = await tailor.autoTailorTo95Plus(this.currentJob?.description || '', cvText);
    } else if (window.CVTailor) {
      tailorResult = window.CVTailor.tailorCV(cvText, keywords, { targetScore: 95 });
    } else {
      // FAST fallback: Simple keyword injection
      tailorResult = this.fastKeywordInjection(cvText, keywords, initial.missingKeywords);
    }
    
    if (tailorResult?.tailoredCV) {
      const finalMatch = this.calculateMatchScore(tailorResult.tailoredCV, keywords);
      return {
        tailoredCV: tailorResult.tailoredCV,
        finalScore: finalMatch.matchScore,
        matchedKeywords: finalMatch.matchedKeywords,
        missingKeywords: finalMatch.missingKeywords,
        injectedKeywords: tailorResult.injectedKeywords || [],
        keywords
      };
    }
    
    return { 
      tailoredCV: cvText, 
      finalScore: initial.matchScore, 
      matchedKeywords: initial.matchedKeywords, 
      missingKeywords: initial.missingKeywords,
      keywords 
    };
  }

  /**
   * GUARANTEED 100% MATCH: Natural keyword injection into CV
   * Strategy (prioritizes Work Experience for natural integration):
   * 1. Experience: Primary focus - 25+ keywords naturally integrated into bullet points
   * 2. Summary: 5-8 keywords as expertise phrases
   * 3. Skills: Remaining keywords grouped by category
   * 4. Catch-all: Any remaining keywords as Technical Proficiencies
   */
  fastKeywordInjection(cvText, keywords, missingKeywords) {
    if (!missingKeywords || missingKeywords.length === 0) {
      return { tailoredCV: cvText, injectedKeywords: [] };
    }
    
    let tailoredCV = cvText;
    let injectedKeywords = [];
    let remaining = [...missingKeywords];
    
    // Natural injection phrases for Work Experience
    const actionPhrases = [
      'leveraging', 'utilizing', 'implementing', 'applying', 'integrating',
      'incorporating', 'employing', 'deploying', 'using', 'with expertise in'
    ];
    
    const getRandomPhrase = () => actionPhrases[Math.floor(Math.random() * actionPhrases.length)];
    
    // STEP 1: PRIMARY - Inject into Work Experience (25+ keywords naturally across bullets)
    if (remaining.length > 0) {
      const experienceMatch = tailoredCV.match(/(WORK EXPERIENCE|EXPERIENCE|EMPLOYMENT HISTORY|PROFESSIONAL EXPERIENCE)\s*\n([\s\S]*?)(?=\n(EDUCATION|SKILLS|TECHNICAL SKILLS|CERTIFICATIONS|ACHIEVEMENTS|PROJECTS)|\n\n\n|$)/i);
      if (experienceMatch) {
        const expStart = experienceMatch.index;
        const expEnd = expStart + experienceMatch[0].length;
        let experienceText = experienceMatch[0];
        
        // Find all bullet points
        const bullets = experienceText.match(/^[•\-\*]\s*.+$/gm) || [];
        // Target 2-3 keywords per bullet for natural integration
        const keywordsPerBullet = Math.ceil(remaining.length * 0.7 / Math.max(bullets.length, 1));
        const maxKeywordsInExp = Math.min(remaining.length, bullets.length * 3);
        const toInject = remaining.slice(0, maxKeywordsInExp);
        remaining = remaining.slice(maxKeywordsInExp);
        
        let keywordIdx = 0;
        bullets.forEach((bullet, idx) => {
          if (keywordIdx >= toInject.length) return;
          
          // Get 1-3 keywords for this bullet
          const numToAdd = Math.min(3, Math.ceil((toInject.length - keywordIdx) / (bullets.length - idx)));
          const kwToAdd = toInject.slice(keywordIdx, keywordIdx + numToAdd);
          keywordIdx += numToAdd;
          
          if (kwToAdd.length === 0) return;
          
          // Natural integration based on bullet content
          const phrase = getRandomPhrase();
          let enhanced = bullet;
          
          if (kwToAdd.length === 1) {
            // Single keyword: "...by utilizing [keyword]"
            enhanced = bullet.replace(/\.?\s*$/, `, ${phrase} ${kwToAdd[0]}.`);
          } else if (kwToAdd.length === 2) {
            // Two keywords: "...through [kw1] and [kw2]"
            enhanced = bullet.replace(/\.?\s*$/, `, ${phrase} ${kwToAdd[0]} and ${kwToAdd[1]}.`);
          } else {
            // Multiple: "...incorporating [kw1], [kw2], and [kw3]"
            const last = kwToAdd.pop();
            enhanced = bullet.replace(/\.?\s*$/, `, ${phrase} ${kwToAdd.join(', ')}, and ${last}.`);
            kwToAdd.push(last); // Put it back for tracking
          }
          
          experienceText = experienceText.replace(bullet, enhanced);
          injectedKeywords.push(...kwToAdd);
        });
        
        tailoredCV = tailoredCV.substring(0, expStart) + experienceText + tailoredCV.substring(expEnd);
      }
    }
    
    // STEP 2: Inject 5-8 keywords into Summary as expertise
    if (remaining.length > 0) {
      const summaryMatch = tailoredCV.match(/(PROFESSIONAL SUMMARY|SUMMARY|PROFILE|CAREER SUMMARY)\s*\n([\s\S]*?)(?=\n[A-Z]{3,}|\n\n|$)/i);
      if (summaryMatch) {
        const summaryStart = summaryMatch.index;
        const summaryEnd = summaryStart + summaryMatch[0].length;
        const summaryText = summaryMatch[2];
        
        const toInject = remaining.slice(0, Math.min(8, remaining.length));
        remaining = remaining.slice(toInject.length);
        
        // Build natural expertise sentence
        let injectionPhrase = '';
        if (toInject.length <= 3) {
          injectionPhrase = ` Expertise includes ${toInject.join(', ')}.`;
        } else if (toInject.length <= 5) {
          injectionPhrase = ` Strong background in ${toInject.slice(0, 3).join(', ')}, with additional skills in ${toInject.slice(3).join(' and ')}.`;
        } else {
          injectionPhrase = ` Core competencies include ${toInject.slice(0, 4).join(', ')}. Proven proficiency in ${toInject.slice(4).join(', ')}.`;
        }
        
        const newSummary = summaryText.trim() + injectionPhrase;
        tailoredCV = tailoredCV.substring(0, summaryStart) + 
                     summaryMatch[1] + '\n' + newSummary + 
                     tailoredCV.substring(summaryEnd);
        injectedKeywords.push(...toInject);
      }
    }
    
    // STEP 3: Inject remaining into Skills section
    if (remaining.length > 0) {
      const skillsMatch = tailoredCV.match(/(SKILLS|TECHNICAL SKILLS|CORE COMPETENCIES|KEY SKILLS)\s*\n([\s\S]*?)(?=\n[A-Z]{3,}|\n\n|$)/i);
      if (skillsMatch) {
        const skillsStart = skillsMatch.index;
        const skillsEnd = skillsStart + skillsMatch[0].length;
        const skillsText = skillsMatch[2];
        
        const toInject = remaining.slice(0, 15);
        remaining = remaining.slice(15);
        
        const newSkills = skillsText.trim() + '\n• Additional: ' + toInject.join(', ');
        tailoredCV = tailoredCV.substring(0, skillsStart) + 
                     skillsMatch[1] + '\n' + newSkills + 
                     tailoredCV.substring(skillsEnd);
        injectedKeywords.push(...toInject);
      }
    }
    
    // STEP 4: CATCH-ALL - Any remaining keywords as Technical Proficiencies
    if (remaining.length > 0) {
      const additionalSection = `\n\nTECHNICAL PROFICIENCIES\n• ${remaining.join(' • ')}`;
      
      // Insert before certifications/achievements or append to end
      const insertPoint = tailoredCV.search(/\n(CERTIFICATIONS|ACHIEVEMENTS|EDUCATION|PROJECTS)\n/i);
      if (insertPoint > 0) {
        tailoredCV = tailoredCV.substring(0, insertPoint) + additionalSection + tailoredCV.substring(insertPoint);
      } else {
        tailoredCV = tailoredCV + additionalSection;
      }
      injectedKeywords.push(...remaining);
    }
    
    return { tailoredCV, injectedKeywords };
  }

  /**
   * OPTIMIZED: Full automatic tailoring pipeline
   * IMPLEMENTATION FLOW:
   * 1. Click "AI Extract Keywords" → Wait for full extraction
   * 2. Grab 100% match keywords → Integrate naturally into Work Experience bullets
   * 3. Verify 100% profile match in extension UI
   * 4. Generate "Tailored_CV_[Job]_[Date].pdf" → Enable preview/download
   * 5. Auto-attach PDF to application upload field
   * 
   * UI updates at each stage for responsiveness
   */
  async tailorDocuments(options = {}) {
    if (!this.currentJob) {
      this.showToast('No job detected', 'error');
      return;
    }

    const startTime = Date.now();
    const btn = document.getElementById('tailorBtn');
    const progressContainer = document.getElementById('progressContainer');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const pipelineSteps = document.getElementById('pipelineSteps');
    
    btn.disabled = true;
    btn.querySelector('.btn-text').textContent = 'Tailoring...';
    progressContainer?.classList.remove('hidden');
    pipelineSteps?.classList.remove('hidden');
    this.setStatus('Tailoring...', 'working');

    const updateProgress = (percent, text) => {
      if (progressFill) progressFill.style.width = `${percent}%`;
      if (progressText) progressText.textContent = text;
    };

    const updateStep = (stepNum, status) => {
      const step = document.getElementById(`step${stepNum}`);
      if (!step) return;
      const icon = step.querySelector('.step-icon');
      if (status === 'working') {
        icon.textContent = '⏳';
        step.classList.add('active');
        step.classList.remove('complete');
      } else if (status === 'complete') {
        icon.textContent = '✓';
        step.classList.remove('active');
        step.classList.add('complete');
      }
    };

    try {
      // ============ STEP 1: AI EXTRACT KEYWORDS (Click "AI Extract Keywords" first) ============
      updateStep(1, 'working');
      updateProgress(5, 'Step 1/3: AI Extracting keywords from job description...');

      await this.refreshSessionIfNeeded();
      if (!this.session?.access_token || !this.session?.user?.id) {
        throw new Error('Please sign in again');
      }

      // FIRST: Call AI Extract Keywords (equivalent to clicking the AI Extract button)
      let keywords = null;
      try {
        keywords = await this.performAIKeywordExtraction();
        console.log('[ATS Tailor] Step 1 - AI Extracted keywords:', keywords?.all?.length || 0);
      } catch (aiError) {
        console.warn('[ATS Tailor] AI extraction failed, falling back to local extraction:', aiError);
        // Fallback to local extraction if AI fails
        keywords = this.extractKeywordsOptimized(this.currentJob?.description || '');
      }
      
      if (!keywords || !keywords.all || keywords.all.length === 0) {
        throw new Error('Could not extract keywords from job description');
      }
      
      // Store keywords immediately for UI
      this.generatedDocuments.keywords = keywords;
      
      // UPDATE UI: Show extracted keywords immediately (before boost)
      this.generatedDocuments.matchedKeywords = [];
      this.generatedDocuments.missingKeywords = keywords.all;
      this.generatedDocuments.matchScore = 0;
      this.updateMatchAnalysisUI();
      
      // Save keywords to history for comparison feature
      await this.saveKeywordsToHistory(keywords);

      updateStep(1, 'complete');

      // ============ STEP 2: Load Profile & Generate Base CV ============
      updateStep(2, 'working');
      updateProgress(20, 'Step 2/3: Loading profile & generating tailored CV...');

      // Fetch user profile (API call)
      const profileRes = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${this.session.user.id}&select=first_name,last_name,email,phone,linkedin,github,portfolio,cover_letter,work_experience,education,skills,certifications,achievements,ats_strategy,city,country,address,state,zip_code`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${this.session.access_token}`,
          },
        }
      );

      if (!profileRes.ok) {
        throw new Error('Could not load profile. Open the QuantumHire app and complete your profile.');
      }

      const profileRows = await profileRes.json();
      const p = profileRows?.[0] || {};

      // Apply user location rules for tailoring/output
      // IMPORTANT: never include "Remote" in the candidate location line.
      const rawCity = String(p.city || '').split('|')[0].trim();
      const rawCountry = String(p.country || '').trim();
      const country = rawCountry && rawCountry.toLowerCase() === 'ireland' ? 'IE' : rawCountry;
      const base = [rawCity, country].filter(Boolean).join(', ').trim();
      this._defaultLocation = (/\bremote\b/i.test(String(p.city || '')) || /\bdublin\b/i.test(rawCity))
        ? 'Dublin, IE'
        : (base || 'Dublin, IE');

      const effectiveJobLocation = window.ATSLocationTailor?.normalizeJobLocationForApplication
        ? window.ATSLocationTailor.normalizeJobLocationForApplication(this.currentJob.location || '', this._defaultLocation)
        : (this.currentJob.location || this._defaultLocation);
      this.currentJob.location = effectiveJobLocation;
      
      console.log('[ATS Tailor] Step 2 - Profile loaded, generating base CV...');

      // Update step text
      updateProgress(35, 'Step 2/3: AI generating tailored documents...');

      const response = await fetch(`${SUPABASE_URL}/functions/v1/tailor-application`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.session.access_token}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          jobTitle: this.currentJob.title || '',
          company: this.currentJob.company || '',
          location: this.currentJob.location || '',
          description: this.currentJob.description || '',
          requirements: [],
          userProfile: {
            firstName: p.first_name || '',
            lastName: p.last_name || '',
            email: p.email || this.session.user.email || '',
            phone: p.phone || '',
            linkedin: p.linkedin || '',
            github: p.github || '',
            portfolio: p.portfolio || '',
            coverLetter: p.cover_letter || '',
            workExperience: Array.isArray(p.work_experience) ? p.work_experience : [],
            education: Array.isArray(p.education) ? p.education : [],
            skills: Array.isArray(p.skills) ? p.skills : [],
            certifications: Array.isArray(p.certifications) ? p.certifications : [],
            achievements: Array.isArray(p.achievements) ? p.achievements : [],
            atsStrategy: p.ats_strategy || '',
            city: this._defaultLocation,
            country: p.country || undefined,
            address: p.address || undefined,
            state: p.state || undefined,
            zipCode: p.zip_code || undefined,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        const isHtml = /^\s*</.test((errorText || '').trim());
        const msg = response.status === 502
          ? 'Service temporarily unavailable (502). Please retry in a few seconds.'
          : (!isHtml && errorText ? errorText : `Server error (${response.status})`);
        throw new Error(msg);
      }

      const result = await response.json();
      if (result.error) throw new Error(result.error);

      // Save original CV (before local boosting) for coverage report diffing
      this._coverageOriginalCV = result.tailoredResume || '';

      // Filename format: {FirstName}_{LastName}_CV.pdf and {FirstName}_{LastName}_Cover_Letter.pdf
      const firstName = (p.first_name || '').trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '') || 'Applicant';
      const lastName = (p.last_name || '').trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '') || '';
      const fileBaseName = lastName ? `${firstName}_${lastName}` : firstName;
      
      this.profileInfo = { firstName: p.first_name, lastName: p.last_name };

      this.generatedDocuments = {
        cv: result.tailoredResume,
        coverLetter: result.tailoredCoverLetter || result.coverLetter,
        cvPdf: result.resumePdf,
        coverPdf: result.coverLetterPdf,
        cvFileName: `${fileBaseName}_CV.pdf`,
        coverFileName: `${fileBaseName}_Cover_Letter.pdf`,
        matchScore: result.matchScore || 0,
        matchedKeywords: result.keywordsMatched || result.matchedKeywords || [],
        missingKeywords: result.keywordsMissing || result.missingKeywords || [],
        keywords: keywords
      };

      // Calculate initial match score against extracted keywords
      if (keywords.all?.length > 0 && this.generatedDocuments.cv) {
        const initial = this.calculateMatchScore(this.generatedDocuments.cv, keywords);
        this.generatedDocuments.matchedKeywords = initial.matchedKeywords;
        this.generatedDocuments.missingKeywords = initial.missingKeywords;
        this.generatedDocuments.matchScore = initial.matchScore;
        
        // UPDATE UI: Show initial match score
        this.updateMatchAnalysisUI();
      }

      console.log('[ATS Tailor] Step 2 - Initial match score:', this.generatedDocuments.matchScore + '%');
      updateStep(2, 'complete');

      // ============ STEP 3: GUARANTEED 100% MATCH - No keywords left behind ============
      updateStep(3, 'working');
      updateProgress(55, 'Step 3/3: Guaranteeing 100% keyword match...');

      const currentScore = this.generatedDocuments.matchScore || 0;
      
      // ALWAYS boost to 100% - no keywords left unmatched
      if (currentScore < 100 && keywords.all?.length > 0) {
        try {
          let boostResult = await this.boostCVTo95Plus(
            this.generatedDocuments.cv,
            keywords,
            (percent, text) => {
              updateProgress(55 + (percent * 0.15), `Step 3/3: ${text}`);
            }
          );

          // If still not 100%, use aggressive injection
          if (boostResult.finalScore < 100 && boostResult.missingKeywords?.length > 0) {
            console.log('[ATS Tailor] Applying final injection for remaining', boostResult.missingKeywords.length, 'keywords');
            const finalInject = this.fastKeywordInjection(
              boostResult.tailoredCV || this.generatedDocuments.cv,
              keywords,
              boostResult.missingKeywords
            );
            
            if (finalInject.tailoredCV) {
              boostResult.tailoredCV = finalInject.tailoredCV;
              boostResult.injectedKeywords = [...(boostResult.injectedKeywords || []), ...finalInject.injectedKeywords];
              
              // Recalculate final score - should now be 100%
              const finalMatch = this.calculateMatchScore(boostResult.tailoredCV, keywords);
              boostResult.finalScore = finalMatch.matchScore;
              boostResult.matchedKeywords = finalMatch.matchedKeywords;
              boostResult.missingKeywords = finalMatch.missingKeywords;
            }
          }

          if (boostResult.tailoredCV) {
            this.generatedDocuments.cv = boostResult.tailoredCV;
            this.generatedDocuments.matchScore = boostResult.finalScore;
            this.generatedDocuments.matchedKeywords = boostResult.matchedKeywords;
            this.generatedDocuments.missingKeywords = boostResult.missingKeywords;
            
            // UPDATE UI: Show final 100% match score
            this.updateMatchAnalysisUI();
            
            console.log('[ATS Tailor] Step 3 - Final score:', boostResult.finalScore + '%', 
                        'injected:', boostResult.injectedKeywords?.length || 0, 'keywords');
          }
        } catch (boostError) {
          console.warn('[ATS Tailor] Boost failed, applying fallback injection:', boostError);
          // Fallback: aggressive injection
          const fallbackInject = this.fastKeywordInjection(
            this.generatedDocuments.cv,
            keywords,
            this.generatedDocuments.missingKeywords
          );
          if (fallbackInject.tailoredCV) {
            this.generatedDocuments.cv = fallbackInject.tailoredCV;
            const finalMatch = this.calculateMatchScore(fallbackInject.tailoredCV, keywords);
            this.generatedDocuments.matchScore = finalMatch.matchScore;
            this.generatedDocuments.matchedKeywords = finalMatch.matchedKeywords;
            this.generatedDocuments.missingKeywords = finalMatch.missingKeywords;
            this.updateMatchAnalysisUI();
          }
        }
      } else if (currentScore >= 100) {
        console.log('[ATS Tailor] Step 3 - Already at 100%');
      }

      // Build keyword coverage report for debugging (injected locations in CV)
      this.buildKeywordCoverageReport(keywords);

      updateProgress(80, 'Step 3/3: Regenerating PDF with boosted CV...');

      // Regenerate PDF with boosted CV and dynamic location
      if (this.generatedDocuments.cv) {
        await this.regeneratePDFAfterBoost();
      }

      updateStep(3, 'complete');

      // ============ FINAL: Attach CV & Update UI ============
      updateProgress(90, 'Attaching tailored CV to application...');

      // Auto-attach CV to the page
      try {
        await this.attachDocument('cv');
      } catch (attachError) {
        console.warn('[ATS Tailor] Auto-attach failed:', attachError);
        // Don't throw - document generation was successful
      }

      updateProgress(100, 'Complete! 100% keyword match achieved.');

      await chrome.storage.local.set({ ats_lastGeneratedDocuments: this.generatedDocuments });

      const elapsed = (Date.now() - startTime) / 1000;
      this.stats.today++;
      this.stats.total++;
      this.stats.times.push(elapsed);
      if (this.stats.times.length > 10) this.stats.times.shift();
      this.stats.avgTime = this.stats.times.reduce((a, b) => a + b, 0) / this.stats.times.length;
      await this.saveStats();
      this.updateUI();

      // Show documents card and preview
      document.getElementById('documentsCard')?.classList.remove('hidden');
      this.updateDocumentDisplay();
      this.updatePreviewContent();
      
      const finalScore = this.generatedDocuments.matchScore;
      this.showToast(
        `Done in ${elapsed.toFixed(1)}s! ${finalScore}% keyword match.`, 
        'success'
      );
      this.setStatus('Complete', 'ready');

    } catch (error) {
      console.error('Tailoring error:', error);
      this.showToast(error.message || 'Failed', 'error');
      this.setStatus('Error', 'error');
    } finally {
      btn.disabled = false;
      btn.querySelector('.btn-text').textContent = 'Extract & Apply Keywords to CV';
      setTimeout(() => {
        progressContainer?.classList.add('hidden');
        [1, 2, 3].forEach(n => {
          const step = document.getElementById(`step${n}`);
          if (step) {
            step.classList.remove('active', 'complete');
            const icon = step.querySelector('.step-icon');
            if (icon) icon.textContent = '⏳';
          }
        });
      }, 3000);
    }
  }

  /**
   * Regenerate PDF after CV boost with dynamic location tailoring
   */
  async regeneratePDFAfterBoost() {
    try {
      console.log('[ATS Tailor] Regenerating PDF after boost (OpenResume style)...');
      
      // Get tailored location from job data
      let tailoredLocation = 'Open to relocation';
      if (window.LocationTailor && this.currentJob) {
        tailoredLocation = window.LocationTailor.extractFromJobData(this.currentJob);
      } else if (this.currentJob?.location) {
        tailoredLocation = this.currentJob.location;
      }
      console.log('[ATS Tailor] Tailored location:', tailoredLocation);

      // Get user profile for header
      let candidateData = {};
      try {
        if (this.session?.access_token && this.session?.user?.id) {
          const profileRes = await fetch(
            `${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${this.session.user.id}&select=first_name,last_name,email,phone,linkedin,github,portfolio,work_experience,education,skills,certifications,ats_strategy`,
            {
              headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${this.session.access_token}`,
              },
            }
          );
          if (profileRes.ok) {
            const profiles = await profileRes.json();
            candidateData = profiles?.[0] || {};
          }
        }
      } catch (e) {
        console.warn('[ATS Tailor] Could not fetch profile for PDF regeneration:', e);
      }

      // PRIORITY 1: Use OpenResume Generator for perfect ATS PDFs
      if (window.OpenResumeGenerator) {
        console.log('[ATS Tailor] Using OpenResume Generator for ATS-perfect PDFs...');
        
        const atsPackage = await window.OpenResumeGenerator.generateATSPackage(
          this.generatedDocuments.cv,
          this.generatedDocuments.keywords || {},
          {
            title: this.currentJob?.title || '',
            company: this.currentJob?.company || '',
            location: tailoredLocation
          },
          {
            firstName: candidateData.first_name,
            lastName: candidateData.last_name,
            email: candidateData.email || this.session?.user?.email,
            phone: candidateData.phone,
            linkedin: candidateData.linkedin,
            github: candidateData.github,
            portfolio: candidateData.portfolio,
            workExperience: candidateData.work_experience,
            education: candidateData.education,
            skills: candidateData.skills,
            certifications: candidateData.certifications,
            summary: candidateData.ats_strategy,
            city: tailoredLocation
          }
        );

        if (atsPackage.cvBase64) {
          this.generatedDocuments.cvPdf = atsPackage.cvBase64;
          this.generatedDocuments.cvFileName = atsPackage.cvFilename;
          this.generatedDocuments.tailoredLocation = tailoredLocation;
          console.log('[ATS Tailor] ✅ OpenResume CV generated:', atsPackage.cvFilename);
        }

        if (atsPackage.coverBase64) {
          this.generatedDocuments.coverPdf = atsPackage.coverBase64;
          this.generatedDocuments.coverFileName = atsPackage.coverFilename;
          console.log('[ATS Tailor] ✅ OpenResume Cover Letter generated:', atsPackage.coverFilename);
        }

        if (atsPackage.matchScore) {
          this.generatedDocuments.matchScore = atsPackage.matchScore;
        }

        return;
      }

      // PRIORITY 2: Use PDFATSPerfect if available
      if (window.PDFATSPerfect) {
        const pdfResult = await window.PDFATSPerfect.regenerateAfterBoost({
          jobData: this.currentJob,
          candidateData: {
            firstName: candidateData.first_name,
            lastName: candidateData.last_name,
            email: candidateData.email || this.session?.user?.email,
            phone: candidateData.phone,
            linkedin: candidateData.linkedin,
            github: candidateData.github,
            portfolio: candidateData.portfolio
          },
          boostedCVText: this.generatedDocuments.cv,
          currentLocation: tailoredLocation
        });

        if (pdfResult.pdf) {
          this.generatedDocuments.cvPdf = pdfResult.pdf;
          this.generatedDocuments.cvFileName = pdfResult.fileName;
          this.generatedDocuments.tailoredLocation = pdfResult.location;
          console.log('[ATS Tailor] PDF regenerated:', pdfResult.fileName);
          return;
        } else if (pdfResult.requiresBackendGeneration) {
          await this.regeneratePDFViaBackend(pdfResult, tailoredLocation);
          return;
        }
      }
      
      // PRIORITY 3: Fallback to backend generation
      await this.regeneratePDFViaBackend(null, tailoredLocation);
      
    } catch (error) {
      console.error('[ATS Tailor] PDF regeneration failed:', error);
      // Don't throw - boost was successful, just PDF failed
    }
  }

  /**
   * Regenerate PDF via Supabase edge function
   */
  async regeneratePDFViaBackend(textFormat, tailoredLocation) {
    try {
      if (!this.session?.access_token) {
        console.warn('[ATS Tailor] No session for backend PDF generation');
        return;
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.session.access_token}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          content: this.generatedDocuments.cv,
          type: 'cv',
          tailoredLocation: tailoredLocation,
          jobTitle: this.currentJob?.title,
          company: this.currentJob?.company,
          firstName: this.profileInfo?.firstName,
          lastName: this.profileInfo?.lastName,
          fileName: this.generatedDocuments.cvFileName
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        const isHtml = /^\s*</.test((errorText || '').trim());
        const msg = response.status === 502
          ? 'Service temporarily unavailable (502) during PDF generation.'
          : (!isHtml && errorText ? errorText : `PDF generation failed (${response.status})`);
        console.warn('[ATS Tailor] Backend PDF generation failed:', msg);
        return;
      }

      const result = await response.json();
      if (result.pdf) {
        this.generatedDocuments.cvPdf = result.pdf;
        this.generatedDocuments.cvFileName = result.fileName || this.generatedDocuments.cvFileName;
        console.log('[ATS Tailor] PDF regenerated via backend:', result.fileName);
      }
    } catch (error) {
      console.error('[ATS Tailor] Backend PDF generation failed:', error);
    }
  }

  downloadDocument(type) {
    const doc = type === 'cv' ? this.generatedDocuments.cvPdf : this.generatedDocuments.coverPdf;
    const textDoc = type === 'cv' ? this.generatedDocuments.cv : this.generatedDocuments.coverLetter;
    const filename = type === 'cv' 
      ? (this.generatedDocuments.cvFileName || `${this.profileInfo?.firstName || 'Applicant'}_${this.profileInfo?.lastName || ''}_CV.pdf`.replace(/_+/g, '_'))
      : (this.generatedDocuments.coverFileName || `${this.profileInfo?.firstName || 'Applicant'}_${this.profileInfo?.lastName || ''}_Cover_Letter.pdf`.replace(/_+/g, '_'));
    
    if (doc) {
      const blob = this.base64ToBlob(doc, 'application/pdf');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      this.showToast('Downloaded!', 'success');
    } else if (textDoc) {
      const blob = new Blob([textDoc], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename.replace('.pdf', '.txt');
      a.click();
      URL.revokeObjectURL(url);
      this.showToast('Downloaded!', 'success');
    } else {
      this.showToast('No document available', 'error');
    }
  }

  base64ToBlob(base64, type) {
    const byteCharacters = atob(base64);
    const byteArray = new Uint8Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteArray[i] = byteCharacters.charCodeAt(i);
    }
    return new Blob([byteArray], { type });
  }

  async attachDocument(type) {
    const doc = type === 'cv' ? this.generatedDocuments.cvPdf : this.generatedDocuments.coverPdf;
    const textDoc = type === 'cv' ? this.generatedDocuments.cv : this.generatedDocuments.coverLetter;
    const filename =
      type === 'cv'
        ? this.generatedDocuments.cvFileName || `${this.profileInfo?.firstName || 'Applicant'}_${this.profileInfo?.lastName || ''}_CV.pdf`.replace(/_+/g, '_')
        : this.generatedDocuments.coverFileName || `${this.profileInfo?.firstName || 'Applicant'}_${this.profileInfo?.lastName || ''}_Cover_Letter.pdf`.replace(/_+/g, '_');

    if (!doc && !textDoc) {
      this.showToast('No document available', 'error');
      return;
    }

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('No active tab');

      const res = await new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(
          tab.id,
          {
            action: 'attachDocument',
            type,
            pdf: doc,
            text: textDoc,
            filename,
          },
          (response) => {
            const err = chrome.runtime.lastError;
            if (err) return reject(new Error(err.message || 'Send message failed'));
            resolve(response);
          }
        );
      });

      if (res?.success && res?.skipped) {
        this.showToast(res.message || 'Skipped (no upload field)', 'success');
        return;
      }

      if (res?.success) {
        this.showToast(`${type === 'cv' ? 'CV' : 'Cover Letter'} attached!`, 'success');
        return;
      }

      this.showToast(res?.message || 'Failed to attach document', 'error');
    } catch (error) {
      console.error('Attach error:', error);
      this.showToast(error?.message || 'Failed to attach document', 'error');
    }
  }

  async attachBothDocuments() {
    this.showToast('Attaching documents...', 'success');
    
    try {
      // SEQUENTIAL ATTACH: Same proven method as ats-tailor-extension both attach
      // Step 1: Attach CV first
      await this.attachDocument('cv');
      
      // Step 2: Wait 500ms for UI to settle (prevents race conditions)
      await new Promise(r => setTimeout(r, 500));
      
      // Step 3: Attach Cover Letter
      await this.attachDocument('cover');
      
      this.showToast('Both documents attached!', 'success');
    } catch (error) {
      console.error('[ATS Tailor] attachBothDocuments error:', error);
      this.showToast(error.message || 'Failed to attach documents', 'error');
    }
  }

  showToast(message, type = 'success') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // ============ KEYWORD HISTORY & COMPARISON FEATURE ============

  /**
   * Save extracted keywords to history for skill gap analysis
   * @param {Object} keywords - Extracted keywords object
   */
  async saveKeywordsToHistory(keywords) {
    if (!keywords?.all?.length || !this.currentJob) return;
    
    try {
      const historyEntry = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        jobTitle: this.currentJob.title || 'Unknown Position',
        company: this.currentJob.company || 'Unknown Company',
        url: this.currentJob.url || '',
        keywords: {
          all: keywords.all,
          highPriority: keywords.highPriority || [],
          mediumPriority: keywords.mediumPriority || [],
          lowPriority: keywords.lowPriority || []
        }
      };
      
      // Get existing history
      const result = await chrome.storage.local.get(['ats_keyword_history']);
      const history = result.ats_keyword_history || [];
      
      // Add new entry and keep last 20 job postings
      history.unshift(historyEntry);
      if (history.length > 20) history.pop();
      
      await chrome.storage.local.set({ ats_keyword_history: history });
      console.log('[ATS Tailor] Saved keywords to history:', historyEntry.jobTitle);
    } catch (error) {
      console.warn('[ATS Tailor] Failed to save keyword history:', error);
    }
  }

  /**
   * Get keyword history for comparison
   * @returns {Promise<Array>} Keyword history entries
   */
  async getKeywordHistory() {
    const result = await chrome.storage.local.get(['ats_keyword_history']);
    return result.ats_keyword_history || [];
  }

  /**
   * Compare keywords between multiple job postings to identify skill gaps
   * @param {Array<string>} entryIds - IDs of history entries to compare
   * @returns {Object} Comparison results with common keywords and gaps
   */
  async compareKeywords(entryIds = []) {
    const history = await this.getKeywordHistory();
    
    // If no IDs provided, compare all entries
    const entries = entryIds.length > 0
      ? history.filter(h => entryIds.includes(h.id))
      : history;
    
    if (entries.length < 2) {
      return { 
        error: 'Need at least 2 job postings to compare',
        entries: entries.length 
      };
    }
    
    // Count keyword frequency across all jobs
    const keywordFrequency = new Map();
    const keywordJobs = new Map();
    
    for (const entry of entries) {
      const allKeywords = entry.keywords?.all || [];
      for (const kw of allKeywords) {
        const kwLower = kw.toLowerCase();
        keywordFrequency.set(kwLower, (keywordFrequency.get(kwLower) || 0) + 1);
        
        if (!keywordJobs.has(kwLower)) {
          keywordJobs.set(kwLower, []);
        }
        keywordJobs.get(kwLower).push(entry.jobTitle);
      }
    }
    
    // Categorize keywords by frequency
    const totalJobs = entries.length;
    const commonKeywords = []; // Appears in 70%+ of jobs
    const frequentKeywords = []; // Appears in 40-69% of jobs
    const rareKeywords = []; // Appears in <40% of jobs
    
    for (const [keyword, count] of keywordFrequency.entries()) {
      const ratio = count / totalJobs;
      const keywordInfo = {
        keyword,
        count,
        percentage: Math.round(ratio * 100),
        jobs: keywordJobs.get(keyword)
      };
      
      if (ratio >= 0.7) {
        commonKeywords.push(keywordInfo);
      } else if (ratio >= 0.4) {
        frequentKeywords.push(keywordInfo);
      } else {
        rareKeywords.push(keywordInfo);
      }
    }
    
    // Sort by frequency
    commonKeywords.sort((a, b) => b.count - a.count);
    frequentKeywords.sort((a, b) => b.count - a.count);
    rareKeywords.sort((a, b) => b.count - a.count);
    
    // Identify skill gaps (common keywords user might be missing)
    const userSkills = new Set(
      (this.generatedDocuments?.cv || '').toLowerCase().split(/\W+/)
    );
    
    const skillGaps = commonKeywords
      .filter(k => !userSkills.has(k.keyword))
      .slice(0, 15);
    
    return {
      totalJobsCompared: totalJobs,
      commonKeywords: commonKeywords.slice(0, 20),
      frequentKeywords: frequentKeywords.slice(0, 15),
      rareKeywords: rareKeywords.slice(0, 10),
      skillGaps,
      summary: {
        totalUniqueKeywords: keywordFrequency.size,
        coreSkillsCount: commonKeywords.length,
        gapsIdentified: skillGaps.length
      }
    };
  }

  /**
   * Show skill gap analysis modal
   */
  async showSkillGapAnalysis() {
    try {
      const comparison = await this.compareKeywords();
      
      if (comparison.error) {
        this.showToast(comparison.error, 'error');
        return;
      }
      
      // Build and show results
      const gapsList = comparison.skillGaps.map(g => g.keyword).join(', ') || 'None identified';
      const commonList = comparison.commonKeywords.slice(0, 10).map(k => k.keyword).join(', ');
      
      console.log('[ATS Tailor] Skill Gap Analysis:', comparison);
      this.showToast(
        `Analyzed ${comparison.totalJobsCompared} jobs. ${comparison.summary.gapsIdentified} potential skill gaps found.`,
        'success'
      );
      
      // Store comparison for UI display
      this.lastComparison = comparison;
      
      return comparison;
    } catch (error) {
      console.error('[ATS Tailor] Skill gap analysis error:', error);
      this.showToast('Failed to analyze skill gaps', 'error');
    }
  }

  /**
   * Show skill gap analysis panel with results
   */
  async showSkillGapPanel() {
    const panel = document.getElementById('skillGapPanel');
    const btn = document.getElementById('skillGapBtn');
    
    if (btn) {
      btn.disabled = true;
      btn.querySelector('.btn-text').textContent = 'Analyzing...';
    }
    
    try {
      const comparison = await this.showSkillGapAnalysis();
      
      if (!comparison || comparison.error) {
        // Check if we have any history
        const history = await this.getKeywordHistory();
        if (history.length < 2) {
          this.showToast('Tailor at least 2 different job postings first to compare skills', 'error');
          return;
        }
        return;
      }
      
      // Populate core skills
      const coreChips = document.getElementById('coreSkillsChips');
      if (coreChips) {
        coreChips.innerHTML = comparison.commonKeywords
          .map(k => `<span class="skill-chip core" title="Found in ${k.percentage}% of jobs">${this.escapeHtml(k.keyword)} <span class="chip-count">${k.count}</span></span>`)
          .join('');
      }
      
      // Populate skill gaps
      const gapsChips = document.getElementById('gapsChips');
      if (gapsChips) {
        if (comparison.skillGaps.length > 0) {
          gapsChips.innerHTML = comparison.skillGaps
            .map(k => `<span class="skill-chip gap" title="In-demand skill missing from your CV">${this.escapeHtml(k.keyword)} <span class="chip-count">${k.percentage}%</span></span>`)
            .join('');
        } else {
          gapsChips.innerHTML = '<span class="no-gaps">Great! No significant skill gaps detected.</span>';
        }
      }
      
      // Update summary
      const summary = document.getElementById('skillGapSummary');
      if (summary) {
        summary.innerHTML = `<p>Analyzed <strong>${comparison.totalJobsCompared} job postings</strong>. Found <strong>${comparison.summary.totalUniqueKeywords}</strong> unique keywords with <strong>${comparison.summary.coreSkillsCount}</strong> appearing frequently.</p>`;
      }
      
      // Show panel
      if (panel) {
        panel.classList.remove('hidden');
        panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      
    } catch (error) {
      console.error('[ATS Tailor] Show skill gap panel error:', error);
      this.showToast('Failed to analyze skills', 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.querySelector('.btn-text').textContent = 'Skill Gap Analysis';
      }
    }
  }

  /**
   * Hide skill gap analysis panel
   */
  hideSkillGapPanel() {
    const panel = document.getElementById('skillGapPanel');
    if (panel) {
      panel.classList.add('hidden');
    }
  }
}

/**
 * Injected function to extract job information from the current page
 * Runs in page context - self-contained with no external dependencies
 */
function extractJobInfoFromPageInjected() {
  const result = {
    title: '',
    company: '',
    location: '',
    description: '',
    url: window.location.href
  };

  try {
    const host = window.location.hostname.toLowerCase();

    // --- Helper: get text from first matching selector ---
    const getText = (...selectors) => {
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el?.textContent?.trim()) return el.textContent.trim();
      }
      return '';
    };

    // --- Greenhouse ---
    if (host.includes('greenhouse')) {
      result.title = getText('h1.app-title', '.job-title h1', 'h1[class*="job"]', '.posting-headline h1', 'h1');
      result.company = getText('.company-name', '[class*="company"]') || document.querySelector('meta[property="og:site_name"]')?.content || '';
      result.location = getText('.location', '[class*="location"]', '.posting-categories .location');
      // Greenhouse uses #content or .content for full JD
      result.description = getText('#content', '.content', '.posting-content', '.job-post-content', '[class*="description"]', 'main');
    }
    // --- Workday / myworkdayjobs ---
    else if (host.includes('workday') || host.includes('myworkdayjobs')) {
      result.title = getText('[data-automation-id="jobPostingHeader"] h2', 'h2[data-automation-id="jobTitle"]', '[data-automation-id="jobPostingTitle"]', 'h1', 'h2');
      result.company = getText('[data-automation-id="company"]') || document.querySelector('meta[property="og:site_name"]')?.content || '';
      result.location = getText('[data-automation-id="locations"]', '[data-automation-id="location"]', '[class*="location"]');
      // Workday stores JD in data-automation-id="jobPostingDescription" or a large container
      const descEl = document.querySelector('[data-automation-id="jobPostingDescription"]');
      if (descEl) {
        result.description = descEl.innerText || descEl.textContent || '';
      } else {
        // Fallback: grab largest text block
        const main = document.querySelector('main') || document.querySelector('[role="main"]') || document.body;
        result.description = main.innerText?.substring(0, 15000) || '';
      }
    }
    // --- SmartRecruiters ---
    else if (host.includes('smartrecruiters')) {
      result.title = getText('h1.job-title', 'h1[class*="title"]', 'h1');
      result.company = getText('.company-name', '[class*="company"]');
      result.location = getText('.job-location', '[class*="location"]');
      result.description = getText('.job-description', '.job-sections', '[class*="description"]', 'main');
    }
    // --- Workable ---
    else if (host.includes('workable')) {
      result.title = getText('h1[data-ui="job-title"]', 'h1');
      result.company = getText('[data-ui="company-name"]', '.company-name');
      result.location = getText('[data-ui="job-location"]', '.job-location');
      result.description = getText('[data-ui="job-description"]', '.job-description', 'main');
    }
    // --- Teamtailor ---
    else if (host.includes('teamtailor')) {
      result.title = getText('h1.job-title', 'h1');
      result.company = getText('.company-name', '[class*="company"]') || document.querySelector('meta[property="og:site_name"]')?.content || '';
      result.location = getText('.location', '[class*="location"]');
      result.description = getText('.job-ad-body', '.job-body', '.description', 'main');
    }
    // --- iCIMS ---
    else if (host.includes('icims')) {
      result.title = getText('.iCIMS_Header h1', 'h1.title', 'h1');
      result.company = getText('.iCIMS_CompanyName', '[class*="company"]');
      result.location = getText('.iCIMS_JobLocation', '[class*="location"]');
      result.description = getText('.iCIMS_JobContent', '.iCIMS_MainWrapper', 'main');
    }
    // --- Bullhorn ---
    else if (host.includes('bullhorn')) {
      result.title = getText('h1.job-title', 'h1');
      result.company = getText('.company-name');
      result.location = getText('.job-location', '[class*="location"]');
      result.description = getText('.job-description', '.job-details', 'main');
    }
    // --- Oracle / Taleo ---
    else if (host.includes('oracle') || host.includes('taleo')) {
      result.title = getText('h1.job-title', 'h1');
      result.company = getText('.company-name') || document.querySelector('meta[property="og:site_name"]')?.content || '';
      result.location = getText('.job-location', '[class*="location"]');
      result.description = getText('.job-description', '#requisitionDescriptionInterface', 'main');
    }
    // --- Generic fallback ---
    else {
      result.title = getText('h1') || document.title.split('|')[0].split('-')[0].trim();
      result.company = document.querySelector('meta[property="og:site_name"]')?.content || '';
      result.location = getText('[class*="location"]', '[data-testid*="location"]');
      result.description = getText('main', 'article', '[class*="description"]', '#content', '[role="main"]');
    }

    // --- Fallback: Meta tags ---
    if (!result.title) {
      result.title = document.querySelector('meta[property="og:title"]')?.content || document.title;
    }
    if (!result.description || result.description.length < 100) {
      // Try grabbing full body text as last resort
      const fallbackDesc = document.querySelector('meta[property="og:description"]')?.content ||
                           document.querySelector('meta[name="description"]')?.content || '';
      if (fallbackDesc.length > result.description.length) {
        result.description = fallbackDesc;
      }
      // If still short, grab main content
      if (result.description.length < 200) {
        const mainEl = document.querySelector('main') || document.querySelector('[role="main"]') || document.body;
        result.description = (mainEl.innerText || mainEl.textContent || '').substring(0, 15000);
      }
    }

    // --- JSON-LD structured data ---
    const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of jsonLdScripts) {
      try {
        let data = JSON.parse(script.textContent);
        // Handle arrays
        if (Array.isArray(data)) data = data.find(d => d['@type'] === 'JobPosting');
        if (data?.['@type'] === 'JobPosting') {
          if (!result.title && data.title) result.title = data.title;
          if (!result.company && data.hiringOrganization?.name) result.company = data.hiringOrganization.name;
          if (!result.location) {
            const loc = data.jobLocation;
            if (loc?.address?.addressLocality) {
              result.location = loc.address.addressLocality;
              if (loc.address.addressRegion) result.location += ', ' + loc.address.addressRegion;
            } else if (typeof loc === 'string') {
              result.location = loc;
            }
          }
          if ((!result.description || result.description.length < 200) && data.description) {
            // Strip HTML from structured data description
            const temp = document.createElement('div');
            temp.innerHTML = data.description;
            const cleanDesc = temp.textContent || temp.innerText || '';
            if (cleanDesc.length > result.description.length) result.description = cleanDesc;
          }
          break;
        }
      } catch (e) {}
    }

    // --- Additional Company Fallbacks ---
    if (!result.company || result.company.toLowerCase() === 'company' || result.company.length < 2) {
      // Try to extract from title like "Senior Engineer at Bugcrowd"
      const titleMatch = (result.title || document.title || '').match(/\bat\s+([A-Z][A-Za-z0-9\s&.-]+?)(?:\s*[-|]|\s*$)/i);
      if (titleMatch) result.company = titleMatch[1].trim();
    }
    if (!result.company || result.company.toLowerCase() === 'company' || result.company.length < 2) {
      // Try URL subdomain (e.g., bugcrowd.greenhouse.io → Bugcrowd)
      const subdomain = host.split('.')[0];
      if (subdomain && subdomain.length > 2 && !['www', 'apply', 'jobs', 'careers', 'boards', 'job-boards'].includes(subdomain.toLowerCase())) {
        result.company = subdomain.charAt(0).toUpperCase() + subdomain.slice(1);
      }
    }
    if (!result.company || result.company.toLowerCase() === 'company' || result.company.length < 2) {
      // Look for company logo alt text
      const logoEl = document.querySelector('[class*="logo"] img, [class*="company"] img, header img');
      if (logoEl?.alt && logoEl.alt.length > 2 && logoEl.alt.length < 50) {
        result.company = logoEl.alt.replace(/\s*logo\s*/i, '').trim();
      }
    }
    // Sanitize company name
    if (result.company) {
      result.company = result.company.replace(/\s*(careers|jobs|hiring|apply|work|join)\s*$/i, '').trim();
    }
    // Final fallback
    if (!result.company || result.company.toLowerCase() === 'company' || result.company.length < 2) {
      result.company = 'the company';
    }

    // --- Cleanup ---
    result.title = result.title.replace(/\s+/g, ' ').trim().substring(0, 200);
    result.company = result.company.replace(/\s+/g, ' ').trim().substring(0, 100);
    result.location = result.location.replace(/\s+/g, ' ').trim().substring(0, 100);
    result.description = result.description.replace(/\s+/g, ' ').trim().substring(0, 15000);

  } catch (error) {
    console.error('[ATS Tailor] Extraction error:', error);
  }

  return result;
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new ATSTailor();
});
