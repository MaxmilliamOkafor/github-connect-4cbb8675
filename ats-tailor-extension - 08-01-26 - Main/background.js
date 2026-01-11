// ATS Tailored CV & Cover Letter - Background Service Worker
// Handles extension lifecycle, Workday full flow coordination, and Bulk CSV automation

console.log('[ATS Tailor] Background service worker started');

// Bulk CSV queue state
let bulkQueue = [];
let currentBulkTabId = null;
let bulkProgress = { completed: 0, total: 0, currentJob: '', isPaused: false, isStopped: false };

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[ATS Tailor] Extension installed - setting defaults');
    chrome.storage.local.set({
      workday_email: 'Maxokafordev@gmail.com',
      workday_password: 'May19315park@',
      workday_verify_password: 'May19315park@',
      workday_auto_enabled: true
    });
  } else if (details.reason === 'update') {
    console.log('[ATS Tailor] Extension updated to version', chrome.runtime.getManifest().version);
    chrome.storage.local.get(['workday_auto_enabled'], (result) => {
      if (result.workday_auto_enabled === undefined) {
        chrome.storage.local.set({ workday_auto_enabled: true });
      }
    });
  }
});

// Update bulk progress in storage for popup sync
function updateBulkProgressStorage() {
  chrome.storage.local.set({ bulkProgress });
}

// Process next job in bulk queue
async function processNextBulkJob() {
  if (bulkProgress.isStopped || bulkProgress.isPaused) {
    console.log('[ATS Tailor Bulk] Queue paused/stopped');
    return;
  }
  
  if (bulkQueue.length === 0) {
    console.log('[ATS Tailor Bulk] Queue complete!');
    bulkProgress.currentJob = 'Complete!';
    updateBulkProgressStorage();
    
    // Close bulk tab if exists
    if (currentBulkTabId) {
      try { chrome.tabs.remove(currentBulkTabId); } catch {}
      currentBulkTabId = null;
    }
    return;
  }
  
  const job = bulkQueue.shift();
  bulkProgress.currentJob = job.url;
  updateBulkProgressStorage();
  
  console.log('[ATS Tailor Bulk] Processing:', job.url);
  
  try {
    // Create or navigate to tab
    if (currentBulkTabId) {
      await chrome.tabs.update(currentBulkTabId, { url: job.url });
    } else {
      const tab = await chrome.tabs.create({ url: job.url, active: false });
      currentBulkTabId = tab.id;
    }
    
    // Wait for tab to load, then trigger automation
    const onTabUpdated = (tabId, changeInfo) => {
      if (tabId === currentBulkTabId && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(onTabUpdated);
        
        // Wait 2s for page JS to initialize, then trigger automation
        setTimeout(() => {
          chrome.tabs.sendMessage(currentBulkTabId, { 
            action: 'TRIGGER_BULK_AUTOMATION',
            jobUrl: job.url
          }).catch(err => {
            console.log('[ATS Tailor Bulk] Could not message tab:', err);
            // Move to next job on error
            bulkProgress.completed++;
            updateBulkProgressStorage();
            processNextBulkJob();
          });
        }, 2000);
      }
    };
    
    chrome.tabs.onUpdated.addListener(onTabUpdated);
    
  } catch (err) {
    console.error('[ATS Tailor Bulk] Error processing job:', err);
    bulkProgress.completed++;
    updateBulkProgressStorage();
    processNextBulkJob();
  }
}

