// turbo-pipeline.js - Ultra-fast ATS Tailoring Pipeline (≤1.4s total)
// Optimized for LazyApply rapid-fire job applications - 70% FASTER

(function(global) {
  'use strict';

  // ============ TIMING TARGETS (1.4s TOTAL) ============
  const TIMING_TARGETS = {
    EXTRACT_KEYWORDS: 250,    // 250ms
    TAILOR_CV: 400,           // 400ms
    GENERATE_PDF: 500,        // 500ms
    ATTACH_FILES: 250,        // 250ms
    TOTAL: 1400               // 1.4s total
  };

  // ============ FAST KEYWORD CACHE ============
  const keywordCache = new Map();
  const MAX_CACHE_SIZE = 100;

  function getCacheKey(text) {
    // Ultra-fast hash: first 200 chars + length
    return text.substring(0, 200) + '_' + text.length;
  }

  // ============ TURBO KEYWORD EXTRACTION (≤250ms) ============
  async function turboExtractKeywords(jobDescription, maxKeywords = 35) {
    const startTime = performance.now();
    
    if (!jobDescription || jobDescription.length < 50) {
      return { all: [], highPriority: [], workExperience: [], total: 0, timing: 0 };
    }

    // Check cache first (instant)
    const cacheKey = getCacheKey(jobDescription);
    if (keywordCache.has(cacheKey)) {
      console.log('[TurboPipeline] ⚡ Cache hit for keywords');
      return { ...keywordCache.get(cacheKey), timing: performance.now() - startTime };
    }

    // Ultra-fast extraction (synchronous, no async overhead)
    const result = ultraFastExtraction(jobDescription, maxKeywords);

    // Cache result
    if (keywordCache.size >= MAX_CACHE_SIZE) {
      const firstKey = keywordCache.keys().next().value;
      keywordCache.delete(firstKey);
    }
    keywordCache.set(cacheKey, result);

    const timing = performance.now() - startTime;
    console.log(`[TurboPipeline] Keywords extracted in ${timing.toFixed(0)}ms (target: ${TIMING_TARGETS.EXTRACT_KEYWORDS}ms)`);
    
    return { ...result, timing };
  }

  // Ultra-fast extraction (synchronous, ≤250ms)
  function ultraFastExtraction(text, maxKeywords) {
    const stopWords = new Set([
      'a','an','the','and','or','but','in','on','at','to','for','of','with','by','from',
      'as','is','was','are','were','been','be','have','has','had','do','does','did',
      'will','would','could','should','may','might','must','can','need','this','that',
      'you','your','we','our','they','their','work','working','job','position','role',
      'team','company','opportunity','looking','seeking','required','requirements',
      'preferred','ability','able','experience','years','year','including','new',
      'strong','excellent','highly','etc','also','via','across','ensure','join'
    ]);

    // High-priority keywords for Work Experience injection
    const actionKeywords = new Set([
      'agile','scrum','leadership','project management','diversity','collaboration',
      'strategic','analytics','optimization','stakeholder','cross-functional',
      'mentoring','team building','initiative','proactive','communication',
      'data-driven','compliance','regulatory','innovation','scalability'
    ]);

    const words = text.toLowerCase()
      .replace(/[^a-z0-9\s\-\/]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 3 && !stopWords.has(w));

    // Single-pass frequency count with action keyword boost
    const freq = new Map();
    words.forEach(word => {
      const count = (freq.get(word) || 0) + 1;
      const boost = actionKeywords.has(word) ? 5 : 1;
      freq.set(word, count * boost);
    });

    // Also check for multi-word phrases
    const multiWordPatterns = [
      'project management', 'data science', 'machine learning', 'deep learning',
      'team building', 'strategic planning', 'agile/scrum', 'cross-functional',
      'a/b testing', 'ci/cd', 'real-time', 'data pipelines'
    ];
    
    const textLower = text.toLowerCase();
    multiWordPatterns.forEach(phrase => {
      if (textLower.includes(phrase)) {
        freq.set(phrase, (freq.get(phrase) || 0) + 10);
      }
    });

    const sorted = [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([word]) => word)
      .slice(0, maxKeywords);

    // Split: top 12 for Work Experience injection
    const workExperienceKeywords = sorted.slice(0, 12);
    
    return {
      all: sorted,
      highPriority: sorted.slice(0, 10),
      workExperience: workExperienceKeywords, // ONLY these go into Work Experience
      total: sorted.length
    };
  }

  // ============ TURBO CV TAILORING (≤400ms) ============
  // CRITICAL: Keywords go to Work Experience ONLY, NOT Skills
  async function turboTailorCV(cvText, keywords, options = {}) {
    const startTime = performance.now();
    
    if (!cvText || !keywords?.workExperience?.length) {
      return { tailoredCV: cvText, injectedKeywords: [], timing: 0, stats: {} };
    }

    // Fast tailoring - Work Experience only
    const result = fastTailorWorkExperienceOnly(cvText, keywords.workExperience);

    const timing = performance.now() - startTime;
    console.log(`[TurboPipeline] CV tailored in ${timing.toFixed(0)}ms (target: ${TIMING_TARGETS.TAILOR_CV}ms)`);
    
    return { ...result, timing };
  }

  // Fast CV tailoring - WORK EXPERIENCE ONLY (No Skills modification)
  function fastTailorWorkExperienceOnly(cvText, workExperienceKeywords) {
    const cvLower = cvText.toLowerCase();
    const missing = workExperienceKeywords.filter(kw => !cvLower.includes(kw.toLowerCase()));
    
    if (missing.length === 0) {
      return { tailoredCV: cvText, injectedKeywords: [], stats: { total: 0, workExperience: 0 } };
    }

    let tailoredCV = cvText;
    const injected = [];

    // Find Work Experience section
    const expMatch = /^(EXPERIENCE|WORK\s*EXPERIENCE|EMPLOYMENT|PROFESSIONAL\s*EXPERIENCE)[\s:]*$/im.exec(tailoredCV);
    
    if (expMatch) {
      // Find the end of experience section
      const expStart = expMatch.index + expMatch[0].length;
      const nextSectionMatch = /^(SKILLS|EDUCATION|CERTIFICATIONS|PROJECTS)[\s:]*$/im.exec(tailoredCV.substring(expStart));
      const expEnd = nextSectionMatch ? expStart + nextSectionMatch.index : tailoredCV.length;
      
      let experienceSection = tailoredCV.substring(expStart, expEnd);
      
      // Find bullet points and inject 2-3 keywords per bullet naturally
      const lines = experienceSection.split('\n');
      let keywordIndex = 0;
      
      const modifiedLines = lines.map(line => {
        const trimmed = line.trim();
        if ((trimmed.startsWith('-') || trimmed.startsWith('•') || trimmed.startsWith('*')) && keywordIndex < missing.length) {
          let bulletContent = trimmed.replace(/^[-•*]\s*/, '');
          const bulletLower = bulletContent.toLowerCase();
          
          // Get 2-3 keywords to inject
          const toInject = [];
          while (toInject.length < 3 && keywordIndex < missing.length) {
            const kw = missing[keywordIndex];
            if (!bulletLower.includes(kw.toLowerCase())) {
              toInject.push(kw);
            }
            keywordIndex++;
          }
          
          if (toInject.length > 0) {
            // Natural injection patterns
            const patterns = [
              `, incorporating ${toInject.join(' and ')} principles`,
              ` with focus on ${toInject.join(', ')}`,
              `, leveraging ${toInject.join(' and ')}`,
              ` utilizing ${toInject.join(' and ')} methodologies`
            ];
            const pattern = patterns[Math.floor(Math.random() * patterns.length)];
            
            if (bulletContent.endsWith('.')) {
              bulletContent = bulletContent.slice(0, -1) + pattern + '.';
            } else {
              bulletContent = bulletContent + pattern;
            }
            
            injected.push(...toInject);
          }
          
          return `-  ${bulletContent}`;
        }
        return line;
      });
      
      const modifiedExperience = modifiedLines.join('\n');
      tailoredCV = tailoredCV.substring(0, expStart) + modifiedExperience + tailoredCV.substring(expEnd);
    }

    return {
      tailoredCV,
      originalCV: cvText,
      injectedKeywords: injected,
      stats: { total: injected.length, workExperience: injected.length, skills: 0 }
    };
  }

  // ============ COMPLETE TURBO PIPELINE (≤1.4s total) ============
  async function executeTurboPipeline(jobInfo, candidateData, baseCV, options = {}) {
    const pipelineStart = performance.now();
    const timings = {};
    
    console.log('[TurboPipeline] 🚀 Starting 1.4s turbo pipeline for:', jobInfo.title);
    
    // PHASE 1: Extract keywords (≤250ms)
    const jdText = jobInfo.description || '';
    const keywordsResult = await turboExtractKeywords(jdText);
    timings.extraction = keywordsResult.timing;

    if (!keywordsResult.all?.length) {
      console.warn('[TurboPipeline] No keywords extracted');
      return { success: false, error: 'No keywords extracted' };
    }

    // PHASE 2: Tailor CV - Work Experience ONLY (≤400ms)
    const tailorResult = await turboTailorCV(baseCV, keywordsResult, { targetScore: 95 });
    timings.tailoring = tailorResult.timing;

    // PHASE 3: Generate PDF will happen in pdf-ats-turbo.js (≤500ms)
    // PHASE 4: Attach files will happen in file-attacher.js (≤250ms)

    const totalTime = performance.now() - pipelineStart;
    timings.total = totalTime;

    console.log(`[TurboPipeline] ✅ Pipeline complete in ${totalTime.toFixed(0)}ms (target: ${TIMING_TARGETS.TOTAL}ms)`);
    console.log('[TurboPipeline] Timings:', timings);

    return {
      success: true,
      keywords: keywordsResult,
      workExperienceKeywords: keywordsResult.workExperience,
      tailoredCV: tailorResult.tailoredCV,
      injectedKeywords: tailorResult.injectedKeywords,
      stats: tailorResult.stats,
      timings,
      meetsTarget: totalTime <= TIMING_TARGETS.TOTAL
    };
  }

  // ============ EXPORTS ============
  global.TurboPipeline = {
    executeTurboPipeline,
    turboExtractKeywords,
    turboTailorCV,
    TIMING_TARGETS,
    clearCache: () => keywordCache.clear()
  };

})(typeof window !== 'undefined' ? window : global);
