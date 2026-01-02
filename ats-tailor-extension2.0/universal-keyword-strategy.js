// universal-keyword-strategy.js - Ultimate Keyword Algorithm for 95%+ ATS Pass Rate
// COMBINED UNIVERSAL KEYWORD STRATEGY - Job-Genie Integration
// Phases: Extraction → Classification → Allocation → Placement → Formatting → Validation → Execution

(function(global) {
  'use strict';

  // ============ TIMING TARGETS (700ms TOTAL) ============
  const TIMING_TARGETS = {
    EXTRACT_CLASSIFY: 125,     // Phase 1: 125ms
    INTELLIGENT_PLACEMENT: 200, // Phase 2-3: 200ms
    PDF_FORMATTING: 250,        // Phase 4-5: 250ms
    FILE_ATTACHMENT: 125,       // Phase 6-7: 125ms
    TOTAL: 700
  };

  // ============ ROI CLASSIFICATION ============
  const ROI_CLASSIFICATION = {
    // HIGH ROI: Technical skills that ATS systems weight heavily
    HIGH: new Set([
      // Programming Languages
      'python', 'java', 'javascript', 'typescript', 'c++', 'c#', 'go', 'rust', 'kotlin', 'swift', 'scala', 'ruby', 'php', 'r', 'matlab',
      // Data/ML
      'sql', 'nosql', 'tensorflow', 'pytorch', 'keras', 'pandas', 'numpy', 'scikit-learn', 'spark', 'hadoop', 'kafka', 'airflow',
      // Cloud/DevOps
      'aws', 'azure', 'gcp', 'kubernetes', 'docker', 'terraform', 'jenkins', 'ci/cd', 'circleci', 'github actions', 'ansible',
      // Databases
      'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'cassandra', 'dynamodb', 'snowflake', 'redshift', 'bigquery',
      // Frameworks
      'react', 'angular', 'vue', 'node.js', 'django', 'flask', 'spring', 'express', 'fastapi', 'graphql', 'rest api',
      // Data Science
      'machine learning', 'deep learning', 'nlp', 'computer vision', 'etl', 'data pipeline', 'data warehouse'
    ]),

    // MEDIUM ROI: Process & methodology keywords
    MEDIUM: new Set([
      'agile', 'scrum', 'kanban', 'stakeholder management', 'project management', 'product management',
      'cross-functional', 'strategic planning', 'roadmap', 'sprint planning', 'backlog', 'jira', 'confluence',
      'a/b testing', 'user research', 'analytics', 'kpi', 'metrics', 'optimization', 'scalability'
    ]),

    // LOW ROI: Soft skills (less weight but still needed for completeness)
    LOW: new Set([
      'communication', 'collaboration', 'teamwork', 'leadership', 'mentoring', 'problem-solving',
      'critical thinking', 'attention to detail', 'time management', 'adaptability', 'flexibility',
      'diversity', 'inclusion', 'self-motivated', 'proactive', 'innovative'
    ])
  };

  // ============ INJECTION TEMPLATES ============
  const INJECTION_TEMPLATES = {
    // Technical keyword templates
    TECHNICAL: [
      '[KEYWORD1]/[KEYWORD2] solutions using [KEYWORD3]',
      'built [KEYWORD1] systems with [KEYWORD2] architecture',
      'deployed [KEYWORD1] on [KEYWORD2] infrastructure',
      'integrated [KEYWORD1] with [KEYWORD2] for [KEYWORD3]'
    ],
    // Process keyword templates  
    PROCESS: [
      'led [KEYWORD1] initiatives with [KEYWORD2] methodology',
      'drove [KEYWORD1] adoption across [KEYWORD2] teams',
      'implemented [KEYWORD1] practices for [KEYWORD2]',
      'managed [KEYWORD1] using [KEYWORD2] framework'
    ],
    // Leadership keyword templates
    LEADERSHIP: [
      'drove [KEYWORD1] strategy across [KEYWORD2] teams',
      'mentored team on [KEYWORD1] and [KEYWORD2]',
      'led [KEYWORD1] transformation with [KEYWORD2] focus'
    ],
    // Impact templates
    IMPACT: [
      'optimized [KEYWORD1] reducing [METRIC] by X%',
      'improved [KEYWORD1] efficiency through [KEYWORD2]',
      'delivered [KEYWORD1] project [METRIC] under budget'
    ]
  };

  // ============ PHASE 1: EXTRACTION + CLASSIFICATION (125ms) ============
  function extractAndClassifyKeywords(jobDescription, maxKeywords = 35) {
    const startTime = performance.now();
    
    if (!jobDescription || jobDescription.length < 50) {
      return { 
        highROI: [], 
        mediumROI: [], 
        lowROI: [], 
        all: [], 
        timing: 0 
      };
    }

    const jdLower = jobDescription.toLowerCase();
    const foundKeywords = { high: [], medium: [], low: [], unclassified: [] };

    // Extract known HIGH ROI keywords
    ROI_CLASSIFICATION.HIGH.forEach(kw => {
      if (jdLower.includes(kw.toLowerCase())) {
        foundKeywords.high.push(kw);
      }
    });

    // Extract known MEDIUM ROI keywords
    ROI_CLASSIFICATION.MEDIUM.forEach(kw => {
      if (jdLower.includes(kw.toLowerCase())) {
        foundKeywords.medium.push(kw);
      }
    });

    // Extract known LOW ROI keywords
    ROI_CLASSIFICATION.LOW.forEach(kw => {
      if (jdLower.includes(kw.toLowerCase())) {
        foundKeywords.low.push(kw);
      }
    });

    // TF-IDF for unclassified keywords
    const stopWords = new Set([
      'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
      'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had',
      'this', 'that', 'it', 'you', 'your', 'we', 'our', 'they', 'their', 'will', 'would',
      'work', 'working', 'job', 'position', 'role', 'team', 'company', 'required', 'requirements',
      'experience', 'years', 'ability', 'able', 'looking', 'seeking', 'candidate', 'must'
    ]);

    const words = jdLower
      .replace(/[^a-z0-9\s\-\/]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 3 && !stopWords.has(w));

    const freq = new Map();
    words.forEach(word => {
      const existing = [...foundKeywords.high, ...foundKeywords.medium, ...foundKeywords.low];
      if (!existing.includes(word)) {
        freq.set(word, (freq.get(word) || 0) + 1);
      }
    });

    // Top unclassified keywords
    const unclassified = [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([word]) => word);
    
    foundKeywords.unclassified = unclassified;

    // Combine all keywords (prioritized)
    const allKeywords = [
      ...foundKeywords.high,
      ...foundKeywords.medium,
      ...foundKeywords.unclassified,
      ...foundKeywords.low
    ].slice(0, maxKeywords);

    const timing = performance.now() - startTime;
    console.log(`[UniversalStrategy] Phase 1 complete in ${timing.toFixed(0)}ms (target: ${TIMING_TARGETS.EXTRACT_CLASSIFY}ms)`);

    return {
      highROI: foundKeywords.high,
      mediumROI: foundKeywords.medium,
      lowROI: foundKeywords.low,
      unclassified: foundKeywords.unclassified,
      all: allKeywords,
      timing,
      // For backward compatibility
      highPriority: foundKeywords.high.concat(foundKeywords.unclassified.slice(0, 5)),
      mediumPriority: foundKeywords.medium,
      lowPriority: foundKeywords.low
    };
  }

  // ============ PHASE 2: OPTIMAL SECTION ALLOCATION ============
  function allocateSectionsOptimally(keywords) {
    // PROF SUMMARY: 2-3 HIGH ROI keywords (15% density)
    const summaryKeywords = keywords.highROI.slice(0, 3);

    // WORK EXPERIENCE: 70% ALL keywords (2-3 per bullet)
    const experienceKeywords = [
      ...keywords.highROI,
      ...keywords.mediumROI,
      ...keywords.unclassified || []
    ].slice(0, Math.ceil(keywords.all.length * 0.7));

    // SKILLS: 15-20 CORE TECHNICAL ONLY (comma-separated, no bullets)
    const skillsKeywords = keywords.highROI.slice(0, 20);

    return {
      summary: summaryKeywords,
      experience: experienceKeywords,
      skills: skillsKeywords,
      allocation: {
        summaryCount: summaryKeywords.length,
        experienceCount: experienceKeywords.length,
        skillsCount: skillsKeywords.length
      }
    };
  }

  // ============ PHASE 3: INTELLIGENT PLACEMENT (200ms) ============
  async function intelligentKeywordPlacement(cvText, keywords, allocation) {
    const startTime = performance.now();
    let tailoredCV = cvText;
    const injectedKeywords = [];
    const cvLower = cvText.toLowerCase();

    // Find missing keywords
    const missingFromSummary = allocation.summary.filter(kw => !cvLower.includes(kw.toLowerCase()));
    const missingFromExperience = allocation.experience.filter(kw => !cvLower.includes(kw.toLowerCase()));

    // A) EXISTING BULLET ENHANCEMENT (70% of keywords)
    const experienceMatch = tailoredCV.match(
      /(EXPERIENCE|WORK\s*EXPERIENCE|PROFESSIONAL\s*EXPERIENCE|EMPLOYMENT)[\s:]*\n([\s\S]*?)(?=\n(?:SKILLS|EDUCATION|CERTIFICATIONS|PROJECTS|$))/i
    );

    if (experienceMatch && missingFromExperience.length > 0) {
      let experienceSection = experienceMatch[0];
      const bullets = experienceSection.match(/^[•\-\*]\s*.+$/gm) || [];
      let keywordIdx = 0;

      bullets.forEach((bullet, idx) => {
        if (keywordIdx >= missingFromExperience.length) return;

        // Get 2-3 keywords for this bullet (max 2-3 per bullet as per spec)
        const numToAdd = Math.min(3, Math.ceil((missingFromExperience.length - keywordIdx) / (bullets.length - idx)));
        const kwsToAdd = missingFromExperience.slice(keywordIdx, keywordIdx + numToAdd);
        keywordIdx += numToAdd;

        if (kwsToAdd.length === 0) return;

        // Natural injection using templates
        let enhanced = bullet;
        const bulletLower = bullet.toLowerCase();

        // Skip if all keywords already present
        const toInject = kwsToAdd.filter(kw => !bulletLower.includes(kw.toLowerCase()));
        if (toInject.length === 0) return;

        // TEMPLATE: "[Action] [KEYWORD1]/[KEYWORD2] [existing content] using [KEYWORD3]"
        if (toInject.length === 1) {
          enhanced = bullet.replace(/\.?\s*$/, `, incorporating ${toInject[0]} principles.`);
        } else if (toInject.length === 2) {
          enhanced = bullet.replace(/\.?\s*$/, ` with ${toInject[0]} and ${toInject[1]}.`);
        } else {
          const last = toInject.pop();
          enhanced = bullet.replace(/\.?\s*$/, ` leveraging ${toInject.join(', ')}, and ${last}.`);
          toInject.push(last);
        }

        experienceSection = experienceSection.replace(bullet, enhanced);
        injectedKeywords.push(...toInject);
      });

      tailoredCV = tailoredCV.replace(experienceMatch[0], experienceSection);
    }

    // B) NEW CONTEXTUAL BULLET (25% keywords) - Add if keywords don't fit existing bullets
    const remainingExperience = missingFromExperience.filter(kw => !injectedKeywords.includes(kw));
    if (remainingExperience.length >= 3 && experienceMatch) {
      const newBullet = `\n• Implemented ${remainingExperience.slice(0, 3).join(', ')} initiatives across cross-functional teams, improving operational efficiency.`;
      
      // Insert after first job entry
      const firstJobEnd = tailoredCV.search(/\n[A-Z][a-z]+.*\|.*\d{4}/);
      if (firstJobEnd > 0) {
        const insertPoint = tailoredCV.indexOf('\n', firstJobEnd + 20);
        if (insertPoint > 0) {
          tailoredCV = tailoredCV.slice(0, insertPoint) + newBullet + tailoredCV.slice(insertPoint);
          injectedKeywords.push(...remainingExperience.slice(0, 3));
        }
      }
    }

    // C) SUMMARY INTEGRATION (5% keywords)
    const summaryMatch = tailoredCV.match(
      /(PROFESSIONAL\s*SUMMARY|SUMMARY|PROFILE)[\s:]*\n([\s\S]*?)(?=\n(?:EXPERIENCE|WORK|SKILLS|$))/i
    );

    if (summaryMatch && missingFromSummary.length > 0) {
      const summarySection = summaryMatch[0];
      const toInject = missingFromSummary.filter(kw => !summarySection.toLowerCase().includes(kw.toLowerCase()));
      
      if (toInject.length > 0) {
        // TEMPLATE: "[Title] expert in [KEYWORD1], [KEYWORD2] with proven [KEYWORD3] delivery"
        const injection = ` Expert in ${toInject.slice(0, 3).join(', ')} with proven delivery track record.`;
        const enhancedSummary = summarySection.replace(/(\.\s*)$/, injection + '$1');
        tailoredCV = tailoredCV.replace(summarySection, enhancedSummary);
        injectedKeywords.push(...toInject.slice(0, 3));
      }
    }

    const timing = performance.now() - startTime;
    console.log(`[UniversalStrategy] Phase 3 complete in ${timing.toFixed(0)}ms (target: ${TIMING_TARGETS.INTELLIGENT_PLACEMENT}ms)`);

    return {
      tailoredCV,
      injectedKeywords,
      timing
    };
  }

  // ============ PHASE 4: SKILLS FORMATTING (NO BULLETS, COMMA-SEPARATED) ============
  function formatSkillsSection(cvText, skillsKeywords) {
    // Find skills section
    const skillsMatch = cvText.match(
      /(SKILLS|TECHNICAL\s*SKILLS|CORE\s*SKILLS)[\s:]*\n([\s\S]*?)(?=\n(?:EDUCATION|CERTIFICATIONS|ACHIEVEMENTS|$))/i
    );

    if (!skillsMatch) return cvText;

    const skillsHeader = skillsMatch[1];
    const skillsContent = skillsMatch[2];

    // Extract existing skills (remove bullets, normalize)
    const existingSkills = skillsContent
      .replace(/[•\-\*]/g, ',')
      .split(/[,\n]/)
      .map(s => s.trim())
      .filter(s => s.length >= 2 && s.length <= 50);

    // Merge with required keywords (no duplicates)
    const allSkills = [...new Set([...existingSkills, ...skillsKeywords])];

    // Limit to 20 core technical skills
    const coreSkills = allSkills.slice(0, 20);

    // Format as comma-separated, single line (Arial 10pt format)
    const formattedSkills = `${skillsHeader}\n${coreSkills.join(', ')}`;

    return cvText.replace(skillsMatch[0], formattedSkills);
  }

  // ============ PHASE 5: VALIDATION CHECKS ============
  function validateTailoring(tailoredCV, keywords) {
    const cvLower = tailoredCV.toLowerCase();
    const matched = keywords.all.filter(kw => cvLower.includes(kw.toLowerCase()));
    const missing = keywords.all.filter(kw => !cvLower.includes(kw.toLowerCase()));
    const coverage = keywords.all.length > 0 ? Math.round((matched.length / keywords.all.length) * 100) : 0;

    // Check for bullet stuffing (bad pattern: "- keyword keyword keyword")
    const bulletStuffing = /^[-•\*]\s*([a-z]+\s*){3,}$/gm.test(tailoredCV.toLowerCase());

    // Check keywords per bullet (max 2-3)
    const bullets = tailoredCV.match(/^[•\-\*]\s*.+$/gm) || [];
    let maxKeywordsInBullet = 0;
    bullets.forEach(bullet => {
      const bulletLower = bullet.toLowerCase();
      let count = 0;
      keywords.all.forEach(kw => {
        if (bulletLower.includes(kw.toLowerCase())) count++;
      });
      maxKeywordsInBullet = Math.max(maxKeywordsInBullet, count);
    });

    // Skills section check (should be comma-separated, no bullets)
    const skillsSection = tailoredCV.match(/(SKILLS|TECHNICAL\s*SKILLS)[\s:]*\n([\s\S]*?)(?=\n(?:EDUCATION|CERTIFICATIONS|$))/i);
    const skillsHasBullets = skillsSection ? /^[-•\*]/m.test(skillsSection[2]) : false;

    return {
      coverage,
      matched,
      missing,
      isValid: coverage >= 85 && !bulletStuffing && maxKeywordsInBullet <= 4 && !skillsHasBullets,
      checks: {
        coverageOK: coverage >= 85,
        noBulletStuffing: !bulletStuffing,
        keywordsPerBulletOK: maxKeywordsInBullet <= 4,
        skillsFormatOK: !skillsHasBullets
      }
    };
  }

  // ============ PHASE 6-7: FULL EXECUTION PIPELINE (700ms) ============
  async function executeUniversalStrategy(jobDescription, cvText, options = {}) {
    const pipelineStart = performance.now();
    const timings = {};

    console.log('[UniversalStrategy] 🚀 Starting 700ms universal strategy pipeline');

    // PHASE 1: Extract + Classify (125ms)
    const keywords = extractAndClassifyKeywords(jobDescription);
    timings.extraction = keywords.timing;

    if (!keywords.all.length) {
      return { success: false, error: 'No keywords extracted', timing: performance.now() - pipelineStart };
    }

    // PHASE 2: Optimal Section Allocation
    const allocation = allocateSectionsOptimally(keywords);

    // PHASE 3: Intelligent Placement (200ms)
    const placementResult = await intelligentKeywordPlacement(cvText, keywords, allocation);
    timings.placement = placementResult.timing;

    // PHASE 4: Format Skills Section
    let tailoredCV = formatSkillsSection(placementResult.tailoredCV, allocation.skills);

    // PHASE 5: Validation
    const validation = validateTailoring(tailoredCV, keywords);
    
    // If validation fails, attempt second pass
    if (!validation.isValid && validation.coverage < 85) {
      console.log('[UniversalStrategy] Validation failed, attempting recovery pass');
      const recovery = await intelligentKeywordPlacement(tailoredCV, { ...keywords, all: validation.missing }, allocation);
      tailoredCV = formatSkillsSection(recovery.tailoredCV, allocation.skills);
    }

    const finalValidation = validateTailoring(tailoredCV, keywords);

    const totalTime = performance.now() - pipelineStart;
    timings.total = totalTime;

    console.log(`[UniversalStrategy] ✅ Pipeline complete in ${totalTime.toFixed(0)}ms (target: ${TIMING_TARGETS.TOTAL}ms)`);
    console.log('[UniversalStrategy] Validation:', finalValidation.checks);

    return {
      success: true,
      tailoredCV,
      originalCV: cvText,
      keywords,
      allocation,
      injectedKeywords: placementResult.injectedKeywords,
      validation: finalValidation,
      matchScore: finalValidation.coverage,
      matchedKeywords: finalValidation.matched,
      missingKeywords: finalValidation.missing,
      timings,
      meetsTarget: totalTime <= TIMING_TARGETS.TOTAL
    };
  }

  // ============ JOB-GENIE INTEGRATION HELPERS ============
  
  /**
   * Format keywords for Job-Genie display panel
   * Returns structured data for the UI keyword chips
   */
  function formatForJobGenieUI(keywords) {
    return {
      highPriority: keywords.highROI || keywords.highPriority || [],
      mediumPriority: keywords.mediumROI || keywords.mediumPriority || [],
      lowPriority: keywords.lowROI || keywords.lowPriority || [],
      all: keywords.all || [],
      total: (keywords.all || []).length,
      structured: {
        technical: keywords.highROI || [],
        process: keywords.mediumROI || [],
        soft: keywords.lowROI || []
      }
    };
  }

  /**
   * Check if CV needs tailoring based on current match score
   */
  function needsTailoring(cvText, keywords, threshold = 85) {
    const cvLower = cvText.toLowerCase();
    const matched = (keywords.all || []).filter(kw => cvLower.includes(kw.toLowerCase()));
    const score = keywords.all.length > 0 ? (matched.length / keywords.all.length) * 100 : 0;
    return score < threshold;
  }

  // ============ EXPORTS ============
  global.UniversalKeywordStrategy = {
    executeUniversalStrategy,
    extractAndClassifyKeywords,
    allocateSectionsOptimally,
    intelligentKeywordPlacement,
    formatSkillsSection,
    validateTailoring,
    formatForJobGenieUI,
    needsTailoring,
    ROI_CLASSIFICATION,
    INJECTION_TEMPLATES,
    TIMING_TARGETS
  };

  // Backward compatibility aliases
  global.KeywordStrategy = global.UniversalKeywordStrategy;

})(typeof window !== 'undefined' ? window : global);
