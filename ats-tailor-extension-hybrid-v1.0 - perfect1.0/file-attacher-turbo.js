// file-attacher-turbo.js - HYBRID: 4.0 LazyApply Speed (≤50ms) + 5.0 Features
// CRITICAL: Uses 4.0's proven "X click → CV field → New CV attach" logic
// OPTIMIZED: 50ms target for 350ms total pipeline

(function() {
  'use strict';

  const FileAttacher = {
    // ============ TIMING TARGET (4.0 SPEED) ============
    TIMING_TARGET: 50, // Target 50ms for 350ms total pipeline

    // ============ PIPELINE STATE ============
    pipelineState: {
      cvAttached: false,
      coverAttached: false,
      lastAttachedFiles: null,
      jobGenieReady: false
    },

    // ============ CV FIELD DETECTION (4.0 EXACT LOGIC) ============
    isCVField(input) {
      const text = (
        (input.labels?.[0]?.textContent || '') +
        (input.name || '') +
        (input.id || '') +
        (input.getAttribute('aria-label') || '') +
        (input.getAttribute('data-qa') || '') +
        (input.closest('label')?.textContent || '')
      ).toLowerCase();

      // Check parent elements for context (up to 5 levels)
      let parent = input.parentElement;
      for (let i = 0; i < 5 && parent; i++) {
        const parentText = (parent.textContent || '').toLowerCase().substring(0, 200);
        // CV/Resume field: has resume/cv text but NOT cover letter
        if ((parentText.includes('resume') || parentText.includes('cv')) && !parentText.includes('cover')) {
          return true;
        }
        parent = parent.parentElement;
      }

      return /(resume|cv|curriculum)/i.test(text) && !/cover/i.test(text);
    },

    // ============ COVER LETTER FIELD DETECTION (4.0 EXACT LOGIC) ============
    isCoverField(input) {
      const text = (
        (input.labels?.[0]?.textContent || '') +
        (input.name || '') +
        (input.id || '') +
        (input.getAttribute('aria-label') || '') +
        (input.getAttribute('data-qa') || '') +
        (input.closest('label')?.textContent || '')
      ).toLowerCase();

      // Check parent elements for context
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

    // ============ CLICK REMOVE BUTTON BY SECTION (4.0 + 5.0 MERGED) ============
    clickRemoveFileButton(type) {
      const headingRegex = type === 'cv'
        ? /(resume\s*\/?\s*cv|resume\b|\bcv\b)/i
        : /(cover\s*letter)/i;

      // Find sections with the appropriate heading
      const nodes = Array.from(document.querySelectorAll('label, h1, h2, h3, h4, h5, p, span, div, fieldset'));

      for (const node of nodes) {
        const text = (node.textContent || '').trim();
        if (!text || text.length > 100) continue;
        if (!headingRegex.test(text)) continue;

        // Avoid cross-matching
        if (type === 'cv' && /cover\s*letter/i.test(text)) continue;
        if (type === 'cover' && /(resume\s*\/?\s*cv|resume\b|\bcv\b)/i.test(text)) continue;

        const container = node.closest('fieldset, section, form, [role="group"], div') || node.parentElement;
        if (!container) continue;

        // Look for remove/delete/X buttons in this section
        const removeButtons = container.querySelectorAll('button, a, span, div[role="button"], [class*="remove"], [class*="delete"]');

        for (const btn of removeButtons) {
          const btnText = (btn.textContent || '').trim().toLowerCase();
          const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
          const title = (btn.getAttribute('title') || '').toLowerCase();
          const className = (btn.className || '').toLowerCase();

          // Check if it's a remove/delete/X button
          const isRemoveBtn =
            btnText === 'x' ||
            btnText === '×' ||
            btnText === '✕' ||
            btnText === '✖' ||
            btnText === 'remove' ||
            btnText === 'delete' ||
            btnText.includes('remove') ||
            ariaLabel.includes('remove') ||
            ariaLabel.includes('delete') ||
            title.includes('remove') ||
            title.includes('delete') ||
            className.includes('remove') ||
            className.includes('delete') ||
            className.includes('close') ||
            (btn.tagName === 'BUTTON' && btnText.length <= 2); // Short button text like "X"

          if (isRemoveBtn && btn.offsetParent !== null) {
            console.log(`[FileAttacher] Found remove button for ${type}:`, btnText || ariaLabel || 'X button');
            try {
              btn.click();
              console.log(`[FileAttacher] ✅ Clicked remove button for ${type}`);
              return true;
            } catch (e) {
              console.warn('[FileAttacher] Failed to click remove button:', e);
            }
          }
        }

        // Also look for SVG close icons (common pattern)
        const svgCloseIcons = container.querySelectorAll('svg');
        for (const svg of svgCloseIcons) {
          const parent = svg.closest('button, a, span, div[role="button"]');
          if (parent && parent.offsetParent !== null) {
            const parentText = (parent.textContent || '').trim();
            // If SVG's parent is clickable and has minimal text (likely an icon button)
            if (parentText.length <= 3) {
              console.log(`[FileAttacher] Found SVG close icon for ${type}`);
              try {
                parent.click();
                console.log(`[FileAttacher] ✅ Clicked SVG remove button for ${type}`);
                return true;
              } catch (e) {
                console.warn('[FileAttacher] Failed to click SVG remove button:', e);
              }
            }
          }
        }
      }

      console.log(`[FileAttacher] No remove button found for ${type}`);
      return false;
    },

    // ============ KILL X BUTTONS (4.0 SCOPED LOGIC) ============
    killXButtons() {
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

      let removed = 0;

      // Click section-specific remove buttons first (Job-Genie approach)
      if (this.clickRemoveFileButton('cv')) removed++;
      if (this.clickRemoveFileButton('cover')) removed++;

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
          removed++;
        } catch {}
      });

      document.querySelectorAll('button, [role="button"]').forEach((btn) => {
        const text = btn.textContent?.trim();
        if (text === '×' || text === 'x' || text === 'X' || text === '✕') {
          try {
            if (!isNearFileInput(btn)) return;
            btn.click();
            removed++;
          } catch {}
        }
      });

      console.log(`[FileAttacher] Killed ${removed} X buttons`);
      return removed;
    },

    // ============ FIRE EVENTS ============
    fireEvents(input) {
      ['change', 'input'].forEach(type => {
        input.dispatchEvent(new Event(type, { bubbles: true }));
      });
    },

    // ============ CLEAR FILE INPUT ============
    clearFileInput(input) {
      if (input.files && input.files.length > 0) {
        try {
          const dt = new DataTransfer();
          input.files = dt.files;
          this.fireEvents(input);
          return true;
        } catch (e) {}
      }
      return false;
    },

    // ============ ATTACH FILE TO INPUT (4.0 PROVEN LOGIC) ============
    attachFileToInput(input, file) {
      try {
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        this.fireEvents(input);
        console.log(`[FileAttacher] ✅ Attached: ${file.name} to input`);
        return true;
      } catch (e) {
        console.error('[FileAttacher] Attach failed:', e);
        return false;
      }
    },

    // ============ ATTACH TO CV FIELD (4.0 LOGIC + SPEED) ============
    async attachToFirstMatch(file, type) {
      const startTime = performance.now();
      const fileInputs = document.querySelectorAll('input[type="file"]');
      
      for (const input of fileInputs) {
        const isMatch = type === 'cv' ? this.isCVField(input) : this.isCoverField(input);
        if (isMatch) {
          // STEP 1: Click X to remove existing file
          this.clickRemoveFileButton(type);
          
          // STEP 2: Clear input programmatically
          this.clearFileInput(input);
          
          // STEP 3: Attach new file
          const result = this.attachFileToInput(input, file);
          
          const timing = performance.now() - startTime;
          console.log(`[FileAttacher] ${type.toUpperCase()} attach completed in ${timing.toFixed(0)}ms (target: ${this.TIMING_TARGET}ms)`);
          
          if (result) {
            this.pipelineState[type === 'cv' ? 'cvAttached' : 'coverAttached'] = true;
          }
          
          return result;
        }
      }
      
      // Fallback: use first file input for CV
      if (type === 'cv' && fileInputs.length > 0) {
        this.clickRemoveFileButton('cv');
        this.clearFileInput(fileInputs[0]);
        return this.attachFileToInput(fileInputs[0], file);
      }
      
      return false;
    },

    // ============ ATTACH COVER LETTER (FILE OR TEXT) ============
    async attachToCoverField(file, text = null) {
      const startTime = performance.now();
      
      // GREENHOUSE FIX: Click "Attach" button first to reveal file input
      this.clickGreenhouseCoverAttach();
      
      // Brief wait for file input to appear after clicking Attach
      await new Promise(r => setTimeout(r, 50));
      
      // Try file attachment
      if (file) {
        let result = await this.attachToFirstMatch(file, 'cover');
        
        // If no cover field found, try clicking Attach again and retry
        if (!result) {
          this.clickGreenhouseCoverAttach();
          await new Promise(r => setTimeout(r, 100));
          result = await this.attachToFirstMatch(file, 'cover');
        }
        
        if (result) {
          const timing = performance.now() - startTime;
          console.log(`[FileAttacher] Cover Letter file attached in ${timing.toFixed(0)}ms`);
          this.pipelineState.coverAttached = true;
          return true;
        }
      }
      
      // Try textarea for cover letter text
      if (text) {
        const textareas = document.querySelectorAll('textarea');
        for (const textarea of textareas) {
          const label = (textarea.labels?.[0]?.textContent || textarea.name || textarea.id || '').toLowerCase();
          if (/cover/i.test(label)) {
            textarea.value = text;
            this.fireEvents(textarea);
            const timing = performance.now() - startTime;
            console.log(`[FileAttacher] Cover Letter text filled in ${timing.toFixed(0)}ms`);
            this.pipelineState.coverAttached = true;
            return true;
          }
        }
      }
      
      return false;
    },

    // ============ REVEAL HIDDEN INPUTS (GREENHOUSE) ============
    revealHiddenInputs() {
      // Click "Attach" buttons to reveal hidden file inputs
      document.querySelectorAll('[data-qa-upload], [data-qa="upload"], [data-qa="attach"]').forEach(btn => {
        const parent = btn.closest('.field') || btn.closest('[class*="upload"]') || btn.parentElement;
        const existingInput = parent?.querySelector('input[type="file"]');
        if (!existingInput || existingInput.offsetParent === null) {
          try { btn.click(); } catch {}
        }
      });

      // GREENHOUSE COVER LETTER: Click "Attach" button in Cover Letter section specifically
      this.clickGreenhouseCoverAttach();

      // Make hidden inputs visible
      document.querySelectorAll('input[type="file"]').forEach(input => {
        if (input.offsetParent === null) {
          input.style.cssText = 'display:block !important; visibility:visible !important; opacity:1 !important; position:relative !important;';
        }
      });
    },

    // ============ GREENHOUSE COVER LETTER ATTACH BUTTON CLICK ============
    clickGreenhouseCoverAttach() {
      // Find the Cover Letter section by label text
      const allLabels = document.querySelectorAll('label, h3, h4, span, div, fieldset');
      for (const label of allLabels) {
        const text = (label.textContent || '').trim().toLowerCase();
        if (text.includes('cover letter') && text.length < 30) {
          // Found Cover Letter label - look for "Attach" button nearby
          const container = label.closest('fieldset') || label.closest('.field') || label.closest('section') || label.parentElement?.parentElement;
          if (!container) continue;
          
          // Look for Attach button (first option in Greenhouse)
          const buttons = container.querySelectorAll('button, a[role="button"], [class*="attach"]');
          for (const btn of buttons) {
            const btnText = (btn.textContent || '').trim().toLowerCase();
            if (btnText === 'attach' || btnText.includes('attach')) {
              console.log('[FileAttacher] 📎 Clicking Greenhouse Cover Letter "Attach" button');
              try { 
                btn.click(); 
                return true;
              } catch (e) {
                console.warn('[FileAttacher] Failed to click Attach button:', e);
              }
            }
          }
        }
      }
      return false;
    },

    // ============ CREATE PDF FILE FROM BASE64 ============
    createPDFFile(base64, name) {
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
        console.log(`[FileAttacher] Created PDF: ${name} (${file.size} bytes)`);
        return file;
      } catch (e) {
        console.error('[FileAttacher] PDF creation failed:', e);
        return null;
      }
    },

    // ============ TURBO ATTACH PIPELINE (≤50ms) ============
    async turboAttach(cvPdf, coverPdf, cvFilename, coverFilename, coverText = null) {
      const startTime = performance.now();
      console.log('[FileAttacher] 🚀 Starting TURBO attach pipeline (target: 50ms)');

      // Create files
      const cvFile = cvPdf ? this.createPDFFile(cvPdf, cvFilename || 'Tailored_CV.pdf') : null;
      const coverFile = coverPdf ? this.createPDFFile(coverPdf, coverFilename || 'Tailored_Cover_Letter.pdf') : null;

      // STEP 1: Reveal hidden inputs first
      this.revealHiddenInputs();

      // STEP 2: Kill X buttons to remove existing files
      this.killXButtons();
      
      // STEP 3: Wait briefly for UI to settle after clicking buttons
      await new Promise(r => setTimeout(r, 50));

      // STEP 4: Attach CV
      let cvAttached = false;
      if (cvFile) {
        cvAttached = await this.attachToFirstMatch(cvFile, 'cv');
      }

      // STEP 5: Click Greenhouse Cover Letter Attach button BEFORE attaching cover
      this.clickGreenhouseCoverAttach();
      await new Promise(r => setTimeout(r, 50));

      // STEP 6: Attach Cover Letter
      let coverAttached = false;
      if (coverFile || coverText) {
        coverAttached = await this.attachToCoverField(coverFile, coverText);
      }
      
      // STEP 7: Retry cover letter if not attached
      if (!coverAttached && (coverFile || coverText)) {
        this.clickGreenhouseCoverAttach();
        await new Promise(r => setTimeout(r, 100));
        coverAttached = await this.attachToCoverField(coverFile, coverText);
      }

      const timing = performance.now() - startTime;
      console.log(`[FileAttacher] ✅ TURBO attach completed in ${timing.toFixed(0)}ms (target: ${this.TIMING_TARGET}ms)`);
      console.log(`[FileAttacher] Results: CV=${cvAttached ? '✅' : '❌'}, Cover=${coverAttached ? '✅' : '❌'}`);

      return {
        cvAttached,
        coverAttached,
        timing,
        meetsTarget: timing <= this.TIMING_TARGET
      };
    },
    
    // ============ ATTACH BOTH FILES TOGETHER (SINGLE CALL) ============
    async attachBothFiles(cvFile, coverFile, coverText = null) {
      console.log('[FileAttacher] 📎 Attaching BOTH CV + Cover Letter together');
      
      // STEP 1: Reveal hidden inputs
      this.revealHiddenInputs();
      
      // STEP 2: Kill existing files
      this.killXButtons();
      
      await new Promise(r => setTimeout(r, 50));
      
      // STEP 3: Attach CV first
      let cvAttached = false;
      if (cvFile) {
        cvAttached = await this.attachToFirstMatch(cvFile, 'cv');
      }
      
      // STEP 4: Click Cover Letter Attach button
      this.clickGreenhouseCoverAttach();
      await new Promise(r => setTimeout(r, 50));
      
      // STEP 5: Attach Cover Letter
      let coverAttached = false;
      if (coverFile || coverText) {
        coverAttached = await this.attachToCoverField(coverFile, coverText);
      }
      
      // STEP 6: Retry if cover not attached
      if (!coverAttached && (coverFile || coverText)) {
        this.clickGreenhouseCoverAttach();
        await new Promise(r => setTimeout(r, 100));
        coverAttached = await this.attachToCoverField(coverFile, coverText);
      }
      
      console.log(`[FileAttacher] Both files: CV=${cvAttached ? '✅' : '❌'}, Cover=${coverAttached ? '✅' : '❌'}`);
      
      return { cvAttached, coverAttached };
    },

    // ============ CONTINUOUS MONITORING (LAZYAPPLY PROTECTION) ============
    startFileMonitoring(type, input, file) {
      let monitorCount = 0;
      const maxMonitors = 10;
      const checkIntervals = [1500, 3000, 5000, 8000];
      
      const monitor = setInterval(() => {
        monitorCount++;
        if (monitorCount > maxMonitors) {
          clearInterval(monitor);
          return;
        }
        
        const currentName = input?.files?.[0]?.name;
        if (!currentName) {
          // File was cleared - re-attach
          console.log(`[FileAttacher] File was cleared - re-attaching`);
          this.attachFileToInput(input, file);
        } else if (currentName !== file.name) {
          // Different file attached (LazyApply override) - click X first, then re-attach
          console.log(`[FileAttacher] Overwrite detected: "${currentName}" → re-attaching "${file.name}"`);
          this.clickRemoveFileButton(type);
          this.clearFileInput(input);
          setTimeout(() => {
            this.attachFileToInput(input, file);
          }, 300);
        }
      }, checkIntervals[Math.min(monitorCount, checkIntervals.length - 1)] || 5000);
      
      // Stop after 30 seconds
      setTimeout(() => clearInterval(monitor), 30000);
    }
  };

  // Export
  window.FileAttacher = FileAttacher;

})();