// content.js - AUTO-TAILOR + ATTACH v1.5.0 + WORKDAY FULL FLOW
// Automatically triggers tailoring on ATS pages, then attaches files
// Now includes Workday 4-step automation

(function() {
  'use strict';

  console.log('[ATS Tailor] AUTO-TAILOR v1.6.0 TURBO loaded on:', window.location.hostname);

  // ============ CONFIGURATION ============
  const SUPABASE_URL = 'https://wntpldomgjutwufphnpg.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndudHBsZG9tZ2p1dHd1ZnBobnBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2MDY0NDAsImV4cCI6MjA4MjE4MjQ0MH0.vOXBQIg6jghsAby2MA1GfE-MNTRZ9Ny1W2kfUHGUzNM';
  
  // Workday Credentials (stored in chrome.storage, fallback defaults)
  let WORKDAY_EMAIL = 'Maxokafordev@gmail.com';
  let WORKDAY_PASSWORD = 'May19315park@';
  let WORKDAY_VERIFY_PASSWORD = 'May19315park@';
  
  const SUPPORTED_HOSTS = [
    'greenhouse.io', 'job-boards.greenhouse.io', 'boards.greenhouse.io',
    'workday.com', 'myworkdayjobs.com', 'smartrecruiters.com',
    'bullhornstaffing.com', 'bullhorn.com', 'teamtailor.com',
    'workable.com', 'apply.workable.com', 'icims.com',
    'oracle.com', 'oraclecloud.com', 'taleo.net'
  ];

  // ============ WORKDAY SELECTORS (UPDATED FOR REAL WORKDAY PAGES) ============
  const WORKDAY_SELECTORS = {
    // Apply button selectors - multiple fallbacks for different Workday implementations
    apply: [
      'button[data-automation-id="jobPostingApplyButton"]',
      'a[data-automation-id="jobPostingApplyButton"]',
      '[data-automation-id="applyButton"]',
      'button.css-1ew5k9l', // Common Workday apply button class
      'a[href*="apply"]',
      'button', // Will be filtered by text content
    ],
    manualApply: [
      'button[data-automation-id="applyManually"]',
      '[data-automation-id="manuallyApply"]',
      'button[data-automation-id="continueWithoutLinkedin"]',
      'a[data-automation-id="applyManually"]',
    ],
    email: [
      'input[data-automation-id="email"]',
      'input[data-automation-id="userName"]', 
      'input[name="username"]',
      'input[type="email"]',
      'input[id*="email" i]',
      'input[name*="email" i]',
    ],
    password: [
      'input[data-automation-id="password"]',
      'input[name="password"]',
      'input[type="password"]:not([name*="verify" i]):not([id*="verify" i]):not([placeholder*="verify" i])',
    ],
    signIn: [
      'button[data-automation-id="signInButton"]',
      'button[type="submit"]',
      'input[type="submit"]',
    ],
    createAccountLink: [
      '[data-automation-id="createAccountLink"]',
      'a[href*="createAccount"]',
      'a[href*="create-account"]',
      'button:has-text("Create Account")',
    ],
    // CREATE ACCOUNT PAGE SELECTORS
    createAccountEmail: [
      'input[data-automation-id="email"]',
      'input[name="email"]',
      'input[placeholder*="Email" i]',
      'input[type="email"]',
    ],
    createAccountPassword: [
      'input[data-automation-id="password"]',
      'input[name="password"]',
      'input[placeholder*="Password" i]:not([placeholder*="Verify" i]):not([placeholder*="Confirm" i])',
      'input[type="password"]:first-of-type',
    ],
    verifyPassword: [
      'input[data-automation-id="verifyPassword"]',
      'input[name*="verify" i]',
      'input[name*="confirm" i]',
      'input[placeholder*="Verify" i]',
      'input[placeholder*="Confirm" i]',
      'input[id*="verify" i]',
      'input[id*="confirm" i]',
      'input[type="password"]:last-of-type',
    ],
    consentCheckbox: [
      'input[type="checkbox"][aria-label*="consent" i]',
      'input[type="checkbox"][aria-label*="terms" i]',
      'input[type="checkbox"][aria-label*="read and consent" i]',
      'input[type="checkbox"][name*="consent" i]',
      'input[type="checkbox"][name*="terms" i]',
      'input[type="checkbox"][id*="consent" i]',
      'input[type="checkbox"][id*="terms" i]',
      '[data-automation-id="termsCheckbox"]',
      '[data-automation-id="consentCheckbox"]',
      'label[for*="consent" i] input[type="checkbox"]',
      'label[for*="terms" i] input[type="checkbox"]',
    ],
    createAccountBtn: [
      'button[data-automation-id="createAccountButton"]',
      'button[data-automation-id="createAccountSubmitButton"]',
      'button[aria-label*="Create Account" i]',
      'button.create-account-btn',
      'input[type="submit"][value*="Create" i]',
    ],
    firstName: ['input[data-automation-id="legalNameSection_firstName"]', 'input[data-automation-id="firstName"]', 'input[name*="firstName" i]'],
    lastName: ['input[data-automation-id="legalNameSection_lastName"]', 'input[data-automation-id="lastName"]', 'input[name*="lastName" i]'],
    email2: ['input[data-automation-id="email"]', 'input[name*="email" i]', 'input[type="email"]'],
    phone: ['input[data-automation-id="phone"]', 'input[name*="phone" i]', 'input[type="tel"]'],
    address: ['input[data-automation-id="addressSection_addressLine1"]', 'input[data-automation-id="addressLine1"]', 'input[name*="address" i]'],
    city: ['input[data-automation-id="addressSection_city"]', 'input[data-automation-id="city"]', 'input[name*="city" i]'],
    state: ['select[data-automation-id="addressSection_countryRegion"]', 'select[data-automation-id="state"]', 'input[name*="state" i]'],
    postalCode: ['input[data-automation-id="addressSection_postalCode"]', 'input[data-automation-id="postal"]', 'input[name*="zip" i]', 'input[name*="postal" i]'],
    country: ['select[data-automation-id="addressSection_country"]', 'select[data-automation-id="country"]'],
    continueBtn: [
      'button[data-automation-id="bottom-navigation-next-button"]', 
      'button[data-automation-id="saveAndContinueButton"]',
      'button[aria-label*="Continue" i]',
      'button[aria-label*="Next" i]',
    ],
    saveBtn: ['button[data-automation-id="saveAndContinue"]', 'button[type="submit"]'],
    STOP_AT: ['input[type="file"]', 'textarea[data-automation-id*="cover"]', '[data-automation-id="file-upload"]', 'div[data-automation-id="resumeUpload"]']
  };

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
  let workdayFlowInProgress = false;
  const startTime = Date.now();
  const currentJobUrl = window.location.href;

  // ============ UTILITY FUNCTIONS ============
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function normalizeLocation(text) {
    if (!text) return '';
    if (text.includes('US') || text.includes('United States')) {
      const cityMatch = text.match(/([A-Za-z\s]+),\s*(US|United States)/);
      const city = cityMatch?.[1]?.trim();
      return city ? `${city}, United States` : 'United States';
    }
    return text;
  }

  async function waitForElement(selectors, timeout = 10000, textMatch = null) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      for (const selector of selectors) {
        try {
          // Skip invalid pseudo-selectors that aren't supported in CSS
          if (selector.includes(':has-text(') || selector.includes(':has-text("')) {
            // Handle :has-text as text matching fallback
            const match = selector.match(/(.+?):has-text\(["']?(.+?)["']?\)/);
            if (match) {
              const [, baseSelector, text] = match;
              const elements = document.querySelectorAll(baseSelector || '*');
              for (const el of elements) {
                if (el.textContent?.toLowerCase().includes(text.toLowerCase()) && el.offsetParent !== null) {
                  return el;
                }
              }
            }
            continue;
          }
          // Handle :contains pseudo-selector
          if (selector.includes(':contains(')) {
            const match = selector.match(/(.+?):contains\("(.+?)"\)/);
            if (match) {
              const [, baseSelector, text] = match;
              const elements = document.querySelectorAll(baseSelector || '*');
              for (const el of elements) {
                if (el.textContent?.includes(text) && el.offsetParent !== null) {
                  return el;
                }
              }
            }
            continue;
          }
          
          const elements = document.querySelectorAll(selector);
          for (const el of elements) {
            if (el && el.offsetParent !== null) {
              // If textMatch is provided, check text content
              if (textMatch) {
                const text = el.textContent?.trim().toLowerCase();
                if (text === textMatch.toLowerCase() || text?.includes(textMatch.toLowerCase())) {
                  return el;
                }
              } else {
                return el;
              }
            }
          }
        } catch (e) {
          // Invalid selector - log and skip
          console.warn('[ATS Tailor] Skipping invalid selector:', selector);
        }
      }
      await sleep(200);
    }
    return null;
  }

  async function clickElement(selectors, description = '', textMatch = null) {
    const el = await waitForElement(selectors, 5000, textMatch);
    if (el) {
      console.log(`[ATS Tailor] Clicking: ${description || selectors[0]}`);
      // Try multiple click methods for Workday
      try {
        el.focus();
        el.click();
      } catch (e) {}
      try {
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      } catch (e) {}
      await sleep(800);
      return true;
    }
    console.log(`[ATS Tailor] Could not find: ${description || selectors[0]}`);
    return false;
  }

  async function fillInput(selectors, value, description = '') {
    const el = await waitForElement(selectors, 3000);
    if (el && value) {
      console.log(`[ATS Tailor] Filling: ${description || selectors[0]}`);
      el.focus();
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(200);
      return true;
    }
    return false;
  }

  function isAtResumeSection() {
    for (const selector of WORKDAY_SELECTORS.STOP_AT) {
      const el = document.querySelector(selector);
      if (el && el.offsetParent !== null) return true;
    }
    return false;
  }

  // ============ WORKDAY JOB SCRAPING ============
  function scrapeWorkdayJob() {
    const getText = (selectors) => {
      for (const sel of selectors) {
        try {
          const el = document.querySelector(sel);
          if (el?.textContent?.trim()) return el.textContent.trim();
        } catch {}
      }
      return '';
    };

    const title = getText([
      'h1[data-automation-id="jobPostingHeader"]',
      'h2[data-automation-id="jobPostingHeader"]',
      'h1',
      '[data-automation-id="jobTitle"]'
    ]);

    const company = getText([
      'div[data-automation-id="jobPostingCompany"]',
      '[data-automation-id="companyName"]',
      '.css-1m5e5g2'
    ]) || document.title.split(' at ').pop()?.split('|')[0]?.trim() || '';

    const rawLocation = getText([
      'div[data-automation-id="locations"]',
      '[data-automation-id="jobLocation"]',
      '.css-cygeeu'
    ]);
    const location = normalizeLocation(rawLocation);

    const description = getText([
      'div[data-automation-id="jobPostingDescription"]',
      '[data-automation-id="jobPostingDescription"]'
    ]).substring(0, 3000);

    return { title, company, location, description, url: window.location.href, platform: 'workday' };
  }

  // ============ WORKDAY CREATE ACCOUNT FLOW ============
  async function fillCreateAccount() {
    console.log('[ATS Tailor] Filling Create Account form...');
    
    // Fill email (may be pre-filled)
    const emailFilled = await fillInput(WORKDAY_SELECTORS.createAccountEmail, WORKDAY_EMAIL, 'Create Account Email');
    
    // Fill password
    const passwordFilled = await fillInput(WORKDAY_SELECTORS.createAccountPassword, WORKDAY_PASSWORD, 'Create Account Password');
    
    // Fill verify password - try specific selectors first
    let verifyFilled = false;
    for (const selector of WORKDAY_SELECTORS.verifyPassword) {
      const el = document.querySelector(selector);
      if (el && el.offsetParent !== null) {
        // Make sure it's not the same as the password field
        const passwordEl = await waitForElement(WORKDAY_SELECTORS.createAccountPassword, 500);
        if (el !== passwordEl) {
          el.focus();
          el.value = WORKDAY_VERIFY_PASSWORD;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          console.log('[ATS Tailor] Filled Verify Password');
          verifyFilled = true;
          break;
        }
      }
    }
    
    // Fallback: find all password fields and fill the second one
    if (!verifyFilled) {
      const passwordFields = document.querySelectorAll('input[type="password"]');
      if (passwordFields.length >= 2) {
        const verifyField = passwordFields[1];
        verifyField.focus();
        verifyField.value = WORKDAY_VERIFY_PASSWORD;
        verifyField.dispatchEvent(new Event('input', { bubbles: true }));
        verifyField.dispatchEvent(new Event('change', { bubbles: true }));
        console.log('[ATS Tailor] Filled Verify Password (fallback)');
        verifyFilled = true;
      }
    }
    
    await sleep(500);
    
    return { emailFilled, passwordFilled, verifyFilled };
  }

  async function clickConsentCheckbox() {
    console.log('[ATS Tailor] Looking for consent checkbox...');
    
    // Try all consent checkbox selectors
    for (const selector of WORKDAY_SELECTORS.consentCheckbox) {
      try {
        const checkbox = document.querySelector(selector);
        if (checkbox && checkbox.offsetParent !== null) {
          // Check if it's already checked
          if (!checkbox.checked) {
            checkbox.click();
            console.log('[ATS Tailor] ✅ Consent checkbox clicked');
          } else {
            console.log('[ATS Tailor] Consent checkbox already checked');
          }
          return true;
        }
      } catch (e) {}
    }
    
    // Fallback: find checkbox near terms/consent text
    const labels = document.querySelectorAll('label');
    for (const label of labels) {
      const text = label.textContent?.toLowerCase() || '';
      if (text.includes('consent') || text.includes('terms') || text.includes('read and consent')) {
        const checkbox = label.querySelector('input[type="checkbox"]') || 
                        document.getElementById(label.getAttribute('for') || '');
        if (checkbox && !checkbox.checked) {
          checkbox.click();
          console.log('[ATS Tailor] ✅ Consent checkbox clicked (via label)');
          return true;
        }
      }
    }
    
    // Last resort: click any visible unchecked checkbox on the page
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    for (const checkbox of checkboxes) {
      if (checkbox.offsetParent !== null && !checkbox.checked) {
        checkbox.click();
        console.log('[ATS Tailor] ✅ Clicked visible checkbox');
        return true;
      }
    }
    
    console.log('[ATS Tailor] No consent checkbox found');
    return false;
  }

  async function clickCreateAccountButton() {
    console.log('[ATS Tailor] Looking for Create Account button...');
    
    // Try specific selectors first
    for (const selector of WORKDAY_SELECTORS.createAccountBtn) {
      try {
        const btn = document.querySelector(selector);
        if (btn && btn.offsetParent !== null) {
          btn.click();
          console.log('[ATS Tailor] ✅ Create Account button clicked');
          return true;
        }
      } catch (e) {}
    }
    
    // Fallback: find button with "Create Account" text
    const buttons = document.querySelectorAll('button, input[type="submit"]');
    for (const btn of buttons) {
      const text = (btn.textContent || btn.value || '').trim().toLowerCase();
      if (text.includes('create account') || text.includes('create an account')) {
        btn.click();
        console.log('[ATS Tailor] ✅ Create Account button clicked (via text match)');
        return true;
      }
    }
    
    console.log('[ATS Tailor] Create Account button not found');
    return false;
  }

  // ============ DYNAMIC PAGE NAVIGATION ============
  async function navigateAllPagesUntilResume(maxPages = 10) {
    console.log('[ATS Tailor] Navigating through application pages...');
    let pageCount = 0;
    
    while (pageCount < maxPages) {
      pageCount++;
      console.log(`[ATS Tailor] Processing page ${pageCount}/${maxPages}`);
      
      // Check if we've reached resume/upload section
      if (isAtResumeSection()) {
        console.log('[ATS Tailor] 🎯 Reached Resume section!');
        return { success: true, pageCount };
      }
      
      // Look for Continue/Next buttons
      let nextClicked = false;
      
      // Try specific Workday Continue buttons
      for (const selector of WORKDAY_SELECTORS.continueBtn) {
        try {
          const btn = document.querySelector(selector);
          if (btn && btn.offsetParent !== null) {
            btn.click();
            console.log(`[ATS Tailor] Clicked Continue button: ${selector}`);
            nextClicked = true;
            break;
          }
        } catch (e) {}
      }
      
      // Fallback: find any Continue/Next button by text
      if (!nextClicked) {
        const buttons = document.querySelectorAll('button, a[role="button"]');
        for (const btn of buttons) {
          const text = (btn.textContent || '').trim().toLowerCase();
          if (text === 'continue' || text === 'next' || text === 'save and continue' || text === 'save & continue') {
            if (btn.offsetParent !== null) {
              btn.click();
              console.log(`[ATS Tailor] Clicked: "${btn.textContent?.trim()}"`);
              nextClicked = true;
              break;
            }
          }
        }
      }
      
      if (!nextClicked) {
        console.log('[ATS Tailor] No more Continue/Next buttons found');
        break;
      }
      
      // Wait for page transition
      await sleep(2500);
    }
    
    return { success: false, pageCount };
  }

  function isOnCreateAccountPage() {
    const pageText = document.body.textContent?.toLowerCase() || '';

    let hasVerifyPassword = false;
    try {
      hasVerifyPassword = !!document.querySelector(
        'input[placeholder*="verify" i], input[name*="verify" i], input[id*="verify" i]'
      );
    } catch {}

    let hasConsentCheckbox = false;
    try {
      hasConsentCheckbox = !!document.querySelector('input[type="checkbox"]');
    } catch {}

    // IMPORTANT: Never use Playwright-style selectors like :has-text() with querySelector.
    // Some Workday pages trigger this check frequently; an invalid selector will stop automation.
    let hasCreateAccountBtn = false;
    try {
      // Keep selectors strictly CSS-valid across Chrome versions (avoid attribute case flags like `[... i]`).
      hasCreateAccountBtn = !!document.querySelector(
        'button[data-automation-id="createAccountButton"],\n' +
          'button[data-automation-id="createAccountSubmitButton"],\n' +
          'button[aria-label*="Create Account"],\n' +
          'input[type="submit"][value*="Create"]'
      );
    } catch {}

    if (!hasCreateAccountBtn) {
      hasCreateAccountBtn = Array.from(
        document.querySelectorAll('button, input[type="submit"], a[role="button"]')
      ).some((b) => {
        const text = ((b.textContent || b.value || '') + '').trim().toLowerCase();
        const aria = (b.getAttribute('aria-label') || '').trim().toLowerCase();
        return text.includes('create account') || text.includes('create an account') || aria.includes('create account');
      });
    }

    return (pageText.includes('create account') || pageText.includes('create an account')) &&
      (hasVerifyPassword || hasConsentCheckbox || hasCreateAccountBtn);
  }

  // ============ WORKDAY FULL FLOW ============
  async function handleWorkdayFullFlow(candidateData = null) {
    if (workdayFlowInProgress) {
      console.log('[ATS Tailor] Workday flow already in progress');
      return;
    }

    workdayFlowInProgress = true;
    console.log('[ATS Tailor] 🚀 Starting Workday Full Flow (with Create Account)');
    
    // Scrape job first for banner
    const jobData = scrapeWorkdayJob();
    createStatusBanner(jobData.title || 'Workday Application');
    updateBanner('Workday Flow: Starting...', 'working');

    try {
      // Load Workday credentials from storage
      const stored = await new Promise(resolve => {
        chrome.storage.local.get(['workday_email', 'workday_password', 'workday_verify_password'], resolve);
      });
      if (stored.workday_email) WORKDAY_EMAIL = stored.workday_email;
      if (stored.workday_password) WORKDAY_PASSWORD = stored.workday_password;
      if (stored.workday_verify_password) WORKDAY_VERIFY_PASSWORD = stored.workday_verify_password;

      // STEP 0: Scrape job data BEFORE clicking Apply
      const jobData = scrapeWorkdayJob();
      console.log('[ATS Tailor] Job scraped:', jobData.title, 'at', jobData.company);

      // STEP 1: Click Apply button
      updateBanner('Step 1/5: Clicking Apply...', 'working');
      
      let applyClicked = await clickElement(WORKDAY_SELECTORS.apply.slice(0, -1), 'Apply Button');
      if (!applyClicked) {
        applyClicked = await clickElement(['button', 'a'], 'Apply Button', 'Apply');
      }
      if (!applyClicked) {
        console.log('[ATS Tailor] No Apply button found, may already be on application page');
      } else {
        console.log('[ATS Tailor] ✅ Apply button clicked!');
      }
      await sleep(2000);

      // STEP 2: Click Apply Manually (if popup appears)
      updateBanner('Step 2/5: Apply Manually...', 'working');
      await clickElement(WORKDAY_SELECTORS.manualApply, 'Apply Manually');
      await sleep(1500);

      // STEP 3: Handle Login OR Create Account
      updateBanner('Step 3/5: Login / Create Account...', 'working');
      
      // Check if we're on Create Account page
      if (isOnCreateAccountPage()) {
        console.log('[ATS Tailor] 📝 Create Account page detected');
        updateBanner('Step 3/5: Creating Account...', 'working');
        
        // Fill Create Account form
        await fillCreateAccount();
        await sleep(500);
        
        // Click consent checkbox
        await clickConsentCheckbox();
        await sleep(500);
        
        // Click Create Account button
        await clickCreateAccountButton();
        await sleep(3000);
        
      } else {
        // Try regular login
        const emailField = await waitForElement(WORKDAY_SELECTORS.email, 3000);
        if (emailField) {
          console.log('[ATS Tailor] 🔐 Login page detected');
          await fillInput(WORKDAY_SELECTORS.email, WORKDAY_EMAIL, 'Email');
          await fillInput(WORKDAY_SELECTORS.password, WORKDAY_PASSWORD, 'Password');
          await clickElement(WORKDAY_SELECTORS.signIn, 'Sign In');
          await sleep(3000);
          
          // After login, check if we're redirected to Create Account
          if (isOnCreateAccountPage()) {
            console.log('[ATS Tailor] 📝 Redirected to Create Account page');
            updateBanner('Step 3/5: Creating Account...', 'working');
            await fillCreateAccount();
            await sleep(500);
            await clickConsentCheckbox();
            await sleep(500);
            await clickCreateAccountButton();
            await sleep(3000);
          }
        }
      }

      // STEP 4: Navigate through dynamic pages until Resume section
      updateBanner('Step 4/5: Auto-filling application pages...', 'working');
      
      // Get candidate data from storage if not provided
      if (!candidateData) {
        const profile = await new Promise(resolve => {
          chrome.storage.local.get(['ats_session'], async (result) => {
            if (!result.ats_session?.access_token) {
              resolve(null);
              return;
            }
            try {
              const profileRes = await fetch(
                `${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${result.ats_session.user.id}&select=*`,
                {
                  headers: {
                    apikey: SUPABASE_ANON_KEY,
                    Authorization: `Bearer ${result.ats_session.access_token}`,
                  },
                }
              );
              const profileRows = await profileRes.json();
              resolve(profileRows?.[0] || null);
            } catch (e) {
              resolve(null);
            }
          });
        });
        candidateData = profile;
      }

      // Auto-fill fields on each page and navigate
      let pageCount = 0;
      const maxPages = 10;
      
      while (pageCount < maxPages && !isAtResumeSection()) {
        pageCount++;
        console.log(`[ATS Tailor] Filling application page ${pageCount}`);
        
        // Fill personal info if candidate data available
        if (candidateData) {
          await fillInput(WORKDAY_SELECTORS.firstName, candidateData.first_name, 'First Name');
          await fillInput(WORKDAY_SELECTORS.lastName, candidateData.last_name, 'Last Name');
          await fillInput(WORKDAY_SELECTORS.email2, candidateData.email, 'Email');
          await fillInput(WORKDAY_SELECTORS.phone, candidateData.phone, 'Phone');
          await fillInput(WORKDAY_SELECTORS.address, candidateData.address, 'Address');
          await fillInput(WORKDAY_SELECTORS.city, candidateData.city, 'City');
          await fillInput(WORKDAY_SELECTORS.postalCode, candidateData.zip_code, 'Postal Code');
          
          const stateEl = await waitForElement(WORKDAY_SELECTORS.state, 1000);
          if (stateEl && candidateData.state) {
            if (stateEl.tagName === 'SELECT') {
              stateEl.value = candidateData.state;
              stateEl.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
              await fillInput(WORKDAY_SELECTORS.state, candidateData.state, 'State');
            }
          }
        }

        // Check if we've reached resume upload section
        if (isAtResumeSection()) {
          console.log('[ATS Tailor] 🎯 Reached Resume section - triggering ATS Tailor');
          break;
        }

        // Click Continue/Next to go to next page
        const continueClicked = await clickElement(WORKDAY_SELECTORS.continueBtn, 'Continue');
        if (!continueClicked) {
          await clickElement(WORKDAY_SELECTORS.saveBtn, 'Save');
        }
        
        await sleep(2000);
      }

      // STEP 5: TRIGGER EXISTING ATS TAILOR
      updateBanner('Step 5/5: ✅ Workday prep complete! Triggering ATS Tailor...', 'success');
      
      await new Promise(resolve => {
        chrome.storage.local.set({ 
          workday_job_data: jobData,
          workday_flow_complete: true 
        }, resolve);
      });

      chrome.runtime.sendMessage({
        action: 'ATS_TAILOR_AUTOFILL',
        platform: 'workday',
        candidate: candidateData,
        jobData: jobData
      });

      if (isAtResumeSection()) {
        hasTriggeredTailor = false;
        await autoTailorDocuments();
      }

    } catch (error) {
      console.error('[ATS Tailor] Workday flow error:', error);
      updateBanner(`Workday Error: ${error.message}`, 'error');
    } finally {
      workdayFlowInProgress = false;
    }
  }

  // ============ MESSAGE LISTENER FOR WORKDAY FLOW + DOCUMENT ATTACHMENT ============
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // CRITICAL FIX: Handle attachDocument message from popup
    if (message.action === 'attachDocument') {
      console.log('[ATS Tailor] Received attachDocument request:', message.type);
      
      (async () => {
        try {
          const { type, pdf, text, filename } = message;
          
          if (!pdf && !text) {
            sendResponse({ success: false, message: 'No document data provided' });
            return;
          }
          
          // Create file from base64
          let file = null;
          if (pdf) {
            file = typeof FileAttacher !== 'undefined' 
              ? FileAttacher.createPDFFile(pdf, filename)
              : createPDFFile(pdf, filename);
          }
          
          if (!file && !text) {
            sendResponse({ success: false, message: 'Failed to create file' });
            return;
          }
          
          // Check for file inputs
          const fileInputs = document.querySelectorAll('input[type="file"]');
          if (fileInputs.length === 0) {
            sendResponse({ success: true, skipped: true, message: 'No file upload fields found' });
            return;
          }
          
          // Use FileAttacher for attachment
          if (typeof FileAttacher !== 'undefined' && file) {
            let attached = false;
            if (type === 'cv') {
              attached = await FileAttacher.attachToFirstMatch(file, 'cv');
            } else {
              attached = await FileAttacher.attachToCoverField(file);
            }
            
            if (attached) {
              sendResponse({ success: true, message: `${type === 'cv' ? 'CV' : 'Cover Letter'} attached!` });
            } else {
              sendResponse({ success: false, message: `Could not find ${type === 'cv' ? 'CV' : 'Cover Letter'} field` });
            }
          } else if (file) {
            // Fallback attachment
            const patterns = type === 'cv' ? [/resume/i, /cv/i, /curriculum/i] : [/cover/i, /letter/i];
            let attached = false;
            
            for (const input of fileInputs) {
              const context = getFieldContext(input);
              const isMatch = patterns.some(p => p.test(context));
              if (isMatch) {
                const dt = new DataTransfer();
                dt.items.add(file);
                input.files = dt.files;
                fireEvents(input);
                attached = true;
                break;
              }
            }
            
            if (!attached && type === 'cv' && fileInputs.length > 0) {
              const dt = new DataTransfer();
              dt.items.add(file);
              fileInputs[0].files = dt.files;
              fireEvents(fileInputs[0]);
              attached = true;
            }
            
            sendResponse({ success: attached, message: attached ? 'Document attached!' : 'Could not attach document' });
          } else if (text && type === 'cover') {
            // Fill textarea for cover letter text
            const textareas = document.querySelectorAll('textarea');
            let filled = false;
            for (const textarea of textareas) {
              const label = (textarea.labels?.[0]?.textContent || textarea.name || textarea.id || '').toLowerCase();
              if (/cover/i.test(label)) {
                textarea.value = text;
                fireEvents(textarea);
                filled = true;
                break;
              }
            }
            sendResponse({ success: filled, message: filled ? 'Cover letter filled!' : 'Could not find cover letter field' });
          } else {
            sendResponse({ success: false, message: 'No compatible field found' });
          }
        } catch (error) {
          console.error('[ATS Tailor] attachDocument error:', error);
          sendResponse({ success: false, message: error.message });
        }
      })();
      
      return true; // CRITICAL: Keep message channel open for async response
    }
    
    if (message.action === 'START_WORKDAY_FLOW') {
      handleWorkdayFullFlow(message.candidateData);
      sendResponse({ status: 'started' });
      return true;
    }
    
    if (message.action === 'AUTOFILL_CANDIDATE') {
      // Handle bulk apply autofill
      if (message.candidate && message.platform === 'workday') {
        handleWorkdayFullFlow({
          first_name: message.candidate.name?.split(' ')[0] || '',
          last_name: message.candidate.name?.split(' ').slice(1).join(' ') || '',
          email: message.candidate.email,
          phone: message.candidate.phone
        });
      }
      sendResponse({ status: 'processing' });
      return true;
    }
  });
  
  // Helper function to get field context (for fallback attachment)
  function getFieldContext(input) {
    const parts = [];
    if (input.labels?.[0]) parts.push(input.labels[0].textContent);
    parts.push(input.name || '', input.id || '');
    parts.push(input.getAttribute('aria-label') || '');
    let parent = input.parentElement;
    for (let i = 0; i < 2 && parent; i++) {
      parts.push(parent.textContent?.substring(0, 100) || '');
      parent = parent.parentElement;
    }
    return parts.join(' ').toLowerCase();
  }

  // ============ PLATFORM DETECTION ============
  function detectPlatform() {
    const hostname = window.location.hostname;
    const url = window.location.href;
    
    if (hostname.includes('workday.com') || hostname.includes('myworkdayjobs.com')) {
      // Check if this is a job posting page vs application page
      if (url.includes('/job/') || url.includes('/jobs/')) {
        return 'workday_full_flow';
      }
      return 'workday';
    }
    if (hostname.includes('greenhouse.io')) return 'greenhouse';
    if (hostname.includes('smartrecruiters.com')) return 'smartrecruiters';
    if (hostname.includes('workable.com')) return 'workable';
    return 'unknown';
  }

  // Check if Workday automation is enabled
  async function isWorkdayAutoEnabled() {
    return new Promise(resolve => {
      chrome.storage.local.get(['workday_auto_enabled'], result => {
        resolve(result.workday_auto_enabled !== false); // Default enabled
      });
    });
  }

  // ============ STATUS BANNER (RIBBON STYLE - SIMPLIFIED) ============
  function createStatusBanner(jobTitle = '') {
    if (document.getElementById('ats-auto-banner')) {
      // Update existing banner with job title
      if (jobTitle) {
        const statusEl = document.getElementById('ats-banner-status');
        if (statusEl) statusEl.textContent = `Tailoring for: ${jobTitle}`;
      }
      return;
    }
    
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
          background: linear-gradient(90deg, #e85d04 0%, #f48c06 50%, #faa307 100%);
          padding: 10px 24px;
          font: 600 15px -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
          color: #000;
          text-align: center;
          box-shadow: 0 2px 12px rgba(0,0,0,0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          animation: ats-slide-in 0.4s ease-out;
        }
        @keyframes ats-slide-in {
          from { transform: translateY(-100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        #ats-auto-banner .ats-rocket { font-size: 18px; }
        #ats-auto-banner .ats-brand { font-weight: 700; color: #000; letter-spacing: 0.5px; }
        #ats-auto-banner .ats-status { 
          margin-left: 8px; 
          font-weight: 500;
          color: rgba(0,0,0,0.85);
        }
        #ats-auto-banner.success { 
          background: linear-gradient(90deg, #00c853 0%, #00e676 50%, #69f0ae 100%); 
        }
        #ats-auto-banner.error { 
          background: linear-gradient(90deg, #ff1744 0%, #ff5252 100%); 
          color: #fff; 
        }
      </style>
      <span class="ats-rocket">🚀</span>
      <span class="ats-brand">ATS TAILOR</span>
      <span class="ats-status" id="ats-banner-status">${jobTitle ? `Tailoring for: ${jobTitle}` : 'Detecting...'}</span>
    `;
    document.body.appendChild(banner);
  }

  function updateBanner(status, type = 'working') {
    const banner = document.getElementById('ats-auto-banner');
    const statusEl = document.getElementById('ats-banner-status');
    if (banner) {
      // SVG-safe class manipulation
      banner.classList.remove('success', 'error', 'working');
      if (type === 'success') {
        banner.classList.add('success');
      } else if (type === 'error') {
        banner.classList.add('error');
      } else {
        banner.classList.add('working');
      }
    }
    // Simplified banner: only show role name, no turbo/% text
    if (statusEl) {
      // Extract just the role name if status contains extra info
      const roleMatch = status.match(/Tailoring for:\s*(.+)/i);
      if (roleMatch) {
        statusEl.textContent = `Tailoring for: ${roleMatch[1]}`;
      } else if (status.includes('✅')) {
        // Success state - keep role name only
        const roleFromStatus = status.match(/for:\s*([^-]+)/i);
        statusEl.textContent = roleFromStatus ? `Complete: ${roleFromStatus[1].trim()}` : 'Complete!';
      } else if (type === 'error') {
        statusEl.textContent = status;
      } else {
        // Default: show as tailoring for role
        statusEl.textContent = status.includes(':') ? status : `Tailoring for: ${status}`;
      }
    }
  }

  function hideBanner() {
    const banner = document.getElementById('ats-auto-banner');
    if (banner) {
      setTimeout(() => banner.remove(), 5000);
    }
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

  // ============ FIELD DETECTION ============
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
    if (!company) company = getMeta('og:site_name') || '';
    if (!company && title.includes(' at ')) {
      company = document.title.split(' at ').pop()?.split('|')[0]?.split('-')[0]?.trim() || '';
    }

    const location = selectors ? getText(selectors.location) : '';
    const rawDesc = selectors ? getText(selectors.description) : '';
    const description = rawDesc?.trim()?.length > 80 ? rawDesc.trim().substring(0, 3000) : '';

    return { title, company, location, description, url: window.location.href, platform: platformKey || hostname };
  }

  // ============ LAZYAPPLY CLEANUP ============
  function removeLazyApplyAttachments() {
    console.log('[ATS Tailor] Removing LazyApply attachments...');
    
    // Find and remove LazyApply file attachments
    const lazyApplySelectors = [
      '[class*="lazyapply" i]',
      '[id*="lazyapply" i]',
      '[data-source="lazyapply"]',
    ];
    
    // Remove file inputs that have LazyApply files
    document.querySelectorAll('input[type="file"]').forEach(input => {
      if (input.files && input.files.length > 0) {
        const fileName = input.files[0]?.name?.toLowerCase() || '';
        if (fileName.includes('lazyapply') || fileName.includes('lazy_apply')) {
          console.log('[ATS Tailor] Removing LazyApply file:', fileName);
          const dt = new DataTransfer();
          input.files = dt.files;
          fireEvents(input);
        }
      }
    });
    
    // Click remove buttons near LazyApply elements
    lazyApplySelectors.forEach(selector => {
      try {
        document.querySelectorAll(selector).forEach(el => {
          const removeBtn = el.querySelector('button[aria-label*="remove" i], .remove-file, [data-qa-remove]');
          if (removeBtn) removeBtn.click();
        });
      } catch {}
    });
  }

  // ============ TURBO PIPELINE - TRIGGERS POPUP BUTTON VIA MESSAGING ============
  async function fastAutoTailorPipeline(jobInfo) {
    const pipelineStart = Date.now();
    console.log('[ATS Tailor] Triggering popup Extract & Apply Keywords button for:', jobInfo.title);
    
    try {
      // Show simplified banner with just role name
      updateBanner(`Tailoring for: ${jobInfo.title}`, 'working');
      
      // Send message to popup to trigger the "Extract & Apply Keywords to CV" button
      // This creates a visible pressed/loading state in the popup
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: 'TRIGGER_EXTRACT_APPLY',
          jobInfo: jobInfo
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.log('[ATS Tailor] Popup not open, falling back to direct API call');
            // Fallback: If popup is not open, call API directly
            fallbackDirectTailor(jobInfo).then(resolve).catch(reject);
          } else {
            console.log('[ATS Tailor] Popup triggered successfully:', response);
            // Wait for popup to complete and get files from storage
            setTimeout(async () => {
              const { cvPDF, coverPDF, cvFileName, coverFileName } = await new Promise(r => 
                chrome.storage.local.get(['cvPDF', 'coverPDF', 'cvFileName', 'coverFileName'], r)
              );
              if (cvPDF) {
                resolve({ 
                  resumePdf: cvPDF, 
                  coverLetterPdf: coverPDF,
                  cvFileName, 
                  coverFileName,
                  matchScore: 100 
                });
              } else {
                // Still waiting, check again
                setTimeout(async () => {
                  const data = await new Promise(r => 
                    chrome.storage.local.get(['cvPDF', 'coverPDF', 'cvFileName', 'coverFileName', 'ats_lastGeneratedDocuments'], r)
                  );
                  resolve({ 
                    resumePdf: data.cvPDF, 
                    coverLetterPdf: data.coverPDF,
                    ...data.ats_lastGeneratedDocuments,
                    matchScore: data.ats_lastGeneratedDocuments?.matchScore || 100 
                  });
                }, 5000);
              }
            }, 3000);
          }
        });
      });
      
    } catch (error) {
      console.error('[ATS Tailor] Pipeline error:', error);
      throw error;
    }
  }
  
  // Fallback direct API call when popup is not open
  async function fallbackDirectTailor(jobInfo) {
    const jdText = jobInfo.description || document.body.textContent;
    const keywords = fastExtractKeywords(jdText);
    
    const [session, cachedProfile] = await Promise.all([
      new Promise(r => chrome.storage.local.get(['ats_session'], res => r(res.ats_session))),
      new Promise(r => chrome.storage.local.get(['ats_cached_profile'], res => r(res.ats_cached_profile)))
    ]);
    
    if (!session?.access_token) {
      updateBanner('Please login via extension popup first', 'error');
      return null;
    }
    
    let p = cachedProfile;
    if (!p || !p.user_id) {
      const profileRes = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${session.user.id}&select=*`,
        { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${session.access_token}` } }
      );
      const rows = await profileRes.json();
      p = rows?.[0] || {};
      chrome.storage.local.set({ ats_cached_profile: p, ats_profile_cached_at: Date.now() });
    }
    
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
        extractedKeywords: keywords,
        requirements: [],
        turboMode: true,
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
        },
      }),
    });
    
    if (!response.ok) throw new Error('Tailoring API failed');
    
    const result = await response.json();
    return { ...result, keywords, profile: p };
  }

  // ============ INSTANT KEYWORD EXTRACTION (SYNCHRONOUS - NO AWAIT) ============
  function fastExtractKeywords(text) {
    // Pre-pass: Use MandatoryKeywords for instant matching
    if (typeof MandatoryKeywords !== 'undefined') {
      const mandatory = MandatoryKeywords.extractMandatoryFromJD(text);
      if (mandatory.length >= 8) return mandatory.slice(0, 35);
    }
    
    // Fallback: Ultra-fast TF-IDF (synchronous)
    const stopWords = new Set([
      'a','an','the','and','or','but','in','on','at','to','for','of','with','by','from','as',
      'is','was','are','were','been','be','have','has','had','do','does','will','would',
      'could','should','may','might','must','this','that','these','those','you','your',
      'we','our','they','their','he','she','it','who','what','which','about','work',
      'working','job','role','position','candidate','looking','seeking','experience',
      'years','year','required','preferred','plus','bonus','remote','hybrid','salary',
      'benefits','team','company','opportunity','join'
    ]);
    
    const words = text.toLowerCase().replace(/[^a-z0-9\-\s]/g, ' ').split(/\s+/)
      .filter(w => w.length >= 3 && !stopWords.has(w));
    
    const freq = {};
    words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
    
    return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 35).map(([word]) => word);
  }

  // ============ AUTO-TAILOR DOCUMENTS (TURBO VERSION - 40% FASTER ≤1.4s) ============
  async function autoTailorDocuments() {
    if (hasTriggeredTailor || tailoringInProgress) return;

    // INSTANT: Check cache synchronously first
    const { ats_tailored_urls: cached = {} } = await new Promise(r => 
      chrome.storage.local.get(['ats_tailored_urls'], r));
    
    if (cached[currentJobUrl]) {
      loadFilesAndStart();
      return;
    }

    hasTriggeredTailor = true;
    tailoringInProgress = true;
    
    const pipelineStart = performance.now();
    
    // PARALLEL: Extract job info + remove LazyApply simultaneously
    const jobInfo = extractJobInfo();
    createStatusBanner(jobInfo.title || 'Job Application');
    
    // Use FileAttacher to remove LazyApply files
    if (typeof FileAttacher !== 'undefined') {
      FileAttacher.removeLazyApplyFiles();
    } else {
      removeLazyApplyAttachments();
    }

    try {
      const result = await fastAutoTailorPipeline(jobInfo);
      if (!result) { tailoringInProgress = false; return; }
      
      const p = result.profile || {};
      const baseName = (p.first_name && p.last_name) 
        ? `${p.first_name}_${p.last_name}`.replace(/\s+/g, '_') 
        : 'Maxmilliam_Okafor';
      const cvFileName = `${baseName}_CV.pdf`;
      const coverFileName = `${baseName}_Cover_Letter.pdf`;
      
      // Store generated documents
      chrome.storage.local.set({
        cvPDF: result.resumePdf,
        coverPDF: result.coverLetterPdf,
        coverLetterText: result.tailoredCoverLetter || result.coverLetter || '',
        cvFileName, coverFileName,
        ats_lastGeneratedDocuments: {
          cv: result.tailoredResume,
          coverLetter: result.tailoredCoverLetter || result.coverLetter,
          cvPdf: result.resumePdf, coverPdf: result.coverLetterPdf,
          cvFileName, coverFileName, matchScore: result.matchScore || 100,
        },
        ats_tailored_urls: { ...cached, [currentJobUrl]: Date.now() }
      });

      // CRITICAL FIX: Use FileAttacher for TURBO reliable file attachment
      if (typeof FileAttacher !== 'undefined') {
        const cvFileObj = FileAttacher.createPDFFile(result.resumePdf, cvFileName);
        const coverFileObj = FileAttacher.createPDFFile(result.coverLetterPdf, coverFileName);
        
        // PARALLEL: Attach files immediately (non-blocking)
        FileAttacher.attachFilesToForm(cvFileObj, coverFileObj).then(() => {
          // Start monitoring for dynamic form changes (reduced from 10s to 5s)
          FileAttacher.startAttachmentMonitor(cvFileObj, coverFileObj, 5000);
        });
      } else {
        // Fallback to old method
        loadFilesAndStart();
      }
      
      const totalTime = performance.now() - pipelineStart;
      console.log(`[ATS Tailor] ✅ TURBO pipeline complete in ${totalTime.toFixed(0)}ms (target: 1400ms)`);
      
      updateBanner(`Complete: ${jobInfo.title}`, 'success');
      hideBanner();

    } catch (error) {
      console.error('[ATS Tailor] Auto-tailor error:', error);
      updateBanner(`Error: ${error.message}`, 'error');
    } finally {
      tailoringInProgress = false;
    }
  }

  // ============ TURBO-FAST REPLACE LOOP (guarded) ============
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

  // 40% FASTER: Reduced intervals from 200ms/1000ms to 120ms/600ms
    attachLoop200ms = setInterval(() => {
      if (!filesLoaded) return;
      forceCVReplace();
      forceCoverReplace();

      if (areBothAttached()) {
        console.log('[ATS Tailor] TURBO attach complete — stopping loops');
        stopAttachLoops();
      }
    }, 120);

    attachLoop1s = setInterval(() => {
      if (!filesLoaded) return;
      forceEverything();

      if (areBothAttached()) {
        console.log('[ATS Tailor] TURBO attach complete — stopping loops');
        stopAttachLoops();
      }
    }, 600);
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
  async function initAutoTailor() {
    const platform = detectPlatform();
    console.log('[ATS Tailor] Detected platform:', platform);

    // AUTO-START WORKDAY FLOW if on a Workday job page
    if (platform === 'workday_full_flow') {
      console.log('[ATS Tailor] 🎯 Workday job page detected!');
      
      // Check if auto-enabled
      const autoEnabled = await isWorkdayAutoEnabled();
      if (autoEnabled) {
        console.log('[ATS Tailor] ✅ Workday auto-mode enabled, starting flow in 2 seconds...');
        
        // Show notification banner
        createStatusBanner();
        updateBanner('🎯 Workday detected! Auto-starting in 2s...', 'working');
        
        // Wait for page to fully load, then start
        setTimeout(async () => {
          console.log('[ATS Tailor] 🚀 Auto-starting Workday Full Flow!');
          await handleWorkdayFullFlow();
        }, 2000);
      } else {
        console.log('[ATS Tailor] ⏸️ Workday auto-mode disabled. Use popup to trigger.');
        createStatusBanner();
        updateBanner('Workday detected! Click "Run Workday Flow" in extension popup', 'working');
        setTimeout(() => {
          const banner = document.getElementById('ats-auto-banner');
          if (banner) banner.remove();
        }, 5000);
      }
      return;
    }

  // Standard ATS flow - 40% FASTER: Reduced wait time
    setTimeout(() => {
      if (hasUploadFields()) {
        console.log('[ATS Tailor] Upload fields detected! Starting TURBO auto-tailor...');
        autoTailorDocuments();
      } else {
        console.log('[ATS Tailor] No upload fields yet, watching for changes...');
        
        // Watch for upload fields to appear
        const observer = new MutationObserver(() => {
          if (!hasTriggeredTailor && hasUploadFields()) {
            console.log('[ATS Tailor] Upload fields appeared! Starting TURBO auto-tailor...');
            observer.disconnect();
            autoTailorDocuments();
          }
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
        
        // 40% FASTER: Reduced fallback from 5s to 3s
        setTimeout(() => {
          if (!hasTriggeredTailor && hasUploadFields()) {
            observer.disconnect();
            autoTailorDocuments();
          }
        }, 3000);
      }
    }, 900); // 40% FASTER: Reduced from 1.5s to 0.9s
  }

  // Start
  initAutoTailor();

})();
