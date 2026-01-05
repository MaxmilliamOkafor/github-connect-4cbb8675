// unique-cv-engine.js - Unique CV Per Job Engine
// Preserves user's EXACT companies, roles, dates, metrics
// Only modifies bullet PHRASING with job keywords for top 1% differentiation

(function(global) {
  'use strict';

  // ============ CONFIGURATION ============
  const CONFIG = {
    MAX_KEYWORDS_PER_BULLET: 2,
    BULLET_VARIATIONS_PER_ROLE: 8,
    PRESERVE_METRICS: true,
    PRESERVE_ACHIEVEMENTS: true
  };

  // ============ ACTION VERBS (Top 1% Candidate Phrasing) ============
  const ACTION_VERBS = [
    'Led', 'Delivered', 'Engineered', 'Implemented', 'Drove', 'Optimized', 'Architected', 'Spearheaded',
    'Established', 'Pioneered', 'Accelerated', 'Transformed', 'Streamlined', 'Orchestrated', 'Scaled'
  ];

  // ============ BULLET TEMPLATES (8 variations) ============
  const BULLET_TEMPLATES = [
    '{verb} {keyword1} {achievement} achieving {metric}',
    'Led {keyword1} {achievement} delivering {metric} results',
    'Delivered {keyword1} {achievement} reducing {metric} time',
    'Engineered {keyword1} {achievement} increasing {metric}',
    'Implemented {keyword1} {achievement} achieving {metric} efficiency',
    'Drove {keyword1} {achievement} with {metric} success',
    'Optimized {keyword1} {achievement} yielding {metric} impact',
    'Architected {keyword1} {achievement} boosting {metric}'
  ];

  // ============ NATURAL INJECTION PHRASES ============
  const INJECTION_PHRASES = [
    'leveraging', 'utilizing', 'through', 'via', 'employing',
    'incorporating', 'with expertise in', 'applying'
  ];

  // ============ EXTRACT METRICS FROM TEXT ============
  function extractMetrics(text) {
    const metrics = [];
    
    // Percentage patterns: 25%, 50%+, ~30%
    const percentages = text.match(/[\d,]+\.?\d*\s*%|\d+\+?\s*percent/gi) || [];
    percentages.forEach(p => metrics.push(p.trim()));
    
    // Number patterns: $1.2M, 500K, 10x, 3x faster
    const numbers = text.match(/\$[\d,]+\.?\d*[KMB]?|[\d,]+\s*[xX]\s*(?:faster|improvement|increase)|[\d,]+[KMB]\+?/gi) || [];
    numbers.forEach(n => metrics.push(n.trim()));
    
    // Time patterns: 2 weeks, 30 days
    const times = text.match(/\d+\s*(?:days?|weeks?|months?|hours?)\s*(?:faster|reduction|ahead)?/gi) || [];
    times.forEach(t => metrics.push(t.trim()));

    return metrics;
  }

  // ============ PARSE USER CV STRUCTURE ============
  function parseUserCV(cvText) {
    if (!cvText) return { header: '', sections: {}, rawRoles: [] };

    const lines = cvText.split('\n');
    let currentSection = 'header';
    const sections = { header: [], experience: [], skills: [], education: [], certifications: [], summary: [], technicalProficiencies: [] };
    const rawRoles = [];
    
    // Section header patterns
    const sectionPatterns = {
      experience: /^(EXPERIENCE|WORK\s*EXPERIENCE|EMPLOYMENT|PROFESSIONAL\s*EXPERIENCE)[\s:]*$/i,
      skills: /^(SKILLS|TECHNICAL\s*SKILLS|CORE\s*SKILLS)[\s:]*$/i,
      education: /^(EDUCATION|ACADEMIC|QUALIFICATIONS)[\s:]*$/i,
      certifications: /^(CERTIFICATIONS?|LICENSES?)[\s:]*$/i,
      summary: /^(PROFESSIONAL\s*SUMMARY|SUMMARY|PROFILE|OBJECTIVE)[\s:]*$/i,
      technicalProficiencies: /^(TECHNICAL\s*PROFICIENCIES)[\s:]*$/i
    };

    // Role header pattern (Company | Title | Date)
    const roleHeaderPattern = /^([A-Z][A-Za-z\s&.,]+)\s*\|\s*(.+?)\s*\|?\s*$/;
    const datePattern = /^([A-Za-z]+\s+\d{4})\s*[-–]\s*(Present|[A-Za-z]+\s+\d{4})/i;

    let currentRole = null;

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      
      // Check for section headers
      for (const [sectionName, pattern] of Object.entries(sectionPatterns)) {
        if (pattern.test(trimmed)) {
          currentSection = sectionName;
          sections[sectionName].push(trimmed);
          return;
        }
      }

      // Store line in current section
      if (sections[currentSection]) {
        sections[currentSection].push(line);
      }

      // Track roles within experience section
      if (currentSection === 'experience') {
        const roleMatch = trimmed.match(roleHeaderPattern);
        const isDateLine = datePattern.test(trimmed);
        const isBullet = /^[-•*▪▸]\s/.test(trimmed);

        if (roleMatch || (trimmed.length > 10 && !isBullet && idx > 0 && trimmed.includes('|'))) {
          if (currentRole) rawRoles.push(currentRole);
          currentRole = { 
            header: trimmed, 
            company: roleMatch?.[1] || '', 
            title: roleMatch?.[2] || '',
            dateLines: [],
            bullets: [],
            originalBullets: []
          };
        } else if (currentRole && isDateLine) {
          currentRole.dateLines.push(trimmed);
        } else if (currentRole && isBullet) {
          const bulletContent = trimmed.replace(/^[-•*▪▸]\s*/, '');
          currentRole.bullets.push(bulletContent);
          currentRole.originalBullets.push({ text: bulletContent, metrics: extractMetrics(bulletContent) });
        }
      }
    });

    if (currentRole) rawRoles.push(currentRole);

    return {
      header: sections.header.join('\n'),
      sections,
      rawRoles,
      rawText: cvText
    };
  }

  // ============ GENERATE UNIQUE BULLET (JOB-TAILORED - AGGRESSIVE INJECTION) ============
  function generateUniqueBullet(originalBullet, allKeywords, usedKeywords, templateIndex, priorityMap = {}) {
    if (!originalBullet || !allKeywords?.length) return originalBullet.text || originalBullet;

    const bulletText = originalBullet.text || originalBullet;
    const metrics = originalBullet.metrics || extractMetrics(bulletText);
    const bulletLower = bulletText.toLowerCase();

    // Find keywords NOT already in this bullet (include all priority levels)
    const availableKeywords = allKeywords.filter(kw => 
      !bulletLower.includes(kw.toLowerCase())
    );
    
    // Sort by priority: high first, then medium, then low
    const sortedAvailable = availableKeywords.sort((a, b) => {
      const aPriority = priorityMap[a.toLowerCase()] || 'low';
      const bPriority = priorityMap[b.toLowerCase()] || 'low';
      const order = { high: 0, medium: 1, low: 2 };
      return order[aPriority] - order[bPriority];
    });

    if (sortedAvailable.length === 0) return bulletText;

    // Select 2-3 keywords to inject per bullet (more aggressive)
    const maxToInject = Math.min(3, CONFIG.MAX_KEYWORDS_PER_BULLET + 1);
    const keywordsToInject = sortedAvailable.slice(0, maxToInject);
    const phrase = INJECTION_PHRASES[Math.floor(Math.random() * INJECTION_PHRASES.length)];

    // Track used keywords
    keywordsToInject.forEach(kw => usedKeywords.add(kw.toLowerCase()));

    // PRESERVE original achievement and metrics, inject keywords naturally
    let enhanced = bulletText;
    
    // Strategy 1: Inject after first clause
    const firstClauseEnd = bulletText.search(/,|and\s|while\s|by\s/i);
    if (firstClauseEnd > 15 && firstClauseEnd < bulletText.length / 2) {
      const before = bulletText.slice(0, firstClauseEnd);
      const after = bulletText.slice(firstClauseEnd);
      enhanced = `${before} ${phrase} ${keywordsToInject.join(' and ')}${after}`;
    } else {
      // Strategy 2: Append before final metric/period
      const lastMetricPos = bulletText.lastIndexOf('%');
      const lastPeriod = bulletText.lastIndexOf('.');
      const insertPos = lastMetricPos > -1 ? bulletText.lastIndexOf(' ', lastMetricPos) : (lastPeriod > -1 ? lastPeriod : bulletText.length);
      
      if (insertPos > 20) {
        const before = bulletText.slice(0, insertPos);
        const after = bulletText.slice(insertPos);
        enhanced = `${before.trimEnd()}, ${phrase} ${keywordsToInject.join(' and ')}${after}`;
      } else {
        enhanced = `${bulletText.replace(/\.?\s*$/, '')} ${phrase} ${keywordsToInject.join(' and ')}.`;
      }
    }

    return enhanced;
  }

  // ============ GENERATE UNIQUE CV FOR JOB (ALL KEYWORDS - 100% MATCH) ============
  function generateUniqueCVForJob(cvText, jobKeywords, candidateData = {}) {
    const startTime = performance.now();
    
    // Support both array of keywords and structured keyword object
    let allKeywords = [];
    let priorityMap = {};
    
    if (Array.isArray(jobKeywords)) {
      allKeywords = jobKeywords;
    } else if (jobKeywords?.all) {
      allKeywords = jobKeywords.all;
      // Build priority map for sorting
      (jobKeywords.highPriority || []).forEach(kw => priorityMap[kw.toLowerCase()] = 'high');
      (jobKeywords.mediumPriority || []).forEach(kw => priorityMap[kw.toLowerCase()] = 'medium');
      (jobKeywords.lowPriority || []).forEach(kw => priorityMap[kw.toLowerCase()] = 'low');
    }
    
    if (!cvText || allKeywords.length === 0) {
      return { uniqueCV: cvText, stats: {}, timing: 0 };
    }

    const parsed = parseUserCV(cvText);
    const usedKeywords = new Set();
    const stats = { 
      rolesProcessed: 0, 
      bulletsModified: 0, 
      keywordsInjected: 0,
      preservedCompanies: [],
      preservedTitles: [],
      preservedMetrics: [],
      keywordCoverage: { high: 0, medium: 0, low: 0 }
    };

    // Process each role - PRESERVE company, title, dates; MODIFY bullets only
    // More aggressive injection: inject into ALL bullets until all keywords are covered
    const modifiedRoles = parsed.rawRoles.map((role, roleIdx) => {
      stats.rolesProcessed++;
      stats.preservedCompanies.push(role.company);
      stats.preservedTitles.push(role.title);

      // Role weight: more recent roles get more keywords
      const roleWeight = Math.max(1, 5 - roleIdx); // 5, 4, 3, 2, 1 for first 5 roles
      
      // All roles get access to all keywords - we want 100% coverage
      const keywordsForRole = allKeywords;

      const modifiedBullets = role.originalBullets.map((bullet, bulletIdx) => {
        // Preserve metrics in stats
        bullet.metrics.forEach(m => stats.preservedMetrics.push(m));

        // Inject into EVERY bullet until we hit 100% keyword coverage
        const enhanced = generateUniqueBullet(bullet, keywordsForRole, usedKeywords, bulletIdx, priorityMap);
        if (enhanced !== bullet.text) {
          stats.bulletsModified++;
          
          // Count injected keywords by priority
          const injected = allKeywords.filter(kw => 
            enhanced.toLowerCase().includes(kw.toLowerCase()) && 
            !bullet.text.toLowerCase().includes(kw.toLowerCase())
          );
          stats.keywordsInjected += injected.length;
          
          injected.forEach(kw => {
            const priority = priorityMap[kw.toLowerCase()] || 'low';
            stats.keywordCoverage[priority]++;
          });
        }
        return enhanced;
      });

      return {
        ...role,
        modifiedBullets
      };
    });

    // Reconstruct CV with preserved structure + modified bullets
    const uniqueCV = reconstructCVWithModifiedBullets(parsed, modifiedRoles);

    const timing = performance.now() - startTime;
    console.log(`[UniqueCVEngine] Generated unique CV in ${timing.toFixed(0)}ms:`, 
      `${stats.keywordsInjected} keywords injected (H:${stats.keywordCoverage.high} M:${stats.keywordCoverage.medium} L:${stats.keywordCoverage.low})`);

    return {
      uniqueCV,
      originalCV: cvText,
      stats,
      timing,
      fileHash: generateFileHash(uniqueCV)
    };
  }

  // ============ RECONSTRUCT CV WITH MODIFIED BULLETS ============
  function reconstructCVWithModifiedBullets(parsed, modifiedRoles) {
    const parts = [];

    // Header (preserved)
    if (parsed.sections.header?.length) {
      parts.push(parsed.sections.header.join('\n'));
    }

    // Summary (preserved)
    if (parsed.sections.summary?.length) {
      parts.push(parsed.sections.summary.join('\n'));
    }

    // Experience section with modified bullets
    parts.push('EXPERIENCE');
    modifiedRoles.forEach(role => {
      parts.push(role.header);
      role.dateLines.forEach(d => parts.push(d));
      role.modifiedBullets.forEach(b => parts.push(`• ${b}`));
      parts.push(''); // Blank line between roles
    });

    // Skills (preserved)
    if (parsed.sections.skills?.length) {
      parts.push(parsed.sections.skills.join('\n'));
    }

    // Technical Proficiencies (preserved)
    if (parsed.sections.technicalProficiencies?.length) {
      parts.push(parsed.sections.technicalProficiencies.join('\n'));
    }

    // Education (preserved)
    if (parsed.sections.education?.length) {
      parts.push(parsed.sections.education.join('\n'));
    }

    // Certifications (preserved)
    if (parsed.sections.certifications?.length) {
      parts.push(parsed.sections.certifications.join('\n'));
    }

    return parts.join('\n').replace(/\n{3,}/g, '\n\n');
  }

  // ============ GENERATE FILE HASH (UNIQUE PER JOB) ============
  function generateFileHash(content) {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  // ============ GENERATE FILENAME ============
  function generateFilename(candidateData, type = 'cv') {
    const firstName = (candidateData?.firstName || candidateData?.first_name || 'Applicant').replace(/\s+/g, '_').replace(/[^a-zA-Z_]/g, '');
    const lastName = (candidateData?.lastName || candidateData?.last_name || '').replace(/\s+/g, '_').replace(/[^a-zA-Z_]/g, '');
    
    if (type === 'cv') {
      return lastName ? `${firstName}_${lastName}_CV.pdf` : `${firstName}_CV.pdf`;
    } else {
      return lastName ? `${firstName}_${lastName}_Cover_Letter.pdf` : `${firstName}_Cover_Letter.pdf`;
    }
  }

  // ============ EXPORTS ============
  global.UniqueCVEngine = {
    generateUniqueCVForJob,
    parseUserCV,
    generateUniqueBullet,
    generateFilename,
    generateFileHash,
    extractMetrics,
    CONFIG
  };

})(typeof window !== 'undefined' ? window : global);
