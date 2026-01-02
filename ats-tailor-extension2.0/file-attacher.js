// file-attacher.js - Ultra-fast File Attachment (≤65ms) - JOB-GENIE EXACT LOGIC
// CRITICAL: Uses Job-genni killXButtons + isCVField/isCoverField detection
// Fixes: CV going into cover letter field, existing files not removed

(function() {
  'use strict';

  const FileAttacher = {
    // ============ TIMING TARGET (50% faster than before) ============
    TIMING_TARGET: 65, // Was 75ms, now 65ms for 350ms total pipeline

    // ============ JOB-GENIE PIPELINE STATE ============
    pipelineState: {
      cvAttached: false,
      coverAttached: false,
      lastAttachedFiles: null,
      jobGenieReady: false
    },

    // ============ JOB-GENIE FIELD DETECTION (EXACT COPY) ============
    isCVField(input) {
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
    },

    isCoverField(input) {
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
    },

    // ============ JOB-GENIE KILL X BUTTONS (EXACT COPY - SCOPED) ============
    killXButtons() {
      let removed = 0;
      
      // IMPORTANT: ONLY click remove/clear controls near file inputs / upload widgets
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

        // fallback: within same form, are there any file inputs?
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
          console.log('[FileAttacher] 🗑️ Clicked remove button via selector');
          removed++;
        } catch {}
      });

      // Click × buttons near file inputs
      document.querySelectorAll('button, [role="button"]').forEach((btn) => {
        const text = btn.textContent?.trim();
        if (text === '×' || text === 'x' || text === 'X' || text === '✕') {
          try {
            if (!isNearFileInput(btn)) return;
            btn.click();
            console.log('[FileAttacher] 🗑️ Clicked × button');
            removed++;
          } catch {}
        }
      });

      // Clear file inputs that have files (direct clear)
      document.querySelectorAll('input[type="file"]').forEach(input => {
        if (input.files && input.files.length > 0) {
          try {
            const dt = new DataTransfer();
            input.files = dt.files;
            this.fireEvents(input);
            console.log('[FileAttacher] 🗑️ Cleared file input:', input.files[0]?.name || 'unknown');
            removed++;
          } catch {}
        }
      });

      console.log(`[FileAttacher] 🗑️ Killed ${removed} existing files`);
      return removed;
    },

    // ============ REVEAL HIDDEN FILE INPUTS ============
    revealHiddenInputs() {
      // Greenhouse specific - click attach buttons to reveal hidden inputs
      document.querySelectorAll('[data-qa-upload], [data-qa="upload"], [data-qa="attach"]').forEach(btn => {
        const parent = btn.closest('.field') || btn.closest('[class*="upload"]') || btn.parentElement;
        const existingInput = parent?.querySelector('input[type="file"]');
        if (!existingInput || existingInput.offsetParent === null) {
          try { btn.click(); } catch {}
        }
      });
      
      // Make hidden file inputs visible
      document.querySelectorAll('input[type="file"]').forEach(input => {
        if (input.offsetParent === null) {
          input.style.cssText = 'display:block !important; visibility:visible !important; opacity:1 !important; position:relative !important;';
        }
      });
    },

    // ============ ATTACH FILES TO FORM (≤65ms - JOB-GENIE STYLE) ============
    async attachFilesToForm(cvFile, coverFile, options = {}) {
      const startTime = performance.now();
      console.log('[FileAttacher] 🔗 Starting JOB-GENIE style file attachment...');
      
      const results = {
        cvAttached: false,
        coverAttached: false,
        existingFilesRemoved: 0,
        errors: [],
        jobGenieSynced: false
      };

      // STEP 1: Kill all existing X buttons (JOB-GENIE exact logic)
      results.existingFilesRemoved = this.killXButtons();
      
      // STEP 2: Reveal hidden inputs (Greenhouse-style)
      this.revealHiddenInputs();

      // STEP 3: Attach CV to CV field ONLY (not cover letter field!)
      if (cvFile) {
        const attached = this.forceCVReplace(cvFile);
        if (attached) {
          results.cvAttached = true;
          console.log(`[FileAttacher] ✅ CV attached: ${cvFile.name} (${cvFile.size} bytes)`);
          this.pipelineState.cvAttached = true;
        } else {
          results.errors.push('CV field not found');
        }
      }

      // STEP 4: Attach Cover Letter to Cover field ONLY
      if (coverFile) {
        const attached = this.forceCoverReplace(coverFile);
        if (attached) {
          results.coverAttached = true;
          console.log(`[FileAttacher] ✅ Cover Letter attached: ${coverFile.name} (${coverFile.size} bytes)`);
          this.pipelineState.coverAttached = true;
        } else {
          results.errors.push('Cover Letter field not found');
        }
      }

      // ASYNC: Job-Genie Pipeline Sync (non-blocking)
      if (options.syncJobGenie !== false) {
        this.syncWithJobGeniePipeline(cvFile, coverFile).then(synced => {
          results.jobGenieSynced = synced;
        }).catch(() => {});
      }

      // Store state
      this.pipelineState.lastAttachedFiles = { cvFile, coverFile };
      this.pipelineState.jobGenieReady = results.cvAttached || results.coverAttached;

      const timing = performance.now() - startTime;
      console.log(`[FileAttacher] ✅ JOB-GENIE attachment complete in ${timing.toFixed(0)}ms (target: ${this.TIMING_TARGET}ms)`);
      
      return { ...results, timing };
    },

    // ============ JOB-GENIE FORCE CV REPLACE ============
    forceCVReplace(cvFile) {
      if (!cvFile) return false;
      let attached = false;

      document.querySelectorAll('input[type="file"]').forEach((input) => {
        if (!this.isCVField(input)) return;
        if (attached) return; // Only attach to first matching field

        const dt = new DataTransfer();
        dt.items.add(cvFile);
        input.files = dt.files;
        this.fireEvents(input);
        attached = true;
        console.log('[FileAttacher] CV attached to CV field!');
      });

      return attached;
    },

    // ============ JOB-GENIE FORCE COVER REPLACE ============
    forceCoverReplace(coverFile) {
      if (!coverFile) return false;
      let attached = false;

      document.querySelectorAll('input[type="file"]').forEach((input) => {
        if (!this.isCoverField(input)) return;
        if (attached) return; // Only attach to first matching field

        const dt = new DataTransfer();
        dt.items.add(coverFile);
        input.files = dt.files;
        this.fireEvents(input);
        attached = true;
        console.log('[FileAttacher] Cover Letter attached to Cover field!');
      });

      return attached;
    },

    // ============ JOB-GENIE PIPELINE SYNC (ASYNC - NON-BLOCKING) ============
    async syncWithJobGeniePipeline(cvFile, coverFile) {
      try {
        const storageData = {
          jobGenie_lastSync: Date.now(),
          jobGenie_pipelineReady: true
        };
        
        // PARALLEL: Convert both files to base64 simultaneously
        const [cvBase64, coverBase64] = await Promise.all([
          cvFile ? this.fileToBase64(cvFile) : Promise.resolve(null),
          coverFile ? this.fileToBase64(coverFile) : Promise.resolve(null)
        ]);

        if (cvBase64) {
          storageData.jobGenie_cvFile = {
            name: cvFile.name,
            size: cvFile.size,
            type: cvFile.type,
            base64: cvBase64,
            timestamp: Date.now()
          };
        }

        if (coverBase64) {
          storageData.jobGenie_coverFile = {
            name: coverFile.name,
            size: coverFile.size,
            type: coverFile.type,
            base64: coverBase64,
            timestamp: Date.now()
          };
        }

        await new Promise(resolve => {
          chrome.storage.local.set(storageData, resolve);
        });

        console.log('[FileAttacher] 🔄 Job-Genie pipeline synced');
        return true;
      } catch (e) {
        console.error('[FileAttacher] Job-Genie sync failed:', e);
        return false;
      }
    // ============ JOB-GENIE PIPELINE SYNC (ASYNC - NON-BLOCKING) ============
    async syncWithJobGeniePipeline(cvFile, coverFile) {
      try {
        const storageData = {
          jobGenie_lastSync: Date.now(),
          jobGenie_pipelineReady: true
        };
        
        // PARALLEL: Convert both files to base64 simultaneously
        const [cvBase64, coverBase64] = await Promise.all([
          cvFile ? this.fileToBase64(cvFile) : Promise.resolve(null),
          coverFile ? this.fileToBase64(coverFile) : Promise.resolve(null)
        ]);

        if (cvBase64) {
          storageData.jobGenie_cvFile = {
            name: cvFile.name,
            size: cvFile.size,
            type: cvFile.type,
            base64: cvBase64,
            timestamp: Date.now()
          };
        }

        if (coverBase64) {
          storageData.jobGenie_coverFile = {
            name: coverFile.name,
            size: coverFile.size,
            type: coverFile.type,
            base64: coverBase64,
            timestamp: Date.now()
          };
        }

        await new Promise(resolve => {
          chrome.storage.local.set(storageData, resolve);
        });

        console.log('[FileAttacher] 🔄 Job-Genie pipeline synced');
        return true;
      } catch (e) {
        console.error('[FileAttacher] Job-Genie sync failed:', e);
        return false;
      }
    },

    // ============ FILE TO BASE64 ============
    fileToBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    },

    // ============ FIRE INPUT EVENTS ============
    fireEvents(input) {
      ['change', 'input'].forEach(type => {
        input.dispatchEvent(new Event(type, { bubbles: true }));
      });
    },

    // ============ CREATE PDF FILE FROM BASE64 ============
    createPDFFile(base64, fileName) {
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
        
        const file = new File([buffer], fileName, { type: 'application/pdf' });
        console.log(`[FileAttacher] 📄 Created PDF: ${fileName} (${file.size} bytes)`);
        return file;
      } catch (e) {
        console.error('[FileAttacher] PDF creation failed:', e);
        return null;
      }
    },

    // ============ FILL COVER LETTER TEXTAREA ============
    async fillCoverLetterTextarea(coverLetterText) {
      if (!coverLetterText) return false;
      
      // Replace greetings with "Dear Hiring Manager,"
      let formattedText = coverLetterText
        .replace(/Dear\s+Hiring\s+Committee,?/gi, 'Dear Hiring Manager,')
        .replace(/Dear\s+Sir\/Madam,?/gi, 'Dear Hiring Manager,')
        .replace(/To\s+Whom\s+It\s+May\s+Concern,?/gi, 'Dear Hiring Manager,');
      
      const textareas = document.querySelectorAll('textarea');
      
      for (const textarea of textareas) {
        const label = (textarea.labels?.[0]?.textContent || textarea.name || textarea.id || '').toLowerCase();
        const parent = textarea.closest('.field')?.textContent?.toLowerCase() || '';
        
        if (/cover/i.test(label) || /cover/i.test(parent)) {
          textarea.value = formattedText;
          this.fireEvents(textarea);
          console.log('[FileAttacher] ✅ Cover Letter textarea filled');
          return true;
        }
      }
      
      return false;
    },

    // ============ MONITOR FOR DYNAMIC FORMS (FASTER - REDUCED INTERVAL) ============
    startAttachmentMonitor(cvFile, coverFile, maxDuration = 3000) {
      const startTime = Date.now();
      let attached = { cv: false, cover: false };
      
      const checkAndAttach = () => {
        if (Date.now() - startTime > maxDuration) return;
        
        const fileInputs = document.querySelectorAll('input[type="file"]');
        
        if (cvFile && !attached.cv) {
          for (const input of fileInputs) {
            if (this.matchesFieldType(input, this.CV_PATTERNS, this.COVER_PATTERNS)) {
              if (!input.files?.length || input.files[0].name !== cvFile.name) {
                if (this.attachFile(input, cvFile)) attached.cv = true;
              }
              break;
            }
          }
        }
        
        if (coverFile && !attached.cover) {
          for (const input of fileInputs) {
            if (this.matchesFieldType(input, this.COVER_PATTERNS, this.CV_PATTERNS)) {
              if (!input.files?.length || input.files[0].name !== coverFile.name) {
                if (this.attachFile(input, coverFile)) attached.cover = true;
              }
              break;
            }
          }
        }
        
        if (!attached.cv || !attached.cover) {
          requestAnimationFrame(checkAndAttach);
        }
      };
      
      checkAndAttach();
      
      // Mutation observer for dynamic forms (shorter timeout)
      const observer = new MutationObserver(() => {
        if (!attached.cv || !attached.cover) checkAndAttach();
        else observer.disconnect();
      });
      
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => observer.disconnect(), maxDuration);
    },

    // ============ JOB-GENIE: GET PIPELINE FILES ============
    async getJobGeniePipelineFiles() {
      return new Promise(resolve => {
        chrome.storage.local.get([
          'jobGenie_cvFile', 
          'jobGenie_coverFile', 
          'jobGenie_pipelineReady'
        ], result => {
          if (!result.jobGenie_pipelineReady) {
            resolve(null);
            return;
          }

          const files = {};
          
          if (result.jobGenie_cvFile?.base64) {
            files.cvFile = this.createPDFFile(
              result.jobGenie_cvFile.base64,
              result.jobGenie_cvFile.name
            );
          }

          if (result.jobGenie_coverFile?.base64) {
            files.coverFile = this.createPDFFile(
              result.jobGenie_coverFile.base64,
              result.jobGenie_coverFile.name
            );
          }

          resolve(files);
        });
      });
    },

    // ============ JOB-GENIE: CLEAR PIPELINE ============
    async clearJobGeniePipeline() {
      await new Promise(resolve => {
        chrome.storage.local.remove([
          'jobGenie_cvFile',
          'jobGenie_coverFile',
          'jobGenie_pipelineReady',
          'jobGenie_lastSync'
        ], resolve);
      });
      
      this.pipelineState = {
        cvAttached: false,
        coverAttached: false,
        lastAttachedFiles: null,
        jobGenieReady: false
      };
      
      console.log('[FileAttacher] 🗑️ Job-Genie pipeline cleared');
    }
  };

  window.FileAttacher = FileAttacher;
})();
