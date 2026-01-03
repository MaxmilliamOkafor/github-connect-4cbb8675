// resume-builder.js - Resume Builder with Text Preview & Download
// Inspired by Resume-Matcher (srbhr/Resume-Matcher) approach
// Generates ATS-optimized CV with ALL extracted keywords

(function(global) {
  'use strict';

  const ResumeBuilder = {
    // ============ RESUME TEMPLATES ============
    TEMPLATES: {
      professional: {
        name: 'Professional',
        fontFamily: 'Arial, sans-serif',
        fontSize: '10.5pt',
        lineHeight: 1.15,
        margins: { top: 54, bottom: 54, left: 54, right: 54 }
      },
      modern: {
        name: 'Modern',
        fontFamily: 'Calibri, sans-serif',
        fontSize: '11pt',
        lineHeight: 1.2,
        margins: { top: 48, bottom: 48, left: 48, right: 48 }
      },
      minimal: {
        name: 'Minimal',
        fontFamily: 'Helvetica, sans-serif',
        fontSize: '10pt',
        lineHeight: 1.1,
        margins: { top: 36, bottom: 36, left: 36, right: 36 }
      }
    },

    // ============ BUILD RESUME WITH ALL KEYWORDS ============
    buildResumeWithKeywords(candidateData, keywords, options = {}) {
      const startTime = performance.now();
      const { template = 'professional', includeAllKeywords = true } = options;
      
      if (!candidateData) {
        console.warn('[ResumeBuilder] No candidate data provided');
        return null;
      }

      // Extract all keywords from the keywords object
      const allKeywords = this.extractAllKeywords(keywords);
      console.log(`[ResumeBuilder] Building resume with ${allKeywords.length} keywords`);

      // Build resume sections
      const resume = {
        contact: this.buildContactSection(candidateData),
        summary: this.buildSummarySection(candidateData, allKeywords),
        experience: this.buildExperienceSection(candidateData, allKeywords),
        skills: this.buildSkillsSection(candidateData, allKeywords),
        education: this.buildEducationSection(candidateData),
        certifications: this.buildCertificationsSection(candidateData),
        technicalProficiencies: includeAllKeywords ? this.buildTechnicalProficienciesSection(allKeywords) : ''
      };

      // Generate text version
      const textVersion = this.generateTextVersion(resume);
      
      // Generate HTML preview
      const htmlPreview = this.generateHTMLPreview(resume, template);

      const timing = performance.now() - startTime;
      console.log(`[ResumeBuilder] Resume built in ${timing.toFixed(0)}ms`);

      return {
        resume,
        textVersion,
        htmlPreview,
        keywords: allKeywords,
        keywordCount: allKeywords.length,
        timing
      };
    },

    // ============ EXTRACT ALL KEYWORDS ============
    extractAllKeywords(keywords) {
      if (!keywords) return [];
      
      const allKw = new Set();
      
      // Add from all priority levels
      if (keywords.highPriority) keywords.highPriority.forEach(k => allKw.add(k));
      if (keywords.mediumPriority) keywords.mediumPriority.forEach(k => allKw.add(k));
      if (keywords.lowPriority) keywords.lowPriority.forEach(k => allKw.add(k));
      if (keywords.all) keywords.all.forEach(k => allKw.add(k));
      if (keywords.workExperience) keywords.workExperience.forEach(k => allKw.add(k));
      
      return [...allKw];
    },

    // ============ BUILD CONTACT SECTION ============
    buildContactSection(data) {
      const name = `${data.firstName || data.first_name || ''} ${data.lastName || data.last_name || ''}`.trim();
      const phone = data.phone || '';
      const email = data.email || '';
      const location = data.city || data.location || '';
      const linkedin = data.linkedin || '';
      const github = data.github || '';
      const portfolio = data.portfolio || '';

      return {
        name: name || 'Applicant',
        contactLine: [phone, email, location].filter(Boolean).join(' | '),
        linksLine: [linkedin, github, portfolio].filter(Boolean).join(' | ')
      };
    },

    // ============ BUILD SUMMARY SECTION ============
    buildSummarySection(data, keywords) {
      let summary = data.summary || data.professionalSummary || data.profile || '';
      
      // Inject top 5 keywords into summary if not present
      if (summary && keywords.length > 0) {
        const summaryLower = summary.toLowerCase();
        const toInject = keywords.slice(0, 5).filter(kw => !summaryLower.includes(kw.toLowerCase()));
        
        if (toInject.length > 0) {
          const injection = `. Expertise includes ${toInject.join(', ')}`;
          if (summary.endsWith('.')) {
            summary = summary.slice(0, -1) + injection + '.';
          } else {
            summary += injection + '.';
          }
        }
      }
      
      return summary;
    },

    // ============ BUILD EXPERIENCE SECTION ============
    buildExperienceSection(data, keywords) {
      const experience = data.workExperience || data.work_experience || [];
      if (!Array.isArray(experience) || experience.length === 0) return '';

      const keywordSet = new Set(keywords.map(k => k.toLowerCase()));
      let keywordIndex = 0;
      const maxBulletsPerRole = 8;

      return experience.map(job => {
        const company = job.company || job.organization || '';
        const title = job.title || job.position || job.role || '';
        const dates = job.dates || job.duration || `${job.startDate || ''} - ${job.endDate || 'Present'}`;
        const location = job.location || '';
        
        let bullets = job.bullets || job.achievements || job.responsibilities || [];
        if (typeof bullets === 'string') bullets = bullets.split('\n').filter(b => b.trim());
        
        // Inject keywords into bullets (3-5 per role)
        const enhancedBullets = bullets.slice(0, maxBulletsPerRole).map((bullet, idx) => {
          if (idx >= 3) return bullet; // Only enhance first 3 bullets
          
          const bulletLower = bullet.toLowerCase();
          const toInject = [];
          
          // Find 1-2 keywords not in bullet
          while (toInject.length < 2 && keywordIndex < keywords.length) {
            const kw = keywords[keywordIndex];
            if (!bulletLower.includes(kw.toLowerCase()) && !keywordSet.has(kw.toLowerCase())) {
              toInject.push(kw);
              keywordSet.add(kw.toLowerCase());
            }
            keywordIndex++;
          }
          
          if (toInject.length > 0) {
            const phrases = ['leveraging', 'utilizing', 'with', 'implementing', 'applying'];
            const phrase = phrases[Math.floor(Math.random() * phrases.length)];
            
            if (bullet.endsWith('.')) {
              return bullet.slice(0, -1) + `, ${phrase} ${toInject.join(' and ')}.`;
            }
            return bullet + ` ${phrase} ${toInject.join(' and ')}`;
          }
          
          return bullet;
        });

        const header = [company, title, dates, location].filter(Boolean).join(' | ');
        const bulletText = enhancedBullets.map(b => `▪ ${b.replace(/^[-•*▪]\s*/, '')}`).join('\n');
        
        return `${header}\n\n${bulletText}`;
      }).join('\n\n');
    },

    // ============ BUILD SKILLS SECTION ============
    buildSkillsSection(data, keywords) {
      const skills = data.skills || [];
      const skillSet = new Set(skills.map(s => s.toLowerCase()));
      
      // Add keywords not already in skills
      keywords.forEach(kw => {
        if (!skillSet.has(kw.toLowerCase())) {
          skills.push(kw);
          skillSet.add(kw.toLowerCase());
        }
      });
      
      // Format skills: comma-separated, max 25
      return skills.slice(0, 25).join(', ');
    },

    // ============ BUILD EDUCATION SECTION ============
    buildEducationSection(data) {
      const education = data.education || [];
      if (!Array.isArray(education) || education.length === 0) return '';
      
      return education.map(edu => {
        const institution = edu.institution || edu.school || edu.university || '';
        const degree = edu.degree || '';
        const dates = edu.dates || edu.graduationDate || '';
        const gpa = edu.gpa ? `GPA: ${edu.gpa}` : '';
        
        return [institution, degree, dates, gpa].filter(Boolean).join(' | ');
      }).join('\n');
    },

    // ============ BUILD CERTIFICATIONS SECTION ============
    buildCertificationsSection(data) {
      const certs = data.certifications || [];
      if (!Array.isArray(certs) || certs.length === 0) return '';
      
      return certs.map(c => typeof c === 'string' ? c : c.name || c.title || '').filter(Boolean).join(', ');
    },

    // ============ BUILD TECHNICAL PROFICIENCIES SECTION ============
    buildTechnicalProficienciesSection(keywords) {
      if (!keywords || keywords.length === 0) return '';
      
      // Filter to technical keywords only (exclude soft skills)
      const softSkills = new Set([
        'collaboration', 'communication', 'teamwork', 'leadership', 'problem-solving',
        'initiative', 'ownership', 'passion', 'dedication', 'motivation'
      ]);
      
      const technical = keywords.filter(kw => !softSkills.has(kw.toLowerCase()));
      
      if (technical.length === 0) return '';
      
      return '• ' + technical.join(' • ');
    },

    // ============ GENERATE TEXT VERSION ============
    generateTextVersion(resume) {
      const sections = [];
      
      // Name and contact
      sections.push(resume.contact.name.toUpperCase());
      sections.push(resume.contact.contactLine);
      if (resume.contact.linksLine) sections.push(resume.contact.linksLine);
      sections.push('');
      
      // Summary
      if (resume.summary) {
        sections.push('PROFESSIONAL SUMMARY');
        sections.push(resume.summary);
        sections.push('');
      }
      
      // Experience
      if (resume.experience) {
        sections.push('WORK EXPERIENCE');
        sections.push(resume.experience);
        sections.push('');
      }
      
      // Education
      if (resume.education) {
        sections.push('EDUCATION');
        sections.push(resume.education);
        sections.push('');
      }
      
      // Skills
      if (resume.skills) {
        sections.push('SKILLS');
        sections.push(resume.skills);
        sections.push('');
      }
      
      // Certifications
      if (resume.certifications) {
        sections.push('CERTIFICATIONS');
        sections.push(resume.certifications);
        sections.push('');
      }
      
      // Technical Proficiencies
      if (resume.technicalProficiencies) {
        sections.push('TECHNICAL PROFICIENCIES');
        sections.push(resume.technicalProficiencies);
      }
      
      return sections.join('\n');
    },

    // ============ GENERATE HTML PREVIEW ============
    generateHTMLPreview(resume, templateName = 'professional') {
      const template = this.TEMPLATES[templateName] || this.TEMPLATES.professional;
      
      const escapeHtml = (str) => {
        if (!str) return '';
        return str.replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                  .replace(/"/g, '&quot;')
                  .replace(/\n/g, '<br>');
      };
      
      return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(resume.contact.name)} - Resume</title>
  <style>
    body {
      font-family: ${template.fontFamily};
      font-size: ${template.fontSize};
      line-height: ${template.lineHeight};
      margin: ${template.margins.top}px ${template.margins.right}px ${template.margins.bottom}px ${template.margins.left}px;
      color: #000;
      background: #fff;
    }
    .name { font-size: 18pt; font-weight: bold; text-align: center; margin-bottom: 4px; }
    .contact { text-align: center; color: #333; margin-bottom: 16px; }
    .section-title { font-size: 12pt; font-weight: bold; border-bottom: 1px solid #000; margin: 16px 0 8px 0; padding-bottom: 4px; }
    .section-content { margin-bottom: 12px; }
    .bullet { margin-left: 16px; }
    .job-header { font-weight: bold; margin-top: 12px; }
  </style>
</head>
<body>
  <div class="name">${escapeHtml(resume.contact.name)}</div>
  <div class="contact">${escapeHtml(resume.contact.contactLine)}</div>
  ${resume.contact.linksLine ? `<div class="contact">${escapeHtml(resume.contact.linksLine)}</div>` : ''}
  
  ${resume.summary ? `
    <div class="section-title">PROFESSIONAL SUMMARY</div>
    <div class="section-content">${escapeHtml(resume.summary)}</div>
  ` : ''}
  
  ${resume.experience ? `
    <div class="section-title">WORK EXPERIENCE</div>
    <div class="section-content">${escapeHtml(resume.experience)}</div>
  ` : ''}
  
  ${resume.education ? `
    <div class="section-title">EDUCATION</div>
    <div class="section-content">${escapeHtml(resume.education)}</div>
  ` : ''}
  
  ${resume.skills ? `
    <div class="section-title">SKILLS</div>
    <div class="section-content">${escapeHtml(resume.skills)}</div>
  ` : ''}
  
  ${resume.certifications ? `
    <div class="section-title">CERTIFICATIONS</div>
    <div class="section-content">${escapeHtml(resume.certifications)}</div>
  ` : ''}
  
  ${resume.technicalProficiencies ? `
    <div class="section-title">TECHNICAL PROFICIENCIES</div>
    <div class="section-content">${escapeHtml(resume.technicalProficiencies)}</div>
  ` : ''}
</body>
</html>`;
    },

    // ============ DOWNLOAD TEXT VERSION ============
    downloadTextVersion(textContent, fileName = 'Resume.txt') {
      const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      console.log(`[ResumeBuilder] Downloaded: ${fileName}`);
    },

    // ============ SHOW TEXT PREVIEW ============
    showTextPreview(textContent, containerSelector = '#previewContent') {
      const container = document.querySelector(containerSelector);
      if (!container) {
        console.warn('[ResumeBuilder] Preview container not found:', containerSelector);
        return false;
      }
      
      // Format text with proper whitespace preservation
      container.innerHTML = `<pre style="white-space: pre-wrap; font-family: monospace; font-size: 11px; line-height: 1.4;">${textContent.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`;
      container.classList.remove('placeholder');
      return true;
    }
  };

  // Export globally
  global.ResumeBuilder = ResumeBuilder;

})(typeof window !== 'undefined' ? window : this);