// Keep service worker alive and handle messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'keepAlive') {
    sendResponse({ status: 'alive' });
    return true;
  }
  
  // Open the extension popup when automation starts
  if (message.action === 'openPopup') {
    chrome.action.setBadgeText({ text: '⚙️' });
    chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' });
    sendResponse({ status: 'badge_set' });
    return true;
  }
  
  // Clear badge when automation completes
  if (message.action === 'clearBadge') {
    chrome.action.setBadgeText({ text: '' });
    sendResponse({ status: 'badge_cleared' });
    return true;
  }

  // Handle Workday full flow trigger from popup
  if (message.action === 'TRIGGER_WORKDAY_FLOW') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'START_WORKDAY_FLOW',
          candidateData: message.candidateData
        });
      }
    });
    sendResponse({ status: 'triggered' });
    return true;
  }

  // Handle ATS Tailor autofill (from Workday flow completion)
  if (message.action === 'ATS_TAILOR_AUTOFILL') {
    console.log('[ATS Tailor] Received autofill request for platform:', message.platform);
    chrome.storage.local.set({
      pending_autofill: {
        platform: message.platform,
        candidate: message.candidate,
        jobData: message.jobData,
        timestamp: Date.now()
      }
    });
    sendResponse({ status: 'queued' });
    return true;
  }

  // Handle Workday credentials update
  if (message.action === 'UPDATE_WORKDAY_CREDENTIALS') {
    chrome.storage.local.set({
      workday_email: message.email,
      workday_password: message.password,
      workday_verify_password: message.verifyPassword || message.password
    });
    sendResponse({ status: 'updated' });
    return true;
  }
  
  // Handle TRIGGER_EXTRACT_APPLY from content script - forward to popup or queue
  if (message.action === 'TRIGGER_EXTRACT_APPLY') {
    console.log('[ATS Tailor Background] Received TRIGGER_EXTRACT_APPLY, forwarding to popup');
    
    chrome.action.setBadgeText({ text: '⚡' });
    chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' });
    
    chrome.storage.local.set({
      pending_extract_apply: {
        jobInfo: message.jobInfo,
        timestamp: Date.now(),
        triggeredFromAutomation: true,
        showButtonAnimation: message.showButtonAnimation !== false
      }
    });
    
    chrome.runtime.sendMessage({
      action: 'POPUP_TRIGGER_EXTRACT_APPLY',
      jobInfo: message.jobInfo,
      showButtonAnimation: message.showButtonAnimation !== false
    }).catch(() => {
      console.log('[ATS Tailor Background] Popup not open, stored pending trigger');
    });
    
    sendResponse({ status: 'queued' });
    return true;
  }
  
  // Handle completion from popup to clear badge
  if (message.action === 'EXTRACT_APPLY_COMPLETE') {
    chrome.action.setBadgeText({ text: '✓' });
    chrome.action.setBadgeBackgroundColor({ color: '#22c55e' });
    setTimeout(() => chrome.action.setBadgeText({ text: '' }), 3000);
    sendResponse({ status: 'acknowledged' });
    return true;
  }
  
  // ============ BULK CSV AUTOMATION HANDLERS ============
  
  // Start bulk CSV automation
  if (message.action === 'START_BULK_CSV_AUTOMATION') {
    console.log('[ATS Tailor Bulk] Starting bulk automation with', message.jobs?.length, 'jobs');
    bulkQueue = message.jobs || [];
    bulkProgress = { 
      completed: 0, 
      total: bulkQueue.length, 
      currentJob: 'Starting...', 
      isPaused: false, 
      isStopped: false 
    };
    updateBulkProgressStorage();
    processNextBulkJob();
    sendResponse({ status: 'started' });
    return true;
  }
  
  // Pause bulk automation
  if (message.action === 'PAUSE_BULK_AUTOMATION') {
    bulkProgress.isPaused = true;
    updateBulkProgressStorage();
    sendResponse({ status: 'paused' });
    return true;
  }
  
  // Resume bulk automation
  if (message.action === 'RESUME_BULK_AUTOMATION') {
    bulkProgress.isPaused = false;
    updateBulkProgressStorage();
    processNextBulkJob();
    sendResponse({ status: 'resumed' });
    return true;
  }
  
  // Stop bulk automation
  if (message.action === 'STOP_BULK_AUTOMATION') {
    bulkProgress.isStopped = true;
    bulkQueue = [];
    updateBulkProgressStorage();
    if (currentBulkTabId) {
      try { chrome.tabs.remove(currentBulkTabId); } catch {}
      currentBulkTabId = null;
    }
    sendResponse({ status: 'stopped' });
    return true;
  }
  
  // Job completed - move to next
  if (message.action === 'BULK_JOB_COMPLETED') {
    console.log('[ATS Tailor Bulk] Job completed:', message.jobUrl || bulkProgress.currentJob);
    bulkProgress.completed++;
    updateBulkProgressStorage();
    
    // Wait before next job (Workday uses completion signal, others use timeout)
    setTimeout(() => {
      processNextBulkJob();
    }, message.delay || 1000);
    
    sendResponse({ status: 'next' });
    return true;
  }
  
  // Workday skip job (required field error on assessment)
  if (message.action === 'WORKDAY_SKIP_JOB') {
    console.log('[ATS Tailor Bulk] Skipping job due to required field error');
    bulkProgress.completed++;
    updateBulkProgressStorage();
    processNextBulkJob();
    sendResponse({ status: 'skipped' });
    return true;
  }
  
  // Get bulk progress
  if (message.action === 'GET_BULK_PROGRESS') {
    sendResponse({ progress: bulkProgress });
    return true;
  }
});
