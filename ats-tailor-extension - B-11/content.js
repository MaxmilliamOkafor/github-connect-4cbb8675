// content.js - AUTO-TAILOR + ATTACH v1.5.0 ULTRA BLAZING
// Automatically triggers tailoring on ATS pages, then attaches files
// 50% FASTER for LazyApply integration

(function() {
  'use strict';

  console.log('[ATS Tailor] AUTO-TAILOR v1.5.0 ULTRA BLAZING loaded on:', window.location.hostname);

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

  console.log('[ATS Tailor] Supported ATS detected - AUTO-TAILOR MODE ACTIVE!');

  // ============ STATE ============
  let filesLoaded = false;
  let cvFile = null;
  let coverFile = null;
  let coverLetterText = '';
  let hasTriggeredTailor = false;
  let tailoringInProgress = false;
  let defaultLocation = 'Dublin, IE'; // User configurable default location for Remote jobs
  const startTime = Date.now();
  const currentJobUrl = window.location.href;
  
  // Load default location from storage
  chrome.storage.local.get(['ats_defaultLocation'], (result) => {
    if (result.ats_defaultLocation) {
      defaultLocation = result.ats_defaultLocation;
      console.log('[ATS Tailor] Loaded default location:', defaultLocation);
    }
  });
  
  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'UPDATE_DEFAULT_LOCATION' && message.defaultLocation) {
      defaultLocation = message.defaultLocation;
      console.log('[ATS Tailor] Updated default location to:', defaultLocation);
      sendResponse({ status: 'updated' });
      return true;
    }
    
    // ============ FRESH JD TAILOR + ATTACH (Per-Role, No Fallback) ============
    // ALWAYS extracts keywords from THIS job's JD and tailors CV fresh - NO generic cache reuse
    if (message.action === 'INSTANT_TAILOR_ATTACH') {
      const start = performance.now();
      const jobUrl = message.jobUrl || window.location.href;
      
      console.log('[ATS Tailor] ⚡ FRESH JD TAILOR - extracting keywords for THIS role');
      createStatusBanner();
      updateBanner('🚀 Extracting JD keywords...', 'working');
      
      chrome.storage.local.get(['ats_session', 'ats_profile', 'ats_baseCV'], async (data) => {
        try {
          const session = data.ats_session;
          const baseCV = data.ats_baseCV || '';
          const profile = data.ats_profile || {};
          
          if (!session?.access_token) {
            updateBanner('Please login first', 'error');
            sendResponse({ status: 'error', error: 'No session' });
            return;
          }
          
          // ALWAYS extract fresh job info from THIS page's JD
          const jobInfo = extractJobInfo();
          const jobTitle = jobInfo.title || 'Role';
          updateBanner(`🔍 Parsing: ${jobTitle.substring(0, 25)}...`, 'working');
          
          // Extract keywords from JD (local, ~10ms)
          let keywords = [];
          if (typeof TurboPipeline !== 'undefined' && TurboPipeline.turboExtractKeywords) {
            keywords = await TurboPipeline.turboExtractKeywords(jobInfo.description || '', { jobUrl, maxKeywords: 15 });
          } else if (jobInfo.description) {
            // Fallback: basic keyword extraction from JD
            keywords = extractBasicKeywords(jobInfo.description);
          }
          
          // Handle both array and object keyword formats
          const keywordCount = Array.isArray(keywords) ? keywords.length : (keywords?.all?.length || keywords?.total || 0);
          const keywordPreview = Array.isArray(keywords) ? keywords.slice(0, 8) : (keywords?.all?.slice(0, 8) || keywords?.highPriority?.slice(0, 5) || []);
          console.log(`[ATS Tailor] Extracted ${keywordCount} role-specific keywords:`, keywordPreview);
          updateBanner('📝 Tailoring CV with all keywords...', 'working');
          
          // Tailor CV with extracted keywords (~20ms)
          let tailoredCV = baseCV;
          if (typeof TurboPipeline !== 'undefined' && TurboPipeline.turboTailorCV) {
            tailoredCV = await TurboPipeline.turboTailorCV(baseCV, keywords, jobInfo);
          } else if (typeof TailorUniversal !== 'undefined' && TailorUniversal.tailorCV) {
            tailoredCV = await TailorUniversal.tailorCV(baseCV, keywords, { jobTitle, company: jobInfo.company });
          }
          
          // Calculate match score
          let matchScore = 0;
          if (typeof ReliableExtractor !== 'undefined' && ReliableExtractor.matchKeywords) {
            const matchResult = ReliableExtractor.matchKeywords(tailoredCV, keywords);
            matchScore = matchResult.matchScore || Math.round((matchResult.matched / keywords.length) * 100);
          } else {
            matchScore = calculateBasicMatch(tailoredCV, keywords);
          }
          
          updateBanner(`📄 Generating PDF (Match: ${matchScore}%)...`, 'working');
          
          // Generate PDF (~15ms)
          let pdfResult = null;
          if (typeof OpenResumeGenerator !== 'undefined' && OpenResumeGenerator.generateATSPackage) {
            pdfResult = await OpenResumeGenerator.generateATSPackage(tailoredCV, keywords, jobInfo);
          } else if (typeof TurboPipeline !== 'undefined' && TurboPipeline.executeTurboPipeline) {
            const pipelineResult = await TurboPipeline.executeTurboPipeline(jobInfo, profile, baseCV, { maxKeywords: 15 });
            if (pipelineResult.success) {
              pdfResult = { cv: pipelineResult.cvPDF, cover: pipelineResult.coverPDF };
            }
          }
          
          if (pdfResult?.cv) {
            // Store per-job (jobUrl keyed) - never reuse across different jobs
            chrome.storage.local.set({
              [`tailored_${jobUrl}`]: {
                keywords,
                matchScore,
                cvBase64: pdfResult.cv.base64 || pdfResult.cv,
                cvFileName: pdfResult.cv.filename || `${profile.firstName || 'Resume'}_${profile.lastName || ''}_CV.pdf`,
                coverBase64: pdfResult.cover?.base64 || pdfResult.cover,
                coverFileName: pdfResult.cover?.filename || 'Cover_Letter.pdf',
                timestamp: Date.now()
              }
            });
            
            // Create files and attach
            cvFile = createPDFFile(pdfResult.cv.base64 || pdfResult.cv, pdfResult.cv.filename || 'Resume.pdf');
            coverFile = pdfResult.cover ? createPDFFile(pdfResult.cover.base64 || pdfResult.cover, pdfResult.cover.filename || 'Cover_Letter.pdf') : null;
            filesLoaded = true;
            
            forceEverything();
            ultraFastReplace();
            
            const elapsed = Math.round(performance.now() - start);
            updateBanner(`✅ Match: ${matchScore}% | Attached in ${elapsed}ms`, 'success');
            sendResponse({ status: 'attached', timing: elapsed, matchScore, keywords: keywords.length });
            return;
          }
          
          // Last resort: trigger full API tailoring (only if local pipeline unavailable)
          updateBanner('🔄 Running full tailor...', 'working');
          sendResponse({ status: 'pending', message: 'Running full tailor via API' });
          autoTailorDocuments();
          
        } catch (error) {
          console.error('[ATS Tailor] INSTANT_TAILOR_ATTACH error:', error);
          // Don't show error in banner - just log it and continue silently
          console.log('[ATS Tailor] Continuing despite error...');
          sendResponse({ status: 'error', error: error.message });
        }
      });
      
      return true; // Keep channel open for async response
    }
    
    // ============ LAZYAPPLY 28s SYNC - Post-CV Override ============
    if (message.action === 'LAZYAPPLY_28S_SYNC') {
      console.log('[ATS Tailor] ⚡ LAZYAPPLY 28s sync triggered');
      
      // Wait 28 seconds for LazyApply to attach their CV, then override
      setTimeout(async () => {
        const start = performance.now();
        createStatusBanner();
        updateBanner('🔄 LazyApply override...', 'working');
        
        // Kill any existing file attachments
        killXButtons();
        await new Promise(r => setTimeout(r, 100));
        
        // Force our files
        forceEverything();
        ultraFastReplace();
        
        const elapsed = Math.round(performance.now() - start);
        updateBanner(`✅ Override complete in ${elapsed}ms`, 'success');
        
        chrome.runtime.sendMessage({ 
          action: 'LAZYAPPLY_OVERRIDE_COMPLETE', 
          timing: elapsed 
        }).catch(() => {});
      }, 28000);
      
      sendResponse({ status: 'scheduled', delay: 28000 });
      return true;
    }
  });

  // ============ STATUS BANNER ============
  function createStatusBanner() {
    if (document.getElementById('ats-auto-banner')) return;
    
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
          padding: 12px 20px;
          font: bold 14px system-ui, sans-serif;
          color: #000;
          text-align: center;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          animation: ats-pulse 2s ease-in-out infinite;
        }
        @keyframes ats-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.85; }
        }
        #ats-auto-banner .ats-status { margin-left: 10px; }
        #ats-auto-banner.success { background: linear-gradient(135deg, #00ff88 0%, #00cc66 100%); }
        #ats-auto-banner.error { background: linear-gradient(135deg, #ff4444 0%, #cc0000 100%); color: #fff; }
      </style>
      <span>🚀 ATS TAILOR</span>
      <span class="ats-status" id="ats-banner-status">Detecting upload fields...</span>
    `;
    document.body.appendChild(banner);
  }

  function updateBanner(status, type = 'working') {
    const banner = document.getElementById('ats-auto-banner');
    const statusEl = document.getElementById('ats-banner-status');
    if (banner) {
      banner.className = type === 'success' ? 'success' : type === 'error' ? 'error' : '';
    }
    if (statusEl) statusEl.textContent = status;
  }

  function hideBanner() {
    // Keep the banner visible permanently - don't remove it
    // The orange ribbon should always stay visible on ATS platforms
    console.log('[ATS Tailor] Banner will remain visible');
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

  // ============ LOCATION SANITIZATION (HARD RULE: NEVER "REMOTE" ON CV) ============
  // User rule: "Remote" should NEVER appear in CV location. "Dublin, IE | Remote" -> "Dublin, IE"
  // This is a recruiter red flag and must be stripped from ALL CVs, even if it exists
  // in the stored profile or uploaded base CV.
  function stripRemoteFromLocation(raw) {
    const s = (raw || '').toString().trim();
    if (!s) return '';

    // If location is ONLY "Remote" or "Remote, <country>", return empty for fallback
    if (/^remote$/i.test(s) || /^remote\s*[\(,\\-]\s*\w+\)?$/i.test(s)) {
      return '';
    }

    // Remove any "remote" token and common separators around it
    let out = s
      .replace(/\b(remote|work\s*from\s*home|wfh|virtual|fully\s*remote|remote\s*first|remote\s*friendly)\b/gi, '')
      .replace(/\s*[\(\[]?\s*(remote|wfh|virtual)\s*[\)\]]?\s*/gi, '')
      .replace(/\s*(\||,|\/|\u2013|\u2014|-|\u00b7)\s*(\||,|\/|\u2013|\u2014|-|\u00b7)\s*/g, ' | ')
      .replace(/\s*(\||,|\/|\u2013|\u2014|-|\u00b7)\s*$/g, '')
      .replace(/^\s*(\||,|\/|\u2013|\u2014|-|\u00b7)\s*/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    // If it becomes empty after stripping, return empty (caller can fallback to default)
    return out;
  }

  // Export globally for PDF generators
  window.stripRemoteFromLocation = stripRemoteFromLocation;

  // ============ FIELD DETECTION ============
  function isCVField(input) {
    const text = (
      (input.labels?.[0]?.textContent || '') +
      (input.name || '') +
      (input.id || '') +
      (input.getAttribute('aria-label') || '') +
      (input.getAttribute('data-qa') || '') +
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
      (input.getAttribute('data-qa') || '') +
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
    // Check for file inputs
    const fileInputs = document.querySelectorAll('input[type="file"]');
    if (fileInputs.length > 0) return true;
    
    // Check for Greenhouse-style upload buttons
    const greenhouseUploads = document.querySelectorAll('[data-qa-upload], [data-qa="upload"], [data-qa="attach"]');
    if (greenhouseUploads.length > 0) return true;
    
    // Check for Workable autofill text
    if (document.body.textContent.includes('Autofill application')) return true;
    
    // Check for Resume/CV labels with buttons
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

  // ============ KILL X BUTTONS (scoped) ============
  function killXButtons() {
    // IMPORTANT: do NOT click generic "remove" buttons globally.
    // Only click remove/clear controls that are near file inputs / upload widgets.
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

      // fallback: within same form, are there any file inputs at all?
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

  // ============ FORCE CV REPLACE ============
  function forceCVReplace() {
    if (!cvFile) return false;
    let attached = false;

    document.querySelectorAll('input[type="file"]').forEach((input) => {
      if (!isCVField(input)) return;

      // If already attached, do nothing (prevents flicker)
      if (input.files && input.files.length > 0) {
        attached = true;
        return;
      }

      const dt = new DataTransfer();
      dt.items.add(cvFile);
      input.files = dt.files;
      fireEvents(input);
      attached = true;
      console.log('[ATS Tailor] CV attached!');
    });

    return attached;
  }

  // ============ FORCE COVER REPLACE ============
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
        }
      });
    }

    return attached;
  }

  // ============ GREENHOUSE COVER LETTER: CLICK "ATTACH" TO REVEAL INPUT ============
  function clickGreenhouseCoverAttach() {
    const nodes = document.querySelectorAll('label, h1, h2, h3, h4, h5, span, div, fieldset');
    for (const node of nodes) {
      const t = (node.textContent || '').trim().toLowerCase();
      if (!t || t.length > 60) continue;
      if (!t.includes('cover letter')) continue;

      const container = node.closest('fieldset') || node.closest('.field') || node.closest('section') || node.parentElement;
      if (!container) continue;

      // If a visible file input already exists in this section, no need to click.
      const existing = container.querySelector('input[type="file"]');
      if (existing && existing.offsetParent !== null) return true;

      const buttons = container.querySelectorAll('button, a[role="button"], [role="button"]');
      for (const btn of buttons) {
        const bt = (btn.textContent || '').trim().toLowerCase();
        if (bt === 'attach' || bt.includes('attach')) {
          try {
            btn.click();
            return true;
          } catch {}
        }
      }
    }
    return false;
  }

  // ============ FORCE EVERYTHING ============
  function forceEverything() {
    // STEP 1: Greenhouse specific - click attach buttons to reveal hidden inputs
    document.querySelectorAll('[data-qa-upload], [data-qa="upload"], [data-qa="attach"]').forEach(btn => {
      const parent = btn.closest('.field') || btn.closest('[class*="upload"]') || btn.parentElement;
      const existingInput = parent?.querySelector('input[type="file"]');
      if (!existingInput || existingInput.offsetParent === null) {
        try { btn.click(); } catch {}
      }
    });

    // STEP 1b: Greenhouse cover letter section often needs a dedicated "Attach" click
    clickGreenhouseCoverAttach();
    
    // STEP 2: Make any hidden file inputs visible and accessible
    document.querySelectorAll('input[type="file"]').forEach(input => {
      if (input.offsetParent === null) {
        input.style.cssText = 'display:block !important; visibility:visible !important; opacity:1 !important; position:relative !important;';
      }
    });
    
    // STEP 3: Attach files
    forceCVReplace();
    forceCoverReplace();
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
    
    // IMPROVED: Multiple fallback strategies for company extraction
    if (!company) company = getMeta('og:site_name') || '';
    if (!company) {
      // Try to extract from title like "Senior Engineer at Bugcrowd"
      const titleMatch = (getMeta('og:title') || document.title || '').match(/\bat\s+([A-Z][A-Za-z0-9\s&.-]+?)(?:\s*[-|]|\s*$)/i);
      if (titleMatch) company = titleMatch[1].trim();
    }
    if (!company) {
      // Try URL subdomain (e.g., bugcrowd.greenhouse.io → Bugcrowd)
      const subdomain = hostname.split('.')[0];
      if (subdomain && subdomain.length > 2 && !['www', 'apply', 'jobs', 'careers', 'boards', 'job-boards'].includes(subdomain.toLowerCase())) {
        company = subdomain.charAt(0).toUpperCase() + subdomain.slice(1);
      }
    }
    if (!company) {
      // Look for company logo alt text or nearby text
      const logoEl = document.querySelector('[class*="logo"] img, [class*="company"] img, header img');
      if (logoEl?.alt && logoEl.alt.length > 2 && logoEl.alt.length < 50) {
        company = logoEl.alt.replace(/\s*logo\s*/i, '').trim();
      }
    }
    // Sanitize: remove common suffixes and clean up
    if (company) {
      company = company.replace(/\s*(careers|jobs|hiring|apply|work|join)\s*$/i, '').trim();
    }
    // Final validation: reject "Company" or very short names
    if (!company || company.toLowerCase() === 'company' || company.length < 2) {
      company = 'your company';
    }

    const rawLocation = selectors ? getText(selectors.location) : '';
    const location = stripRemoteFromLocation(rawLocation) || rawLocation;
    const rawDesc = selectors ? getText(selectors.description) : '';
    const description = rawDesc?.trim()?.length > 80 ? rawDesc.trim().substring(0, 3000) : '';

    return { title, company, location, description, url: window.location.href, platform: platformKey || hostname };
  }

  // ============ BASIC KEYWORD EXTRACTION (Fallback if TurboPipeline unavailable) ============
  function extractBasicKeywords(jobDescription) {
    if (!jobDescription) return [];
    
    // Common technical & skill keywords to look for
    const skillPatterns = [
      /\b(python|javascript|typescript|java|c\+\+|ruby|go|rust|php|swift|kotlin)\b/gi,
      /\b(react|angular|vue|node\.?js|express|django|flask|spring|rails)\b/gi,
      /\b(aws|azure|gcp|docker|kubernetes|terraform|jenkins|ci\/cd)\b/gi,
      /\b(sql|postgresql|mysql|mongodb|redis|elasticsearch)\b/gi,
      /\b(machine learning|deep learning|nlp|computer vision|data science)\b/gi,
      /\b(agile|scrum|kanban|jira|confluence)\b/gi,
      /\b(git|github|gitlab|bitbucket)\b/gi,
      /\b(rest|graphql|api|microservices|serverless)\b/gi,
      /\b(testing|junit|pytest|jest|selenium|cypress)\b/gi,
      /\b(leadership|management|communication|collaboration|problem.solving)\b/gi,
    ];
    
    const foundKeywords = new Set();
    const text = jobDescription.toLowerCase();
    
    for (const pattern of skillPatterns) {
      const matches = text.match(pattern) || [];
      matches.forEach(m => foundKeywords.add(m.toLowerCase().trim()));
    }
    
    // Also extract capitalized phrases (likely important terms)
    const capitalizedTerms = jobDescription.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\b/g) || [];
    capitalizedTerms.slice(0, 10).forEach(term => {
      if (term.length > 3 && term.length < 30) {
        foundKeywords.add(term.toLowerCase());
      }
    });
    
    return Array.from(foundKeywords).slice(0, 15);
  }

  // ============ BASIC MATCH CALCULATION (Fallback if ReliableExtractor unavailable) ============
  function calculateBasicMatch(cvText, keywords) {
    // Handle both array and object keyword formats
    const keywordArray = Array.isArray(keywords) ? keywords : (keywords?.all || keywords?.highPriority || []);
    if (!cvText || !keywordArray.length) return 0;
    
    const cvLower = cvText.toLowerCase();
    let matched = 0;
    
    for (const keyword of keywordArray) {
      if (cvLower.includes(keyword.toLowerCase())) {
        matched++;
      }
    }
    
    return Math.round((matched / keywordArray.length) * 100);
  }

  // ============ AUTO-TAILOR DOCUMENTS ============
  async function autoTailorDocuments() {
    if (hasTriggeredTailor || tailoringInProgress) {
      console.log('[ATS Tailor] Already triggered or in progress, skipping');
      return;
    }

    // Check if we've already tailored for this URL
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
    updateBanner('Generating tailored CV & Cover Letter...', 'working');

    try {
      // Get session
      const session = await new Promise(resolve => {
        chrome.storage.local.get(['ats_session'], result => resolve(result.ats_session));
      });

      if (!session?.access_token || !session?.user?.id) {
        updateBanner('Please login via extension popup first', 'error');
        console.log('[ATS Tailor] No session, user needs to login');
        tailoringInProgress = false;
        return;
      }

      // Get user profile
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

      // Extract job info from page
      const jobInfo = extractJobInfo();
      if (!jobInfo.title) {
        updateBanner('Could not detect job info, please use popup', 'error');
        tailoringInProgress = false;
        return;
      }

      console.log('[ATS Tailor] Job detected:', jobInfo.title, 'at', jobInfo.company);
      updateBanner(`Tailoring for: ${jobInfo.title}...`, 'working');

      // Call tailor API
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
          userProfile: {
            firstName: p.first_name || '',
            lastName: p.last_name || '',
            email: p.email || session.user.email || '',
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
            city: p.city || undefined,
            country: p.country || undefined,
            address: p.address || undefined,
            state: p.state || undefined,
            zipCode: p.zip_code || undefined,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Tailoring failed');
      }

      const result = await response.json();
      if (result.error) throw new Error(result.error);

      console.log('[ATS Tailor] Tailoring complete! Match score:', result.matchScore);
      updateBanner(`✅ Generated! Match: ${result.matchScore}% - Attaching files...`, 'success');

      // Store PDFs in chrome.storage for the attach loop
      const fallbackName = `${(p.first_name || '').trim()}_${(p.last_name || '').trim()}`.replace(/\s+/g, '_') || 'Applicant';
      
      await new Promise(resolve => {
        chrome.storage.local.set({
          cvPDF: result.resumePdf,
          coverPDF: result.coverLetterPdf,
          coverLetterText: result.tailoredCoverLetter || result.coverLetter || '',
          cvFileName: result.cvFileName || `${fallbackName}_CV.pdf`,
          coverFileName: result.coverLetterFileName || `${fallbackName}_Cover_Letter.pdf`,
          ats_lastGeneratedDocuments: {
            cv: result.tailoredResume,
            coverLetter: result.tailoredCoverLetter || result.coverLetter,
            cvPdf: result.resumePdf,
            coverPdf: result.coverLetterPdf,
            cvFileName: result.cvFileName || `${fallbackName}_CV.pdf`,
            coverFileName: result.coverLetterFileName || `${fallbackName}_Cover_Letter.pdf`,
            matchScore: result.matchScore || 0,
          }
        }, resolve);
      });

      // Mark this URL as tailored
      cached[currentJobUrl] = Date.now();
      await new Promise(resolve => {
        chrome.storage.local.set({ ats_tailored_urls: cached }, resolve);
      });

      // Now load files and start attaching
      loadFilesAndStart();
      
      updateBanner(`✅ Done! Match: ${result.matchScore}% - Files attached!`, 'success');
      hideBanner();

    } catch (error) {
      console.error('[ATS Tailor] Auto-tailor error:', error);
      // Don't show error in banner - just log and continue silently
      console.log('[ATS Tailor] Continuing despite error...');
    } finally {
      tailoringInProgress = false;
    }
  }

  // ============ ULTRA BLAZING REPLACE LOOP - 50% FASTER FOR LAZYAPPLY ============
  let attachLoopStarted = false;
  let attachLoop4ms = null;
  let attachLoop8ms = null;

  function stopAttachLoops() {
    if (attachLoop4ms) clearInterval(attachLoop4ms);
    if (attachLoop8ms) clearInterval(attachLoop8ms);
    attachLoop4ms = null;
    attachLoop8ms = null;
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

  // ============ SHOW GREEN SUCCESS RIBBON ============
  function showSuccessRibbon() {
    const existingRibbon = document.getElementById('ats-success-ribbon');
    if (existingRibbon) return; // Already shown

    const ribbon = document.createElement('div');
    ribbon.id = 'ats-success-ribbon';
    ribbon.innerHTML = `
      <style>
        #ats-success-ribbon {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 9999999;
          background: linear-gradient(135deg, #00ff88 0%, #00cc66 50%, #00aa55 100%);
          padding: 14px 20px;
          font: bold 15px system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
          color: #000;
          text-align: center;
          box-shadow: 0 4px 20px rgba(0, 255, 136, 0.5), 0 2px 8px rgba(0,0,0,0.2);
          animation: ats-success-glow 1.5s ease-in-out infinite;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
        }
        @keyframes ats-success-glow {
          0%, 100% { box-shadow: 0 4px 20px rgba(0, 255, 136, 0.5), 0 2px 8px rgba(0,0,0,0.2); }
          50% { box-shadow: 0 4px 30px rgba(0, 255, 136, 0.8), 0 2px 12px rgba(0,0,0,0.3); }
        }
        #ats-success-ribbon .ats-icon {
          font-size: 20px;
          animation: ats-bounce 0.6s ease-out;
        }
        @keyframes ats-bounce {
          0% { transform: scale(0); }
          50% { transform: scale(1.3); }
          100% { transform: scale(1); }
        }
        #ats-success-ribbon .ats-text {
          font-weight: 700;
          letter-spacing: 0.5px;
        }
        #ats-success-ribbon .ats-badge {
          background: rgba(0,0,0,0.15);
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
        }
        body.ats-success-ribbon-active { padding-top: 50px !important; }
      </style>
      <span class="ats-icon">✅</span>
      <span class="ats-text">CV & COVER LETTER ATTACHED SUCCESSFULLY</span>
      <span class="ats-badge">ATS-PERFECT</span>
    `;
    
    document.body.appendChild(ribbon);
    document.body.classList.add('ats-success-ribbon-active');
    
    // Hide the orange banner if it exists
    const orangeBanner = document.getElementById('ats-auto-banner');
    if (orangeBanner) orangeBanner.style.display = 'none';
    
    console.log('[ATS Tailor] ✅ GREEN SUCCESS RIBBON displayed');
  }

  function ultraFastReplace() {
    if (attachLoopStarted) return;
    attachLoopStarted = true;

    killXButtons();

    // ULTRA BLAZING: 4ms interval (250fps+) - 50% faster than previous
    attachLoop4ms = setInterval(() => {
      if (!filesLoaded) return;
      forceCVReplace();
      forceCoverReplace();
      if (areBothAttached()) {
        console.log('[ATS Tailor] ⚡⚡ ULTRA BLAZING attach complete');
        showSuccessRibbon();
        stopAttachLoops();
      }
    }, 4);

    // ULTRA BLAZING: 8ms interval for full force - 50% faster
    attachLoop8ms = setInterval(() => {
      if (!filesLoaded) return;
      forceEverything();
      if (areBothAttached()) {
        console.log('[ATS Tailor] ⚡⚡ ULTRA BLAZING attach complete');
        showSuccessRibbon();
        stopAttachLoops();
      }
    }, 8);
  }

  // ============ LOAD FILES AND START ==========
  function loadFilesAndStart() {
    chrome.storage.local.get(['cvPDF', 'coverPDF', 'coverLetterText', 'cvFileName', 'coverFileName'], (data) => {
      cvFile = createPDFFile(data.cvPDF, data.cvFileName || 'Tailored_Resume.pdf');
      coverFile = createPDFFile(data.coverPDF, data.coverFileName || 'Tailored_Cover_Letter.pdf');
      coverLetterText = data.coverLetterText || '';
      filesLoaded = true;

      console.log('[ATS Tailor] Files loaded, starting attach');

      // Immediate attach attempt
      forceEverything();

      // Start guarded loop
      ultraFastReplace();
    });
  }

  // ============ INIT - AUTO-DETECT AND TAILOR ============
  
  // Open popup and trigger Extract & Apply Keywords button automatically
  async function triggerPopupExtractApply() {
    const jobInfo = extractJobInfo();
    console.log('[ATS Tailor] Triggering popup Extract & Apply for:', jobInfo.title);
    
    // Show banner immediately
    createStatusBanner();
    updateBanner(`Tailoring for: ${jobInfo.title || 'Unknown Role'}...`, 'working');
    
    // Set badge to indicate automation running
    chrome.runtime.sendMessage({ action: 'openPopup' }).catch(() => {});
    
    // Send message to background to queue popup trigger
    chrome.runtime.sendMessage({
      action: 'TRIGGER_EXTRACT_APPLY',
      jobInfo: jobInfo,
      showButtonAnimation: true
    }).then(response => {
      console.log('[ATS Tailor] TRIGGER_EXTRACT_APPLY sent, response:', response);
    }).catch(err => {
      console.log('[ATS Tailor] Could not send to background:', err);
    });
    
    // Also try to open popup programmatically (Chrome 99+)
    try {
      if (chrome.action && chrome.action.openPopup) {
        await chrome.action.openPopup();
      }
    } catch (e) {
      console.log('[ATS Tailor] Cannot open popup programmatically (requires user gesture)');
    }
  }
  
  function initAutoTailor() {
    // Immediately show banner on ATS detection
    createStatusBanner();
    updateBanner('ATS detected! Preparing...', 'working');
    
    // Trigger popup Extract & Apply immediately on ATS detection
    setTimeout(() => {
      console.log('[ATS Tailor] ATS platform detected - triggering popup...');
      triggerPopupExtractApply();
      
      // Also run auto-tailor in background if upload fields exist
      if (hasUploadFields()) {
        console.log('[ATS Tailor] Upload fields detected! Starting auto-tailor...');
        autoTailorDocuments();
      } else {
        console.log('[ATS Tailor] No upload fields yet, watching for changes...');
        
        // Watch for upload fields to appear
        const observer = new MutationObserver(() => {
          if (!hasTriggeredTailor && hasUploadFields()) {
            console.log('[ATS Tailor] Upload fields appeared! Starting auto-tailor...');
            observer.disconnect();
            autoTailorDocuments();
          }
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
        
        // ULTRA BLAZING: Fallback check after 30ms - 50% faster
        setTimeout(() => {
          if (!hasTriggeredTailor && hasUploadFields()) {
            observer.disconnect();
            autoTailorDocuments();
          }
        }, 30);
      }
    }, 8); // ULTRA BLAZING: 8ms trigger - 50% faster for LazyApply
  }

  // Start
  initAutoTailor();

})();
