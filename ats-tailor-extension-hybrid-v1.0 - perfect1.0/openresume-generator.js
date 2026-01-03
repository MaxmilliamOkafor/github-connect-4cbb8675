// openresume-generator.js - OpenResume-Style ATS PDF Generator
// PERFECT FORMAT: Arial 10.5pt, 1" margins, selectable text, 100% ATS parsing
// Based on https://github.com/xitanggg/open-resume methodology

(function(global) {
  'use strict';

  // ============ OPENRESUME ATS SPECIFICATIONS ============
  const ATS_SPEC = {
    font: {
      family: 'helvetica', // jsPDF uses helvetica as Arial equivalent
      name: 14,            // Name: 14pt
      sectionTitle: 11,    // Section headers: 11pt bold
      body: 10.5,          // Body text: 10.5pt (critical)
      small: 9             // Small text: 9pt
    },
    margins: {
      top: 72,    // 1 inch = 72pt
      bottom: 72,
      left: 72,
      right: 72
    },
    lineHeight: 1.15,
    page: {
      width: 595.28,   // A4 width in points
      height: 841.89,  // A4 height in points
      maxPages: 2
    },
    bullets: {
      char: '-',       // Standard Unicode dash (ATS safe)
      indent: 10
    }
  };

  // ============ MAIN GENERATOR CLASS ============
  const OpenResumeGenerator = {

    // ============ GENERATE COMPLETE ATS PACKAGE ============
    // Returns: { cv: blob, cover: blob, cvFilename, coverFilename, matchScore }
    async generateATSPackage(baseCV, keywords, jobData, candidateData) {
      const startTime = performance.now();
      console.log('[OpenResume] Generating ATS Package...');

      // Parse and structure CV data
      const cvData = this.parseAndStructureCV(baseCV, candidateData);
      
      // Tailor CV with keywords
      const tailoredData = this.tailorCVData(cvData, keywords, jobData);
      
      // Generate CV PDF
      const cvResult = await this.generateCVPDF(tailoredData, candidateData);
      
      // Generate Cover Letter PDF
      const coverResult = await this.generateCoverLetterPDF(tailoredData, keywords, jobData, candidateData);
      
      // Calculate match score
      const matchScore = this.calculateMatchScore(tailoredData, keywords);
      
      const timing = performance.now() - startTime;
      console.log(`[OpenResume] Package generated in ${timing.toFixed(0)}ms`);

      return {
        cv: cvResult.blob,
        cvBase64: cvResult.base64,
        cvFilename: cvResult.filename,
        cover: coverResult.blob,
        coverBase64: coverResult.base64,
        coverFilename: coverResult.filename,
        matchScore,
        timing,
        tailoredData
      };
    },

    // ============ PARSE AND STRUCTURE CV ============
    parseAndStructureCV(cvText, candidateData) {
      const data = {
        contact: {
          name: '',
          phone: '',
          email: '',
          location: '',
          linkedin: '',
          github: '',
          portfolio: ''
        },
        summary: '',
        experience: [],
        skills: [],
        education: [],
        certifications: []
      };

      // Extract from candidate data first
      if (candidateData) {
        data.contact.name = `${candidateData.firstName || candidateData.first_name || ''} ${candidateData.lastName || candidateData.last_name || ''}`.trim();
        data.contact.phone = candidateData.phone || '';
        data.contact.email = candidateData.email || '';
        data.contact.location = candidateData.city || candidateData.location || '';
        data.contact.linkedin = candidateData.linkedin || '';
        data.contact.github = candidateData.github || '';
        data.contact.portfolio = candidateData.portfolio || '';
        
        // Extract structured data if available
        if (candidateData.workExperience || candidateData.work_experience) {
          data.experience = (candidateData.workExperience || candidateData.work_experience).map(exp => ({
            company: exp.company || exp.organization || '',
            title: exp.title || exp.position || exp.role || '',
            dates: exp.dates || exp.duration || `${exp.startDate || ''} - ${exp.endDate || 'Present'}`,
            location: exp.location || '',
            bullets: this.normalizeBullets(exp.bullets || exp.achievements || exp.responsibilities || [])
          }));
        }
        
        if (candidateData.skills) {
          data.skills = Array.isArray(candidateData.skills) 
            ? candidateData.skills 
            : candidateData.skills.split(',').map(s => s.trim());
        }
        
        if (candidateData.education) {
          data.education = candidateData.education.map(edu => ({
            institution: edu.institution || edu.school || edu.university || '',
            degree: edu.degree || '',
            dates: edu.dates || edu.graduationDate || '',
            gpa: edu.gpa || ''
          }));
        }
        
        if (candidateData.certifications) {
          data.certifications = Array.isArray(candidateData.certifications) 
            ? candidateData.certifications 
            : [candidateData.certifications];
        }
      }

      // Parse from CV text if structured data is missing
      if (cvText && data.experience.length === 0) {
        const parsed = this.parseCVText(cvText);
        Object.assign(data, parsed);
      }

      return data;
    },

    // ============ NORMALIZE BULLETS TO ARRAY ============
    normalizeBullets(bullets) {
      if (!bullets) return [];
      if (Array.isArray(bullets)) return bullets.map(b => b.replace(/^[-•*▪]\s*/, '').trim());
      return bullets.split('\n').filter(b => b.trim()).map(b => b.replace(/^[-•*▪]\s*/, '').trim());
    },

    // ============ PARSE CV TEXT ============
    parseCVText(cvText) {
      const result = {
        summary: '',
        experience: [],
        skills: [],
        education: [],
        certifications: []
      };

      const lines = cvText.split('\n');
      let currentSection = '';
      let currentContent = [];
      let currentJob = null;

      const sectionMap = {
        'PROFESSIONAL SUMMARY': 'summary',
        'SUMMARY': 'summary',
        'PROFILE': 'summary',
        'WORK EXPERIENCE': 'experience',
        'EXPERIENCE': 'experience',
        'EMPLOYMENT': 'experience',
        'SKILLS': 'skills',
        'TECHNICAL SKILLS': 'skills',
        'EDUCATION': 'education',
        'CERTIFICATIONS': 'certifications'
      };

      for (const line of lines) {
        const trimmed = line.trim();
        const upperTrimmed = trimmed.toUpperCase().replace(/[:\s]+$/, '');

        if (sectionMap[upperTrimmed]) {
          // Save previous section content
          this.saveSection(result, currentSection, currentContent, currentJob);
          currentSection = sectionMap[upperTrimmed];
          currentContent = [];
          currentJob = null;
        } else if (currentSection) {
          currentContent.push(line);
        }
      }

      // Save last section
      this.saveSection(result, currentSection, currentContent, currentJob);

      return result;
    },

    saveSection(result, section, content, job) {
      if (!section || content.length === 0) return;

      const text = content.join('\n').trim();

      switch (section) {
        case 'summary':
          result.summary = text;
          break;
        case 'skills':
          result.skills = text.split(/[,\n]/).map(s => s.trim()).filter(s => s.length > 1);
          break;
        case 'experience':
          result.experience = this.parseExperienceText(text);
          break;
        case 'education':
          result.education = this.parseEducationText(text);
          break;
        case 'certifications':
          result.certifications = text.split(/[,\n]/).map(s => s.trim()).filter(s => s.length > 2);
          break;
      }
    },

    // ============ PARSE EXPERIENCE TEXT ============
    parseExperienceText(text) {
      const jobs = [];
      const lines = text.split('\n');
      let currentJob = null;

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Detect job header: Company | Title | Dates | Location
        if (/^[A-Z][A-Za-z\s&.,]+\s*\|/.test(trimmed) || 
            /^(Meta|Google|Amazon|Microsoft|Apple|Solim|Accenture|Citigroup)/i.test(trimmed)) {
          if (currentJob) jobs.push(currentJob);
          
          const parts = trimmed.split('|').map(p => p.trim());
          currentJob = {
            company: parts[0] || '',
            title: parts[1] || '',
            dates: parts[2] || '',
            location: parts[3] || '',
            bullets: []
          };
        } else if (currentJob && /^[-•*▪]/.test(trimmed)) {
          currentJob.bullets.push(trimmed.replace(/^[-•*▪]\s*/, ''));
        }
      }

      if (currentJob) jobs.push(currentJob);
      return jobs;
    },

    // ============ PARSE EDUCATION TEXT ============
    parseEducationText(text) {
      const entries = [];
      const lines = text.split('\n').filter(l => l.trim());

      for (const line of lines) {
        const parts = line.split('|').map(p => p.trim());
        if (parts.length >= 2) {
          entries.push({
            institution: parts[0],
            degree: parts[1],
            dates: parts[2] || '',
            gpa: parts[3] || ''
          });
        } else if (line.trim()) {
          entries.push({
            institution: line.trim(),
            degree: '',
            dates: '',
            gpa: ''
          });
        }
      }

      return entries;
    },

    // ============ TAILOR CV DATA WITH KEYWORDS ============
    tailorCVData(cvData, keywords, jobData) {
      const tailored = JSON.parse(JSON.stringify(cvData)); // Deep clone
      const highPriority = keywords.highPriority || keywords.slice(0, 15);
      const allKeywords = keywords.all || keywords;

      // 1. Update location to job location
      if (jobData?.location) {
        tailored.contact.location = this.normalizeLocation(jobData.location);
      }

      // 2. Enhance summary with top 3-5 keywords
      tailored.summary = this.enhanceSummary(cvData.summary, highPriority.slice(0, 5));

      // 3. Inject keywords into experience (3-5x distribution)
      tailored.experience = this.injectKeywordsIntoExperience(cvData.experience, highPriority, {
        minMentions: 3,
        maxMentions: 5
      });

      // 4. Merge keywords into skills
      tailored.skills = this.mergeSkills(cvData.skills, allKeywords);

      return tailored;
    },

    // ============ NORMALIZE LOCATION ============
    normalizeLocation(location) {
      if (!location) return '';
      // Remove country codes, normalize format
      return location
        .replace(/,\s*(US|USA|United States)$/i, '')
        .replace(/,\s*(UK|United Kingdom)$/i, '')
        .trim();
    },

    // ============ ENHANCE SUMMARY WITH KEYWORDS ============
    enhanceSummary(summary, keywords) {
      if (!summary) {
        // Generate default summary
        return `Results-driven professional with expertise in ${keywords.slice(0, 3).join(', ')}. Proven track record of delivering high-impact solutions and driving measurable business outcomes.`;
      }

      const summaryLower = summary.toLowerCase();
      const missing = keywords.filter(kw => !summaryLower.includes(kw.toLowerCase()));

      if (missing.length > 0) {
        const injection = `. Expertise includes ${missing.slice(0, 3).join(', ')}`;
        if (summary.endsWith('.')) {
          return summary.slice(0, -1) + injection + '.';
        }
        return summary + injection + '.';
      }

      return summary;
    },

    // ============ INJECT KEYWORDS INTO EXPERIENCE (3-5x distribution) ============
    injectKeywordsIntoExperience(experience, keywords, options = {}) {
      const { minMentions = 3, maxMentions = 5 } = options;
      if (!experience || experience.length === 0) return experience;

      // Track keyword mentions
      const mentions = {};
      keywords.forEach(kw => mentions[kw] = 0);

      // Count existing mentions
      experience.forEach(job => {
        job.bullets.forEach(bullet => {
          keywords.forEach(kw => {
            if (bullet.toLowerCase().includes(kw.toLowerCase())) {
              mentions[kw]++;
            }
          });
        });
      });

      // Distribution strategy: more recent roles get more keywords
      const roleDistribution = [
        { maxPerBullet: 2, maxBullets: 4 }, // Role 1 (most recent)
        { maxPerBullet: 2, maxBullets: 3 }, // Role 2
        { maxPerBullet: 1, maxBullets: 2 }, // Role 3
        { maxPerBullet: 1, maxBullets: 2 }  // Role 4+
      ];

      // Natural injection phrases
      const phrases = [
        'leveraging', 'utilizing', 'implementing', 'applying',
        'through', 'incorporating', 'employing', 'using'
      ];
      const getPhrase = () => phrases[Math.floor(Math.random() * phrases.length)];

      return experience.map((job, jobIndex) => {
        const config = roleDistribution[Math.min(jobIndex, roleDistribution.length - 1)];
        
        const enhancedBullets = job.bullets.map((bullet, bulletIndex) => {
          if (bulletIndex >= config.maxBullets) return bullet;

          // Find keywords that need more mentions
          const needsMore = keywords.filter(kw => {
            const current = mentions[kw];
            const inBullet = bullet.toLowerCase().includes(kw.toLowerCase());
            return current < minMentions && !inBullet;
          });

          if (needsMore.length === 0) return bullet;

          // Inject 1-2 keywords (natural placement inside the sentence)
          const toInject = needsMore.slice(0, config.maxPerBullet);
          let enhanced = bullet;

          const insertKeywordNaturally = (text, kw, phrase) => {
            const lower = (text || '').toLowerCase();
            if (lower.includes(kw.toLowerCase())) return text;

            // Prefer inserting right after strong action verbs
            const verbMatch = text.match(/^(Led|Managed|Developed|Built|Created|Implemented|Designed|Engineered|Delivered|Owned|Optimized|Automated)\b/i);
            if (verbMatch) {
              const idx = verbMatch[0].length;
              return `${text.slice(0, idx)} ${kw}-driven${text.slice(idx)}`;
            }

            // Prefer inserting near first comma (keeps it readable)
            const commaIdx = text.indexOf(',');
            if (commaIdx > 20 && commaIdx < text.length / 2) {
              return `${text.slice(0, commaIdx)}, ${phrase} ${kw}${text.slice(commaIdx)}`;
            }

            // Prefer inserting before final period
            if (text.endsWith('.')) {
              return `${text.slice(0, -1)}, ${phrase} ${kw}.`;
            }

            return `${text}, ${phrase} ${kw}`;
          };

          toInject.forEach(kw => {
            if (mentions[kw] >= maxMentions) return;
            const phrase = getPhrase();
            const next = insertKeywordNaturally(enhanced, kw, phrase);
            if (next !== enhanced) {
              enhanced = next;
              mentions[kw]++;
            }
          });

          return enhanced;
        });

        return { ...job, bullets: enhancedBullets };
      });
    },

    // ============ MERGE SKILLS WITH KEYWORDS ============
    mergeSkills(existingSkills, keywords) {
      const skillSet = new Set((existingSkills || []).map(s => s.toLowerCase()));
      const merged = [...(existingSkills || [])];

      // Add top keywords not already in skills
      const topKeywords = (keywords.all || keywords).slice(0, 10);
      topKeywords.forEach(kw => {
        if (!skillSet.has(kw.toLowerCase())) {
          merged.push(this.formatSkillName(kw));
          skillSet.add(kw.toLowerCase());
        }
      });

      // Limit to 25 skills max
      return merged.slice(0, 25);
    },

    // ============ FORMAT SKILL NAME ============
    formatSkillName(skill) {
      const acronyms = new Set([
        'SQL', 'AWS', 'GCP', 'API', 'REST', 'HTML', 'CSS', 'JSON', 'XML',
        'CI', 'CD', 'ETL', 'ML', 'AI', 'NLP', 'LLM', 'UI', 'UX', 'SDK',
        'HTTP', 'JWT', 'OAuth', 'CRUD', 'ORM', 'MVC', 'TDD', 'NoSQL'
      ]);

      return skill.split(/\s+/).map(word => {
        const upper = word.toUpperCase();
        if (acronyms.has(upper)) return upper;
        if (word.length <= 2) return word.toUpperCase();
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }).join(' ');
    },

    // ============ GENERATE CV PDF (OpenResume Style) ============
    async generateCVPDF(tailoredData, candidateData) {
      const startTime = performance.now();

      // Generate filename: {FirstName}_{LastName}_ATS_CV.pdf
      const firstName = (candidateData?.firstName || candidateData?.first_name || 'Applicant')
        .replace(/\s+/g, '_').replace(/[^a-zA-Z_]/g, '');
      const lastName = (candidateData?.lastName || candidateData?.last_name || '')
        .replace(/\s+/g, '_').replace(/[^a-zA-Z_]/g, '');
      const filename = lastName ? `${firstName}_${lastName}_ATS_CV.pdf` : `${firstName}_ATS_CV.pdf`;

      let pdfBlob = null;
      let pdfBase64 = null;

      if (typeof jspdf !== 'undefined' && jspdf.jsPDF) {
        const result = await this.renderCVWithJsPDF(tailoredData);
        pdfBlob = result.blob;
        pdfBase64 = result.base64;
      } else {
        // Fallback: text-based PDF
        const text = this.generateCVText(tailoredData);
        pdfBase64 = btoa(unescape(encodeURIComponent(text)));
      }

      console.log(`[OpenResume] CV PDF generated in ${(performance.now() - startTime).toFixed(0)}ms`);

      return { blob: pdfBlob, base64: pdfBase64, filename };
    },

    // ============ RENDER CV WITH JSPDF (OpenResume Style) ============
    async renderCVWithJsPDF(data) {
      const { jsPDF } = jspdf;
      const { font, margins, lineHeight, page } = ATS_SPEC;
      const contentWidth = page.width - margins.left - margins.right;

      const doc = new jsPDF({ format: 'a4', unit: 'pt', putOnlyUsedFonts: true });
      doc.setFont(font.family, 'normal');
      let y = margins.top;

      // Helper: Add text with word wrap and page breaks
      const addText = (text, isBold = false, isCentered = false, size = font.body) => {
        doc.setFontSize(size);
        doc.setFont(font.family, isBold ? 'bold' : 'normal');
        
        const lines = doc.splitTextToSize(text, contentWidth);
        lines.forEach(line => {
          if (y > page.height - margins.bottom - 20) {
            doc.addPage();
            y = margins.top;
          }
          const x = isCentered ? (page.width - doc.getTextWidth(line)) / 2 : margins.left;
          doc.text(line, x, y);
          y += size * lineHeight + 2;
        });
      };

      // Helper: Add section header with line
      const addSectionHeader = (title) => {
        if (y > page.height - margins.bottom - 50) {
          doc.addPage();
          y = margins.top;
        }
        y += 10;
        addText(title, true, false, font.sectionTitle);
        doc.setLineWidth(0.5);
        doc.line(margins.left, y - 2, page.width - margins.right, y - 2);
        y += 4;
      };

      // === NAME ===
      addText(data.contact.name.toUpperCase(), true, true, font.name);
      y += 2;

      // === CONTACT LINE ===
      const contactParts = [data.contact.phone, data.contact.email, data.contact.location].filter(Boolean);
      if (contactParts.length > 0) {
        addText(contactParts.join(' | '), false, true, font.body);
      }

      // === LINKS LINE ===
      const linkParts = [data.contact.linkedin, data.contact.github, data.contact.portfolio].filter(Boolean);
      if (linkParts.length > 0) {
        addText(linkParts.join(' | '), false, true, font.small);
      }

      y += 8;

      // === PROFESSIONAL SUMMARY ===
      if (data.summary) {
        addSectionHeader('PROFESSIONAL SUMMARY');
        addText(data.summary, false, false, font.body);
        y += 4;
      }

      // === WORK EXPERIENCE ===
      if (data.experience && data.experience.length > 0) {
        addSectionHeader('WORK EXPERIENCE');
        
        data.experience.forEach((job, idx) => {
          // Job header: Company | Title | Dates | Location
          const header = [job.company, job.title, job.dates, job.location].filter(Boolean).join(' | ');
          addText(header, true, false, font.body);
          y += 2;

          // Bullets
          job.bullets.forEach(bullet => {
            const bulletText = `${ATS_SPEC.bullets.char} ${bullet}`;
            doc.setFont(font.family, 'normal');
            doc.setFontSize(font.body);
            
            const bulletLines = doc.splitTextToSize(bulletText, contentWidth - ATS_SPEC.bullets.indent);
            bulletLines.forEach((line, lineIdx) => {
              if (y > page.height - margins.bottom - 20) {
                doc.addPage();
                y = margins.top;
              }
              const indent = lineIdx === 0 ? 0 : ATS_SPEC.bullets.indent;
              doc.text(line, margins.left + indent, y);
              y += font.body * lineHeight + 1;
            });
          });

          if (idx < data.experience.length - 1) y += 6;
        });
        y += 4;
      }

      // === EDUCATION ===
      if (data.education && data.education.length > 0) {
        addSectionHeader('EDUCATION');
        
        data.education.forEach(edu => {
          const eduLine = [edu.institution, edu.degree, edu.dates, edu.gpa ? `GPA: ${edu.gpa}` : ''].filter(Boolean).join(' | ');
          addText(eduLine, false, false, font.body);
        });
        y += 4;
      }

      // === SKILLS (comma-separated, single line) ===
      if (data.skills && data.skills.length > 0) {
        addSectionHeader('SKILLS');
        addText(data.skills.join(', '), false, false, font.body);
        y += 4;
      }

      // === CERTIFICATIONS ===
      if (data.certifications && data.certifications.length > 0) {
        addSectionHeader('CERTIFICATIONS');
        addText(data.certifications.join(', '), false, false, font.body);
      }

      // Generate output
      const base64 = doc.output('datauristring').split(',')[1];
      const blob = doc.output('blob');

      return { base64, blob };
    },

    // ============ GENERATE CV TEXT (Fallback) ============
    generateCVText(data) {
      const lines = [];
      
      lines.push(data.contact.name.toUpperCase());
      lines.push([data.contact.phone, data.contact.email, data.contact.location].filter(Boolean).join(' | '));
      lines.push([data.contact.linkedin, data.contact.github, data.contact.portfolio].filter(Boolean).join(' | '));
      lines.push('');

      if (data.summary) {
        lines.push('PROFESSIONAL SUMMARY');
        lines.push(data.summary);
        lines.push('');
      }

      if (data.experience?.length > 0) {
        lines.push('WORK EXPERIENCE');
        data.experience.forEach(job => {
          lines.push([job.company, job.title, job.dates, job.location].filter(Boolean).join(' | '));
          job.bullets.forEach(b => lines.push(`- ${b}`));
          lines.push('');
        });
      }

      if (data.education?.length > 0) {
        lines.push('EDUCATION');
        data.education.forEach(edu => {
          lines.push([edu.institution, edu.degree, edu.dates, edu.gpa ? `GPA: ${edu.gpa}` : ''].filter(Boolean).join(' | '));
        });
        lines.push('');
      }

      if (data.skills?.length > 0) {
        lines.push('SKILLS');
        lines.push(data.skills.join(', '));
        lines.push('');
      }

      if (data.certifications?.length > 0) {
        lines.push('CERTIFICATIONS');
        lines.push(data.certifications.join(', '));
      }

      return lines.join('\n');
    },

    // ============ GENERATE COVER LETTER PDF ============
    async generateCoverLetterPDF(tailoredData, keywords, jobData, candidateData) {
      const startTime = performance.now();

      // Generate filename
      const firstName = (candidateData?.firstName || candidateData?.first_name || 'Applicant')
        .replace(/\s+/g, '_').replace(/[^a-zA-Z_]/g, '');
      const lastName = (candidateData?.lastName || candidateData?.last_name || '')
        .replace(/\s+/g, '_').replace(/[^a-zA-Z_]/g, '');
      const filename = lastName ? `${firstName}_${lastName}_Cover_Letter.pdf` : `${firstName}_Cover_Letter.pdf`;

      let pdfBlob = null;
      let pdfBase64 = null;

      if (typeof jspdf !== 'undefined' && jspdf.jsPDF) {
        const result = await this.renderCoverLetterWithJsPDF(tailoredData, keywords, jobData, candidateData);
        pdfBlob = result.blob;
        pdfBase64 = result.base64;
      } else {
        const text = this.generateCoverLetterText(tailoredData, keywords, jobData, candidateData);
        pdfBase64 = btoa(unescape(encodeURIComponent(text)));
      }

      console.log(`[OpenResume] Cover Letter PDF generated in ${(performance.now() - startTime).toFixed(0)}ms`);

      return { blob: pdfBlob, base64: pdfBase64, filename };
    },

    // ============ RENDER COVER LETTER WITH JSPDF ============
    async renderCoverLetterWithJsPDF(data, keywords, jobData, candidateData) {
      const { jsPDF } = jspdf;
      const { font, margins, lineHeight, page } = ATS_SPEC;
      const contentWidth = page.width - margins.left - margins.right;

      const doc = new jsPDF({ format: 'a4', unit: 'pt', putOnlyUsedFonts: true });
      doc.setFont(font.family, 'normal');
      let y = margins.top;

      const addText = (text, isBold = false, size = font.body) => {
        doc.setFontSize(size);
        doc.setFont(font.family, isBold ? 'bold' : 'normal');
        
        const lines = doc.splitTextToSize(text, contentWidth);
        lines.forEach(line => {
          doc.text(line, margins.left, y);
          y += size * lineHeight + 2;
        });
      };

      const addCenteredText = (text, isBold = false, size = font.body) => {
        doc.setFontSize(size);
        doc.setFont(font.family, isBold ? 'bold' : 'normal');
        doc.text(text, page.width / 2, y, { align: 'center' });
        y += size * lineHeight + 2;
      };

      // Extract info
      const name = data.contact.name;
      const jobTitle = jobData?.title || 'the open position';
      const company = jobData?.company || 'your company';
      const highPriority = keywords.highPriority || (keywords.all || []).slice(0, 5);
      const topExp = data.experience?.[0]?.company || 'my previous roles';

      // === HEADER ===
      addCenteredText(name.toUpperCase(), true, font.name);
      y += 2;
      
      const contactLine = [data.contact.location, data.contact.email, data.contact.phone].filter(Boolean).join(' | ');
      addCenteredText(contactLine, false, font.body);
      y += 16;

      // === DATE ===
      const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      addText(today, false, font.body);
      y += 8;

      // === RECIPIENT ===
      addText('Hiring Team', true, font.body);
      addText(company, false, font.body);
      if (jobData?.location) addText(jobData.location, false, font.body);
      y += 12;

      // === SALUTATION ===
      addText('Dear Hiring Manager,', false, font.body);
      y += 8;

      // === PARAGRAPH 1: Interest + Keywords ===
      const kw1 = highPriority[0] || 'software development';
      const kw2 = highPriority[1] || 'technical solutions';
      const years = this.extractYearsExperience(data.summary) || '7+';
      
      const para1 = `I am excited to apply for the ${jobTitle} position at ${company}. With ${years} years of experience leading ${kw1} and ${kw2} initiatives, I consistently deliver measurable business impact through innovative technical solutions and cross-functional collaboration.`;
      addText(para1, false, font.body);
      y += 8;

      // === PARAGRAPH 2: Proof + Keywords ===
      const kw3 = highPriority[2] || 'project delivery';
      const kw4 = highPriority[3] || 'team leadership';
      const topBullet = data.experience?.[0]?.bullets?.[0] || 'driving efficiency improvements of 30%+';

      const para2 = `At ${topExp}, I led ${kw3} implementations that resulted in ${this.extractAchievement(topBullet)}. I have extensive experience mentoring cross-functional teams and applying ${kw4} methodologies to deliver complex projects on time and within budget.`;
      addText(para2, false, font.body);
      y += 8;

      // === PARAGRAPH 3: Call to Action ===
      const kw5 = highPriority[4] || 'technical leadership';
      
      const para3 = `I would welcome the opportunity to discuss how my ${kw5} expertise can contribute to ${company}'s continued success. Thank you for considering my application. I look forward to the possibility of contributing to your team.`;
      addText(para3, false, font.body);
      y += 16;

      // === CLOSING ===
      addText('Sincerely,', false, font.body);
      y += 16;
      addText(name, true, font.body);

      // Generate output
      const base64 = doc.output('datauristring').split(',')[1];
      const blob = doc.output('blob');

      return { base64, blob };
    },

    // ============ HELPER: Extract Years Experience ============
    extractYearsExperience(summary) {
      if (!summary) return null;
      const match = summary.match(/(\d+)\+?\s*years?/i);
      return match ? match[1] : null;
    },

    // ============ HELPER: Extract Achievement ============
    extractAchievement(bullet) {
      if (!bullet) return 'significant performance improvements';
      // Try to extract a quantified achievement
      const match = bullet.match(/(\d+%?\s*(?:improvement|increase|reduction|faster|efficiency|growth))/i);
      return match ? match[1] : bullet.slice(0, 50) + (bullet.length > 50 ? '...' : '');
    },

    // ============ GENERATE COVER LETTER TEXT (Fallback) ============
    generateCoverLetterText(data, keywords, jobData, candidateData) {
      const name = data.contact.name;
      const jobTitle = jobData?.title || 'the open position';
      const company = jobData?.company || 'your company';
      const highPriority = keywords.highPriority || (keywords.all || []).slice(0, 5);

      const lines = [
        name.toUpperCase(),
        [data.contact.location, data.contact.email, data.contact.phone].filter(Boolean).join(' | '),
        '',
        new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
        '',
        'Hiring Team',
        company,
        jobData?.location || '',
        '',
        'Dear Hiring Manager,',
        '',
        `I am excited to apply for the ${jobTitle} position at ${company}. With experience in ${highPriority.slice(0, 2).join(' and ')}, I deliver measurable business impact through innovative solutions.`,
        '',
        `In my previous roles, I have successfully implemented ${highPriority[2] || 'technical'} solutions and led ${highPriority[3] || 'cross-functional'} initiatives resulting in significant improvements.`,
        '',
        `I would welcome the opportunity to discuss how my ${highPriority[4] || 'expertise'} can contribute to ${company}'s success. Thank you for your consideration.`,
        '',
        'Sincerely,',
        name
      ];

      return lines.join('\n');
    },

    // ============ CALCULATE MATCH SCORE ============
    calculateMatchScore(tailoredData, keywords) {
      const allKeywords = keywords.all || keywords;
      if (!allKeywords || allKeywords.length === 0) return 0;

      // Build text from all sections
      const text = [
        tailoredData.summary,
        tailoredData.skills?.join(' '),
        tailoredData.experience?.map(e => e.bullets?.join(' ')).join(' '),
        tailoredData.certifications?.join(' ')
      ].filter(Boolean).join(' ').toLowerCase();

      // Count matches
      let matches = 0;
      allKeywords.forEach(kw => {
        if (text.includes(kw.toLowerCase())) matches++;
      });

      const score = Math.round((matches / allKeywords.length) * 100);
      console.log(`[OpenResume] Match Score: ${score}% (${matches}/${allKeywords.length})`);
      return score;
    }
  };

  // ============ EXPORT ============
  global.OpenResumeGenerator = OpenResumeGenerator;

})(typeof window !== 'undefined' ? window : this);
