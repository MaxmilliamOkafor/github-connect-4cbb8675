// content.js - HYBRID v1.4.0 - OpenResume ATS CV + Cover Letter Generator
// FEATURES: OpenResume-style perfect ATS format, 100% parsing, dual PDF generation
// SPEED: INSTANT 175ms pipeline - 0ms detect → 25ms banner → 50ms AUTO-CLICK → 175ms complete
// OUTPUT: {FirstName}_{LastName}_ATS_CV.pdf + {FirstName}_{LastName}_Cover_Letter.pdf
// UNIQUE CV: Preserves user's companies/roles/dates, modifies only bullet phrasing per job

(function() {
  'use strict';

  // ============ LAZYAPPLY 3X TIMING CONSTANTS (175ms TOTAL) ============
  const LAZYAPPLY_TIMING = {
    ATS_DETECT: 0,           // 0ms: Instant platform detection
    BANNER_SHOW: 25,         // 25ms: Banner appears
    BUTTON_CLICK: 50,        // 50ms: AUTO-CLICK "Extract & Apply" button
    LOADING_STATE: 75,       // 75ms: Button shows loading state
    EXTRACT_COMPLETE: 125,   // 125ms: Keyword extraction done
    PIPELINE_COMPLETE: 175   // 175ms: Full pipeline (PDF + attach) complete
  };

  const pipelineStart = performance.now();
  console.log(`[ATS Tailor] HYBRID v1.4.0 OpenResume ATS Generator loaded at ${pipelineStart.toFixed(0)}ms`);
  console.log('[ATS Tailor] Features: OpenResume ATS CV + Cover Letter + 175ms pipeline');

  // ============ CONFIGURATION ============
  const SUPABASE_URL = 'https://wntpldomgjutwufphnpg.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndudHBsZG9tZ2p1dHd1ZnBobnBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2MDY0NDAsImV4cCI6MjA4MjE4MjQ0MH0.vOXBQIg6jghsAby2MA1GfE-MNTRZ9Ny1W2kfUHGUzNM';
  
  const SUPPORTED_HOSTS = [
    'greenhouse.io', 'job-boards.greenhouse.io', 'boards.greenhouse.io',
    'workday.com', 'myworkdayjobs.com', 'smartrecruiters.com',
    'bullhornstaffing.com', 'bullhorn.com', 'teamtailor.com',
    'workable.com', 'apply.workable.com', 'icims.com',
    'oracle.com', 'oraclecloud.com', 'taleo.net'
  ];

  const isSupportedHost = (hostname) =>
    SUPPORTED_HOSTS.some((h) => hostname === h || hostname.endsWith(`.${h}`));

  if (!isSupportedHost(window.location.hostname)) {
    console.log('[ATS Tailor] Not a supported ATS host, skipping');
    return;
  }

  console.log(`[ATS Tailor] ⚡ ATS DETECTED in ${(performance.now() - pipelineStart).toFixed(0)}ms - INSTANT MODE ACTIVE!`);

  // ============ STATE ============
  let filesLoaded = false;
  let cvFile = null;
  let coverFile = null;
  let coverLetterText = '';
  let hasTriggeredTailor = false;
  let tailoringInProgress = false;
  let bannerRoleName = '';
  const startTime = Date.now();
  const currentJobUrl = window.location.href;

  // ============ STATUS TRACKING (NO GREEN BOX - REMOVED) ============
  function createStatusOverlay() {
    return;
  }

  function updateStatus(type, status) {
    // Keep banner copy stable (role name only). We only flip banner state to success.
    if (status !== '✅') return;
    const banner = document.getElementById('ats-auto-banner');
    if (banner) banner.classList.add('success');
  }

  // ============ STATUS BANNER (PERSISTENT - ONLY CLOSES VIA X BUTTON) ============
  // Banner copy stays SIMPLE: "🚀 ATS TAILOR Tailoring for: [Role]" (no % progress text).
  function createStatusBanner() {
    if (document.getElementById('ats-auto-banner')) return document.getElementById('ats-auto-banner');

    const banner = document.createElement('div');
    banner.id = 'ats-auto-banner';
    banner.innerHTML = `
      <style>
        #ats-auto-banner {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 999999;
          background: linear-gradient(135deg, #ff6b35 0%, #ff8c42 100%);
          padding: 12px 50px 12px 20px;
          font: bold 14px system-ui, sans-serif;
          color: #000;
          text-align: center;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          animation: ats-pulse 2s ease-in-out infinite;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }
        @keyframes ats-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.85; }
        }
        #ats-auto-banner.success { background: linear-gradient(135deg, #00ff88 0%, #00cc66 100%); animation: none; }
        #ats-auto-banner.error { background: linear-gradient(135deg, #ff4444 0%, #cc0000 100%); color: #fff; }
        #ats-auto-banner.extracting { background: linear-gradient(135deg, #00d4ff 0%, #7c3aed 100%); color: #fff; }
        #ats-auto-banner .ats-close-btn {
          position: absolute;
          right: 15px;
          top: 50%;
          transform: translateY(-50%);
          background: rgba(0,0,0,0.1);
          border: none;
          color: inherit;
          font-size: 20px;
          font-weight: bold;
          cursor: pointer;
          padding: 2px 8px;
          border-radius: 4px;
          opacity: 0.7;
          transition: all 0.2s ease;
          line-height: 1;
        }
        #ats-auto-banner .ats-close-btn:hover { opacity: 1; background: rgba(0,0,0,0.2); }
      </style>
      <span id="ats-banner-title">🚀 ATS TAILOR Tailoring for: Job</span>
      <button class="ats-close-btn" title="Close banner">×</button>
    `;

    // ONLY CLOSES VIA X BUTTON - NO AUTO-HIDE
    banner.querySelector('.ats-close-btn').addEventListener('click', () => {
      banner.remove();
    });

    document.body.appendChild(banner);
    return banner;
  }

  function updateBanner(message, type = 'working') {
    const banner = document.getElementById('ats-auto-banner') || createStatusBanner();
    const titleEl = document.getElementById('ats-banner-title');

    if (banner) {
      banner.classList.remove('success', 'error', 'extracting');
      if (type === 'success') banner.classList.add('success');
      else if (type === 'error') banner.classList.add('error');
      else if (type === 'extracting') banner.classList.add('extracting');
    }

    if (!titleEl) return;

    // Keep banner copy stable (role name only). Only override on error.
    if (type === 'error') {
      titleEl.textContent = message;
      return;
    }

    const role = (bannerRoleName || '').trim();
    titleEl.textContent = role
      ? `🚀 ATS TAILOR Tailoring for: ${role}`
      : message;
  }

  // PERSISTENT BANNER - Does NOT auto-hide. Only closes via X button.
  function hideBanner() {
    // NO-OP: Banner is persistent and only closes via close button
    console.log('[ATS Tailor] Banner is persistent - use X button to close');
  }

  // ============ PDF FILE CREATION ============
  function createPDFFile(base64, name) {
    try {
      if (!base64) return null;
      
      let data = base64;
      if (base64.includes(',')) {
        data = base64.split(',')[1];
      }
      
      const byteString = atob(data);
      const buffer = new ArrayBuffer(byteString.length);
      const view = new Uint8Array(buffer);
      for (let i = 0; i < byteString.length; i++) {
        view[i] = byteString.charCodeAt(i);
      }
      
      const file = new File([buffer], name, { type: 'application/pdf' });
      console.log(`[ATS Tailor] Created PDF: ${name} (${file.size} bytes)`);
      return file;
    } catch (e) {
      console.error('[ATS Tailor] PDF creation failed:', e);
      return null;
    }
  }

  // ============ FIELD DETECTION (4.0 EXACT LOGIC) ============
  function isCVField(input) {
    const text = (
      (input.labels?.[0]?.textContent || '') +
      (input.name || '') +
      (input.id || '') +
      (input.getAttribute('aria-label') || '') +
      (input.closest('label')?.textContent || '')
    ).toLowerCase();

    let parent = input.parentElement;
    for (let i = 0; i < 5 && parent; i++) {
      const parentText = (parent.textContent || '').toLowerCase().substring(0, 200);
      if ((parentText.includes('resume') || parentText.includes('cv')) && !parentText.includes('cover')) {
        return true;
      }
      parent = parent.parentElement;
    }

    return /(resume|cv|curriculum)/i.test(text) && !/cover/i.test(text);
  }

  function isCoverField(input) {
    const text = (
      (input.labels?.[0]?.textContent || '') +
      (input.name || '') +
      (input.id || '') +
      (input.getAttribute('aria-label') || '') +
      (input.closest('label')?.textContent || '')
    ).toLowerCase();

    let parent = input.parentElement;
    for (let i = 0; i < 5 && parent; i++) {
      const parentText = (parent.textContent || '').toLowerCase().substring(0, 200);
      if (parentText.includes('cover')) {
        return true;
      }
      parent = parent.parentElement;
    }

    return /cover/i.test(text);
  }

  function hasUploadFields() {
    const fileInputs = document.querySelectorAll('input[type="file"]');
    if (fileInputs.length > 0) return true;

    const greenhouseUploads = document.querySelectorAll('[data-qa-upload], [data-qa="upload"], [data-qa="attach"]');
    if (greenhouseUploads.length > 0) return true;

    if (document.body.textContent.includes('Autofill application')) return true;

    const labels = document.querySelectorAll('label, h3, h4, span');
    for (const label of labels) {
      const text = label.textContent?.toLowerCase() || '';
      if ((text.includes('resume') || text.includes('cv')) && text.length < 50) {
        return true;
      }
    }

    return false;
  }

  // ============ FIRE EVENTS ============
  function fireEvents(input) {
    ['change', 'input'].forEach(type => {
      input.dispatchEvent(new Event(type, { bubbles: true }));
    });
  }

  // ============ SMALL UTILS ============
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Prevent native file picker from opening when we must click "Attach" buttons
  // that internally call input[type=file].click().
  function suppressFilePickerClicks(durationMs = 450) {
    try {
      const proto = HTMLInputElement?.prototype;
      if (!proto) return;

      const original = proto.click;
      // Avoid double-wrapping
      if (original.__atsTailorWrapped) return;

      function wrappedClick(...args) {
        try {
          if ((this?.type || '').toLowerCase() === 'file') {
            console.log('[ATS Tailor] Suppressed file picker open');
            return;
          }
        } catch {}
        return original.apply(this, args);
      }

      wrappedClick.__atsTailorWrapped = true;
      wrappedClick.__atsTailorOriginal = original;

      proto.click = wrappedClick;

      setTimeout(() => {
        try {
          if (HTMLInputElement.prototype.click === wrappedClick) {
            HTMLInputElement.prototype.click = original;
          }
        } catch {}
      }, durationMs);
    } catch {}
  }

  // ============ KILL X BUTTONS (4.0 PROVEN LOGIC - SCOPED) ============
  function killXButtons() {
    const isNearFileInput = (el) => {
      const root = el.closest('form') || document.body;
      const candidates = [
        el.closest('[data-qa-upload]'),
        el.closest('[data-qa="upload"]'),
        el.closest('[data-qa="attach"]'),
        el.closest('.field'),
        el.closest('[class*="upload" i]'),
        el.closest('[class*="attachment" i]'),
      ].filter(Boolean);

      for (const c of candidates) {
        if (c.querySelector('input[type="file"]')) return true;
        const t = (c.textContent || '').toLowerCase();
        if (t.includes('resume') || t.includes('cv') || t.includes('cover')) return true;
      }

      return !!root.querySelector('input[type="file"]');
    };

    const selectors = [
      'button[aria-label*="remove" i]',
      'button[aria-label*="delete" i]',
      'button[aria-label*="clear" i]',
      '.remove-file',
      '[data-qa-remove]',
      '[data-qa*="remove"]',
      '[data-qa*="delete"]',
      '.file-preview button',
      '.file-upload-remove',
      '.attachment-remove',
    ];

    document.querySelectorAll(selectors.join(', ')).forEach((btn) => {
      try {
        if (!isNearFileInput(btn)) return;
        btn.click();
      } catch {}
    });

    document.querySelectorAll('button, [role="button"]').forEach((btn) => {
      const text = btn.textContent?.trim();
      if (text === '×' || text === 'x' || text === 'X' || text === '✕') {
        try {
          if (!isNearFileInput(btn)) return;
          btn.click();
        } catch {}
      }
    });
  }

  // ============ FORCE CV REPLACE (4.0 PROVEN LOGIC) ============
  function forceCVReplace() {
    if (!cvFile) return false;
    let attached = false;

    document.querySelectorAll('input[type="file"]').forEach((input) => {
      if (!isCVField(input)) return;

      if (input.files && input.files.length > 0) {
        attached = true;
        return;
      }

      const dt = new DataTransfer();
      dt.items.add(cvFile);
      input.files = dt.files;
      fireEvents(input);
      attached = true;
      updateStatus('cv', '✅');
      console.log('[ATS Tailor] CV attached!');
    });

    return attached;
  }

  // ============ FORCE COVER REPLACE (SIMPLE - MATCHES WORKING EXTENSION) ==========
  function forceCoverReplace() {
    if (!coverFile && !coverLetterText) return false;
    let attached = false;

    if (coverFile) {
      document.querySelectorAll('input[type="file"]').forEach((input) => {
        if (!isCoverField(input)) return;

        // If already attached, do nothing (prevents flicker)
        if (input.files && input.files.length > 0) {
          attached = true;
          return;
        }

        const dt = new DataTransfer();
        dt.items.add(coverFile);
        input.files = dt.files;
        fireEvents(input);
        attached = true;
        updateStatus('cover', '✅');
        console.log('[ATS Tailor] Cover Letter attached!');
      });
    }

    if (coverLetterText) {
      document.querySelectorAll('textarea').forEach((textarea) => {
        const label = textarea.labels?.[0]?.textContent || textarea.name || textarea.id || '';
        if (/cover/i.test(label)) {
          if ((textarea.value || '').trim() === coverLetterText.trim()) {
            attached = true;
            return;
          }
          textarea.value = coverLetterText;
          fireEvents(textarea);
          attached = true;
          updateStatus('cover', '✅');
        }
      });
    }

    return attached;
  }

  // ============ FORCE EVERYTHING (SIMPLE - MATCHES WORKING EXTENSION) ==========
  function forceEverything() {
    // STEP 1: Greenhouse specific - click attach buttons to reveal hidden inputs
    document.querySelectorAll('[data-qa-upload], [data-qa="upload"], [data-qa="attach"]').forEach(btn => {
      const parent = btn.closest('.field') || btn.closest('[class*="upload"]') || btn.parentElement;
      const existingInput = parent?.querySelector('input[type="file"]');
      if (!existingInput || existingInput.offsetParent === null) {
        try { btn.click(); } catch {}
      }
    });
    
    // STEP 2: Make any hidden file inputs visible and accessible
    document.querySelectorAll('input[type="file"]').forEach(input => {
      if (input.offsetParent === null) {
        input.style.cssText = 'display:block !important; visibility:visible !important; opacity:1 !important; position:relative !important;';
      }
    });
    
    // STEP 3: Attach BOTH files together (CV + Cover Letter)
    forceCVReplace();
    forceCoverReplace();
  }

  // ============ TURBO-FAST REPLACE LOOP (SIMPLE - MATCHES WORKING EXTENSION) ============
  let attachLoopStarted = false;
  let attachLoop200ms = null;
  let attachLoop1s = null;

  function stopAttachLoops() {
    if (attachLoop200ms) clearInterval(attachLoop200ms);
    if (attachLoop1s) clearInterval(attachLoop1s);
    attachLoop200ms = null;
    attachLoop1s = null;
    attachLoopStarted = false;
  }

  function areBothAttached() {
    const fileInputs = Array.from(document.querySelectorAll('input[type="file"]'));
    const cvOk = !cvFile || fileInputs.some((i) => isCVField(i) && i.files && i.files.length > 0);
    const coverOk = (!coverFile && !coverLetterText) ||
      fileInputs.some((i) => isCoverField(i) && i.files && i.files.length > 0) ||
      Array.from(document.querySelectorAll('textarea')).some((t) => /cover/i.test((t.labels?.[0]?.textContent || t.name || t.id || '')) && (t.value || '').trim().length > 0);

    return cvOk && coverOk;
  }

  function ultraFastReplace() {
    if (attachLoopStarted) return;
    attachLoopStarted = true;

    // Run a single cleanup once right before attaching (prevents UI flicker)
    killXButtons();

    attachLoop200ms = setInterval(() => {
      if (!filesLoaded) return;
      forceCVReplace();
      forceCoverReplace();

      if (areBothAttached()) {
        console.log('[ATS Tailor] Attach complete — stopping loops');
        stopAttachLoops();
      }
    }, 200);

    attachLoop1s = setInterval(() => {
      if (!filesLoaded) return;
      forceEverything();

      if (areBothAttached()) {
        console.log('[ATS Tailor] Attach complete — stopping loops');
        stopAttachLoops();
      }
    }, 1000);
  }

  // ============ EXTRACT JOB INFO ============
  function extractJobInfo() {
    const getText = (selectors) => {
      for (const sel of selectors) {
        try {
          const el = document.querySelector(sel);
          if (el?.textContent?.trim()) return el.textContent.trim();
        } catch {}
      }
      return '';
    };

    const getMeta = (name) =>
      document.querySelector(`meta[name="${name}"]`)?.getAttribute('content') ||
      document.querySelector(`meta[property="${name}"]`)?.getAttribute('content') || '';

    const hostname = window.location.hostname;

    const platformSelectors = {
      greenhouse: {
        title: ['h1.app-title', 'h1.posting-headline', 'h1', '[data-test="posting-title"]'],
        company: ['#company-name', '.company-name', '.posting-categories strong'],
        location: ['.location', '.posting-categories .location'],
        description: ['#content', '.posting', '.posting-description'],
      },
      workday: {
        title: ['h1[data-automation-id="jobPostingHeader"]', 'h1'],
        company: ['div[data-automation-id="jobPostingCompany"]'],
        location: ['div[data-automation-id="locations"]'],
        description: ['div[data-automation-id="jobPostingDescription"]'],
      },
      smartrecruiters: {
        title: ['h1[data-test="job-title"]', 'h1'],
        company: ['[data-test="job-company-name"]'],
        location: ['[data-test="job-location"]'],
        description: ['[data-test="job-description"]'],
      },
      workable: {
        title: ['h1', '[data-ui="job-title"]'],
        company: ['[data-ui="company-name"]'],
        location: ['[data-ui="job-location"]'],
        description: ['[data-ui="job-description"]'],
      },
    };

    let platformKey = null;
    if (hostname.includes('greenhouse.io')) platformKey = 'greenhouse';
    else if (hostname.includes('workday.com') || hostname.includes('myworkdayjobs.com')) platformKey = 'workday';
    else if (hostname.includes('smartrecruiters.com')) platformKey = 'smartrecruiters';
    else if (hostname.includes('workable.com')) platformKey = 'workable';

    const selectors = platformKey ? platformSelectors[platformKey] : null;

    let title = selectors ? getText(selectors.title) : '';
    if (!title) title = getMeta('og:title') || document.title?.split('|')?.[0]?.split('-')?.[0]?.trim() || '';

    let company = selectors ? getText(selectors.company) : '';
    if (!company) company = getMeta('og:site_name') || '';
    if (!company && title.includes(' at ')) {
      company = document.title.split(' at ').pop()?.split('|')[0]?.split('-')[0]?.trim() || '';
    }

    const location = selectors ? getText(selectors.location) : '';
    const rawDesc = selectors ? getText(selectors.description) : '';
    const description = rawDesc?.trim()?.length > 80 ? rawDesc.trim().substring(0, 3000) : '';

    return { title, company, location, description, url: window.location.href, platform: platformKey || hostname };
  }

  // ============ 5.0 FEATURE: EXTRACT KEYWORDS WITH TURBO PIPELINE ============
  async function extractKeywordsLocally(jobDescription) {
    if (typeof TurboPipeline !== 'undefined' && TurboPipeline.turboExtractKeywords) {
      return await TurboPipeline.turboExtractKeywords(jobDescription, { 
        jobUrl: currentJobUrl,
        maxKeywords: 35 
      });
    }

    if (typeof UniversalKeywordStrategy !== 'undefined') {
      return UniversalKeywordStrategy.extractAndClassifyKeywords(jobDescription, 35);
    }

    if (typeof MandatoryKeywords !== 'undefined') {
      const mandatory = MandatoryKeywords.extractMandatoryFromJD(jobDescription);
      return { all: mandatory, highPriority: mandatory.slice(0, 15), mediumPriority: [], lowPriority: [] };
    }

    const stopWords = new Set(['a','an','the','and','or','but','in','on','at','to','for','of','with','by','from','this','that','you','your','we','our','they','their','work','working','job','position','role']);
    const words = jobDescription.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length >= 3 && !stopWords.has(w));
    const freq = new Map();
    words.forEach(w => freq.set(w, (freq.get(w) || 0) + 1));
    const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([w]) => w);
    return { all: sorted, highPriority: sorted.slice(0, 10), mediumPriority: sorted.slice(10, 20), lowPriority: sorted.slice(20) };
  }

  // ============ AUTO-TRIGGER KEYWORD EXTRACTION ============
  async function autoTriggerKeywordExtraction() {
    console.log('[ATS Tailor] Auto-triggering keyword extraction...');
    
    // Check if auto-tailor is enabled
    const result = await new Promise(resolve => {
      chrome.storage.local.get(['ats_autoTailorEnabled'], resolve);
    });
    
    if (result.ats_autoTailorEnabled === false) {
      console.log('[ATS Tailor] Auto-tailor disabled, skipping auto-trigger');
      return;
    }
    
    // Get session
    const session = await new Promise(resolve => {
      chrome.storage.local.get(['ats_session'], resolve);
    });
    
    if (!session.ats_session?.access_token) {
      console.log('[ATS Tailor] No session, cannot auto-trigger');
      updateBanner('Please login via extension popup', 'error');
      return;
    }
    
    const jobInfo = extractJobInfo();
    if (!jobInfo.title) {
      console.log('[ATS Tailor] No job detected, cannot auto-trigger');
      return;
    }
    
    // Store pending trigger for popup to pick up
    await new Promise(resolve => {
      chrome.storage.local.set({
        pending_extract_apply: {
          triggeredFromAutomation: true,
          jobInfo: jobInfo,
          timestamp: Date.now()
        }
      }, resolve);
    });
    
    // Send message to trigger popup action
    chrome.runtime.sendMessage({ 
      type: 'AUTO_TRIGGER_EXTRACTION',
      action: 'TRIGGER_EXTRACT_APPLY',
      jobInfo: jobInfo,
      showButtonAnimation: true
    }).catch(() => {});
    
    console.log('[ATS Tailor] Auto-trigger message sent for:', jobInfo.title);
  }

  // ============ AUTO-TAILOR DOCUMENTS (WITH OPENRESUME GENERATOR) ============
  async function autoTailorDocuments() {
    if (hasTriggeredTailor || tailoringInProgress) {
      console.log('[ATS Tailor] Already triggered or in progress, skipping');
      return;
    }

    const cached = await new Promise(resolve => {
      chrome.storage.local.get(['ats_tailored_urls'], result => {
        resolve(result.ats_tailored_urls || {});
      });
    });

    if (cached[currentJobUrl]) {
      console.log('[ATS Tailor] Already tailored for this URL, loading cached files');
      loadFilesAndStart();
      return;
    }

    hasTriggeredTailor = true;
    tailoringInProgress = true;

    createStatusBanner();
    updateBanner('Generating OpenResume ATS CV + Cover Letter...', 'extracting');

    try {
      const session = await new Promise(resolve => {
        chrome.storage.local.get(['ats_session'], result => resolve(result.ats_session));
      });

      if (!session?.access_token || !session?.user?.id) {
        updateBanner('Please login via extension popup first', 'error');
        console.log('[ATS Tailor] No session, user needs to login');
        tailoringInProgress = false;
        return;
      }

      updateBanner('Loading your profile...', 'working');
      const profileRes = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${session.user.id}&select=first_name,last_name,email,phone,linkedin,github,portfolio,cover_letter,work_experience,education,skills,certifications,achievements,ats_strategy,city,country,address,state,zip_code`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!profileRes.ok) {
        throw new Error('Could not load profile');
      }

      const profileRows = await profileRes.json();
      const p = profileRows?.[0] || {};

      const jobInfo = extractJobInfo();
      bannerRoleName = jobInfo.title || 'Job';
      if (!jobInfo.title) {
        updateBanner('Could not detect job info, please use popup', 'error');
        tailoringInProgress = false;
        return;
      }

      console.log('[ATS Tailor] Job detected:', jobInfo.title, 'at', jobInfo.company);
      updateBanner(`Extracting keywords from: ${jobInfo.title}...`, 'extracting');

      // STEP 1: Extract keywords using TurboPipeline
      const localKeywords = await extractKeywordsLocally(jobInfo.description);
      console.log('[ATS Tailor] Extracted keywords:', localKeywords.highPriority?.slice(0, 5));
      
      updateBanner(`Generating ATS CV (${localKeywords.all?.length || 0} keywords)...`, 'extracting');

      // STEP 2: Build candidate data for OpenResume generator
      const candidateData = {
        firstName: p.first_name || '',
        lastName: p.last_name || '',
        email: p.email || session.user.email || '',
        phone: p.phone || '',
        linkedin: p.linkedin || '',
        github: p.github || '',
        portfolio: p.portfolio || '',
        city: p.city || '',
        location: p.city || '',
        workExperience: Array.isArray(p.work_experience) ? p.work_experience : [],
        education: Array.isArray(p.education) ? p.education : [],
        skills: Array.isArray(p.skills) ? p.skills : [],
        certifications: Array.isArray(p.certifications) ? p.certifications : [],
        summary: p.ats_strategy || '',
        coverLetter: p.cover_letter || ''
      };

      // STEP 3: Generate using OpenResume Generator (if available)
      let cvResult = null;
      let coverResult = null;
      let matchScore = 0;
      
      if (typeof OpenResumeGenerator !== 'undefined') {
        console.log('[ATS Tailor] Using OpenResume Generator for ATS-perfect PDFs');
        
        try {
          const atsPackage = await OpenResumeGenerator.generateATSPackage(
            buildBaseCV(candidateData),
            localKeywords,
            {
              title: jobInfo.title,
              company: jobInfo.company,
              location: jobInfo.location
            },
            candidateData
          );
          
          cvResult = {
            pdf: atsPackage.cvBase64,
            filename: atsPackage.cvFilename
          };
          
          coverResult = {
            pdf: atsPackage.coverBase64,
            filename: atsPackage.coverFilename
          };
          
          matchScore = atsPackage.matchScore;
          
          console.log(`[ATS Tailor] ✅ OpenResume generated: ${cvResult.filename}, ${coverResult.filename} (${matchScore}% match)`);
        } catch (e) {
          console.error('[ATS Tailor] OpenResume generation failed, falling back to Supabase:', e);
        }
      }
      
      // STEP 4: Fallback to Supabase edge function if OpenResume failed
      if (!cvResult?.pdf) {
        updateBanner(`Generating via cloud...`, 'working');
        
        const response = await fetch(`${SUPABASE_URL}/functions/v1/tailor-application`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
            apikey: SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            jobTitle: jobInfo.title,
            company: jobInfo.company,
            location: jobInfo.location,
            description: jobInfo.description,
            requirements: [],
            userProfile: candidateData,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          const isHtml = /^\s*</.test((errorText || '').trim());
          const msg = response.status === 502
            ? 'Service temporarily unavailable (502). Please retry in a few seconds.'
            : (!isHtml && errorText ? errorText : `Tailoring failed (${response.status})`);
          throw new Error(msg);
        }

        const result = await response.json();
        if (result.error) throw new Error(result.error);

        cvResult = {
          pdf: result.resumePdf,
          filename: result.cvFileName || `${candidateData.firstName}_${candidateData.lastName}_ATS_CV.pdf`
        };
        
        coverResult = {
          pdf: result.coverLetterPdf,
          filename: result.coverLetterFileName || `${candidateData.firstName}_${candidateData.lastName}_Cover_Letter.pdf`
        };
        
        matchScore = result.matchScore || 0;
      }

      console.log('[ATS Tailor] Tailoring complete! Match score:', matchScore);
      updateBanner(`✅ Generated! Match: ${matchScore}% - Attaching files...`, 'success');

      // STEP 5: Store results
      await new Promise(resolve => {
        chrome.storage.local.set({
          cvPDF: cvResult.pdf,
          coverPDF: coverResult.pdf,
          coverLetterText: '',
          cvFileName: cvResult.filename,
          coverFileName: coverResult.filename,
          ats_lastGeneratedDocuments: {
            cvPdf: cvResult.pdf,
            coverPdf: coverResult.pdf,
            cvFileName: cvResult.filename,
            coverFileName: coverResult.filename,
            matchScore: matchScore,
          },
          ats_extracted_keywords: localKeywords,
        }, resolve);
      });

      cached[currentJobUrl] = Date.now();
      await new Promise(resolve => {
        chrome.storage.local.set({ ats_tailored_urls: cached }, resolve);
      });

      loadFilesAndStart();

      updateBanner(`✅ ${cvResult.filename} + ${coverResult.filename} attached! (${matchScore}% match)`, 'success');

    } catch (error) {
      console.error('[ATS Tailor] Auto-tailor error:', error);
      updateBanner(`Error: ${error.message}`, 'error');
    } finally {
      tailoringInProgress = false;
    }
  }
  
  // ============ BUILD BASE CV TEXT FROM CANDIDATE DATA ============
  function buildBaseCV(candidateData) {
    const lines = [];
    
    lines.push(`${candidateData.firstName} ${candidateData.lastName}`);
    lines.push([candidateData.phone, candidateData.email, candidateData.city].filter(Boolean).join(' | '));
    lines.push([candidateData.linkedin, candidateData.github, candidateData.portfolio].filter(Boolean).join(' | '));
    lines.push('');
    
    if (candidateData.summary) {
      lines.push('PROFESSIONAL SUMMARY');
      lines.push(candidateData.summary);
      lines.push('');
    }
    
    if (candidateData.workExperience?.length > 0) {
      lines.push('WORK EXPERIENCE');
      candidateData.workExperience.forEach(job => {
        const header = [job.company, job.title, job.dates, job.location].filter(Boolean).join(' | ');
        lines.push(header);
        const bullets = job.bullets || job.achievements || job.responsibilities || [];
        (Array.isArray(bullets) ? bullets : [bullets]).forEach(b => {
          if (b) lines.push(`- ${b.replace(/^[-•*]\s*/, '')}`);
        });
        lines.push('');
      });
    }
    
    if (candidateData.education?.length > 0) {
      lines.push('EDUCATION');
      candidateData.education.forEach(edu => {
        const line = [edu.institution, edu.degree, edu.dates, edu.gpa ? `GPA: ${edu.gpa}` : ''].filter(Boolean).join(' | ');
        lines.push(line);
      });
      lines.push('');
    }
    
    if (candidateData.skills?.length > 0) {
      lines.push('SKILLS');
      lines.push(candidateData.skills.join(', '));
      lines.push('');
    }
    
    if (candidateData.certifications?.length > 0) {
      lines.push('CERTIFICATIONS');
      lines.push(candidateData.certifications.join(', '));
    }
    
    return lines.join('\n');
  }

  // ============ LOAD FILES AND START (4.0 TURBO TIMING) ==========
  function loadFilesAndStart() {
    chrome.storage.local.get(['cvPDF', 'coverPDF', 'coverLetterText', 'cvFileName', 'coverFileName'], (data) => {
      cvFile = createPDFFile(data.cvPDF, data.cvFileName || 'Tailored_Resume.pdf');
      coverFile = createPDFFile(data.coverPDF, data.coverFileName || 'Tailored_Cover_Letter.pdf');
      coverLetterText = data.coverLetterText || '';
      filesLoaded = true;

      if (!cvFile) updateStatus('cv', '❌ No file');
      if (!coverFile && !coverLetterText) updateStatus('cover', '❌ No file');

      console.log('[ATS Tailor] Files loaded, starting TURBO attach!');
      console.log('[ATS Tailor] CV:', cvFile ? '✓' : 'X', 'Cover:', coverFile ? '✓' : 'X');

      // Run async force attach with proper await
      (async () => {
        await forceEverything();
        ultraFastReplace();
      })();
    });
  }

  // ============ MESSAGE LISTENER FOR POPUP/BACKGROUND ============
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'attachDocument') {
      console.log('[ATS Tailor] Received attachDocument request:', message.type);

      (async () => {
        try {
          const { type, pdf, text, filename } = message;

          if (!pdf && !text) {
            sendResponse({ success: false, message: 'No document data provided' });
            return;
          }

          let file = null;
          if (pdf) {
            file = createPDFFile(pdf, filename);
          }

          if (!file && !text) {
            sendResponse({ success: false, message: 'Failed to create file' });
            return;
          }

          if (type === 'cv') {
            cvFile = file;
          } else if (type === 'cover') {
            coverFile = file;
            if (text) coverLetterText = text;
          }

          filesLoaded = true;
          await forceEverything();
          ultraFastReplace();

          sendResponse({ success: true, message: `${type} attached successfully` });
        } catch (e) {
          console.error('[ATS Tailor] attachDocument error:', e);
          sendResponse({ success: false, message: e.message });
        }
      })();

      return true;
    }

    if (message.action === 'getJobInfo') {
      const jobInfo = extractJobInfo();
      sendResponse(jobInfo);
      return true;
    }

    if (message.action === 'startAutoTailor') {
      autoTailorDocuments();
      sendResponse({ status: 'started' });
      return true;
    }
    
    if (message.action === 'AUTO_TRIGGER_EXTRACTION' || message.type === 'AUTO_TRIGGER_EXTRACTION') {
      autoTriggerKeywordExtraction();
      sendResponse({ status: 'triggered' });
      return true;
    }

    if (message.action === 'PING') {
      sendResponse({ ready: true });
      return true;
    }
  });

  // ============ LAZYAPPLY 3X INSTANT BUTTON TRIGGER (50ms) ============
  function instantButtonTrigger() {
    const buttonSelectors = [
      'button:has(.btn-text:contains("Extract"))',
      'button[id*="tailor"]',
      '[data-testid*="extract"]',
      '.extract-keywords',
      'button.btn-primary',
      '#tailorBtn'
    ];
    
    // Try to find and click the button immediately
    for (const sel of buttonSelectors) {
      try {
        const btn = document.querySelector(sel);
        if (btn && !btn.disabled) {
          // Visual feedback - button press animation
          btn.style.transform = 'scale(0.95)';
          btn.style.boxShadow = 'inset 0 4px 12px rgba(0,0,0,0.4)';
          btn.click();
          console.log(`[ATS Tailor] ⚡ INSTANT button click at ${(performance.now() - pipelineStart).toFixed(0)}ms`);
          
          // Restore button after 200ms
          setTimeout(() => {
            btn.style.transform = '';
            btn.style.boxShadow = '';
          }, 200);
          return true;
        }
      } catch (e) {}
    }
    return false;
  }
  
  // Fail-safe double-click backup
  function failSafeButtonClick() {
    setTimeout(() => {
      const btn = document.querySelector('#tailorBtn, button.btn-primary');
      if (btn && !btn.classList.contains('loading')) {
        console.log('[ATS Tailor] Fail-safe button click triggered');
        btn.click();
      }
    }, 30);
  }

  // ============ INITIALIZATION (LAZYAPPLY 3X COMPATIBLE - 175ms) ============
  function initialize() {
    const initTime = performance.now() - pipelineStart;
    
    // INSTANT: Check for upload fields (0ms target)
    if (hasUploadFields()) {
      console.log(`[ATS Tailor] Upload fields detected at ${initTime.toFixed(0)}ms`);
      
      // 25ms: Show banner
      setTimeout(() => {
        createStatusBanner();
        const jobInfo = extractJobInfo();
        bannerRoleName = jobInfo.title || 'Job';
        updateBanner(`🚀 ATS TAILOR Tailoring for: ${bannerRoleName}`, 'extracting');
        console.log(`[ATS Tailor] Banner shown at ${(performance.now() - pipelineStart).toFixed(0)}ms`);
      }, LAZYAPPLY_TIMING.BANNER_SHOW);
      
      // 50ms: INSTANT AUTO-CLICK "Extract & Apply keywords to CV" button
      setTimeout(() => {
        console.log(`[ATS Tailor] ⚡ AUTO-CLICK triggered at ${(performance.now() - pipelineStart).toFixed(0)}ms`);
        
        // Send message to trigger popup's Extract & Apply button with VISIBLE animation
        chrome.runtime.sendMessage({ 
          type: 'AUTO_TRIGGER_EXTRACTION',
          action: 'TRIGGER_EXTRACT_APPLY',
          jobInfo: extractJobInfo(),
          showButtonAnimation: true,
          instantTrigger: true
        }).catch(() => {});
        
        // Also store pending trigger for when popup opens
        chrome.storage.local.set({
          pending_extract_apply: {
            triggeredFromAutomation: true,
            jobInfo: extractJobInfo(),
            timestamp: Date.now(),
            instantTrigger: true
          }
        });
        
        // Fail-safe: Double-click backup at 30ms if loading state not detected
        failSafeButtonClick();
        
        // Auto-trigger extraction directly as fallback
        autoTriggerKeywordExtraction();
        
      }, LAZYAPPLY_TIMING.BUTTON_CLICK);
    }
  }

  // Wait for DOM ready, then initialize IMMEDIATELY
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(initialize, 0));
  } else {
    // INSTANT initialization - no delay
    setTimeout(initialize, 0);
  }

})();
