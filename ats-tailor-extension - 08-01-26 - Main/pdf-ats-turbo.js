// pdf-ats-turbo.js - 100% ATS-Parseable PDF Generator v1.2 (Professional Template)
// PERFECT FORMAT: Arial 10.5pt, 0.75" margins, 1.15 line height, UTF-8 text-only
// FIXED: Skills section formatting, no ALL CAPS skills, proper text wrapping, compact education

(function() {
  'use strict';

  const PDFATSTurbo = {
    // ============ PDF CONFIGURATION (ATS-PERFECT - RECRUITER APPROVED) ============
    CONFIG: {
      // Font: Arial 10.5pt (ATS Universal - recruiter scannable)
      font: 'helvetica', // jsPDF uses helvetica as Arial equivalent
      fontSize: {
        name: 14,
        sectionTitle: 11,
        body: 10.5,  // CRITICAL: 10.5pt as specified
        small: 9
      },
      // Margins: 0.75 inches all sides (54pt) - ATS standard
      margins: {
        top: 54,
        bottom: 54,
        left: 54,
        right: 54
      },
      // Line spacing: 1.15 - ATS optimal
      lineHeight: 1.15,
      // A4 dimensions in points
      pageWidth: 595.28,
      pageHeight: 841.89,
      // Encoding: UTF-8 text-only
      encoding: 'UTF-8'
    },

    // ============ CORE TECHNICAL SKILLS (MAX 20, NO JOB KEYWORDS) ============
    CORE_SKILLS_LIMIT: 20,

    // ============ SOFT SKILLS TO EXCLUDE FROM DISPLAY ============
    EXCLUDED_SOFT_SKILLS: new Set([
      'good learning', 'communication skills', 'love for technology', 
      'able to withstand work pressure', 'system integration', 'collaboration',
      'problem-solving', 'teamwork', 'leadership', 'initiative', 'ownership',
      'passion', 'dedication', 'motivation', 'self-starter', 'communication',
      'interpersonal', 'proactive', 'detail-oriented', 'hard-working', 'team player'
    ]),

    // ============ GENERATE ATS-PERFECT CV PDF (Professional Template) ============
    async generateATSPerfectCV(candidateData, tailoredCV, jobData, workExperienceKeywords = []) {
      const startTime = performance.now();
      console.log('[PDFATSTurbo] Generating ATS-perfect CV (Professional Template)...');

      // Parse and format CV content
      const formattedContent = this.formatCVForATS(tailoredCV, candidateData, workExperienceKeywords);
      
      // Build PDF text (UTF-8 text-only binary)
      const pdfText = this.buildPDFText(formattedContent);
      
      // Generate filename: {FirstName}_{LastName}_CV.pdf (EXACT FORMAT)
      const firstName = (candidateData?.firstName || candidateData?.first_name || 'Applicant').replace(/\s+/g, '_').replace(/[^a-zA-Z_]/g, '');
      const lastName = (candidateData?.lastName || candidateData?.last_name || '').replace(/\s+/g, '_').replace(/[^a-zA-Z_]/g, '');
      const fileName = lastName ? `${firstName}_${lastName}_CV.pdf` : `${firstName}_CV.pdf`;

      let pdfBase64 = null;
      let pdfBlob = null;

      if (typeof jspdf !== 'undefined' && jspdf.jsPDF) {
        const pdfResult = await this.generateWithJsPDF(formattedContent, candidateData);
        pdfBase64 = pdfResult.base64;
        pdfBlob = pdfResult.blob;
      } else {
        // Fallback: text-based PDF
        pdfBase64 = btoa(unescape(encodeURIComponent(pdfText)));
      }

      const timing = performance.now() - startTime;
      console.log(`[PDFATSTurbo] CV PDF generated in ${timing.toFixed(0)}ms`);

      return {
        pdf: pdfBase64,
        blob: pdfBlob,
        fileName,
        text: pdfText,
        formattedContent,
        timing,
        size: pdfBase64 ? Math.round(pdfBase64.length * 0.75 / 1024) : 0
      };
    },

    // ============ FORMAT CV FOR ATS ============
    formatCVForATS(cvText, candidateData, workExperienceKeywords = []) {
      const sections = {};
      
      // CONTACT INFORMATION
      sections.contact = this.buildContactSection(candidateData);
      
      // Parse existing CV sections
      const parsed = this.parseCVSections(cvText);
      
      // PROFESSIONAL SUMMARY
      sections.summary = parsed.summary || '';
      
      // EXPERIENCE - Already has keywords injected from tailorCV
      sections.experience = parsed.experience || '';
      
      // SKILLS - FIXED: Proper formatting, no ALL CAPS, comma-separated
      sections.skills = this.formatCleanSkillsSection(parsed.skills);
      
      // EDUCATION - FIXED: Compact single-line format
      sections.education = this.formatEducationSection(parsed.education);
      
      // CERTIFICATIONS - FIXED: Comma-separated, no bullet spam
      sections.certifications = this.formatCertificationsSection(parsed.certifications);
      
      // REMOVED: Technical Proficiencies section (was showing soft skills spam)
      // If meaningful proficiencies exist, merge them into skills
      if (parsed.technicalProficiencies) {
        const meaningfulProfs = this.extractMeaningfulProficiencies(parsed.technicalProficiencies);
        if (meaningfulProfs && sections.skills) {
          sections.skills = sections.skills + ', ' + meaningfulProfs;
        }
      }

      console.log('[PDFATSTurbo] formatCVForATS - sections formatted');

      return sections;
    },

    // ============ BUILD CONTACT SECTION ============
    // HARD RULE: NEVER include "Remote" in CV location header (recruiter red flag)
    buildContactSection(candidateData) {
      const firstName = candidateData?.firstName || candidateData?.first_name || '';
      const lastName = candidateData?.lastName || candidateData?.last_name || '';
      const name = `${firstName} ${lastName}`.trim();
      const phone = candidateData?.phone || '';
      const email = candidateData?.email || '';
      const linkedin = candidateData?.linkedin || '';
      const github = candidateData?.github || '';
      
      // Get raw location
      let location = candidateData?.city || candidateData?.location || '';
      
      // First, use location tailor if available
      if (typeof window !== 'undefined' && window.ATSLocationTailor) {
        location = window.ATSLocationTailor.normalizeLocationForCV(location);
      }
      
      // CRITICAL HARD RULE: ALWAYS strip Remote from location (recruiter red flag)
      // This applies even if it exists in the stored profile or uploaded base CV
      location = this.stripRemoteFromLocation(location);
      
      // If location becomes empty after stripping, use default Dublin, IE
      if (!location || location.length < 3) {
        location = 'Dublin, IE';
      }

      // Build contact parts - only include non-empty values
      const contactParts = [phone, email, location].filter(Boolean);
      const linkParts = [linkedin, github].filter(Boolean);

      return {
        name,
        contactLine: contactParts.join(' | '),
        linksLine: linkParts.join(' | ')
      };
    },

    // ============ STRIP REMOTE FROM LOCATION (HARD RULE) ============
    // User rule: "Remote" should NEVER appear in CV location. "Dublin, IE | Remote" -> "Dublin, IE"
    // This is a recruiter red flag and must be stripped from all CVs.
    stripRemoteFromLocation(raw) {
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

      return out;
    },

    // ============ PARSE CV SECTIONS ============
    parseCVSections(cvText) {
      if (!cvText) return {};
      
      const sections = {
        summary: '',
        experience: '',
        skills: '',
        education: '',
        certifications: '',
        technicalProficiencies: ''
      };

      const lines = cvText.split('\n');
      let currentSection = '';
      let currentContent = [];
      
      const sectionHeaders = {
        'PROFESSIONAL SUMMARY': 'summary',
        'SUMMARY': 'summary',
        'PROFILE': 'summary',
        'OBJECTIVE': 'summary',
        'EXPERIENCE': 'experience',
        'WORK EXPERIENCE': 'experience',
        'EMPLOYMENT': 'experience',
        'PROFESSIONAL EXPERIENCE': 'experience',
        'SKILLS': 'skills',
        'TECHNICAL SKILLS': 'skills',
        'CORE SKILLS': 'skills',
        'EDUCATION': 'education',
        'ACADEMIC': 'education',
        'CERTIFICATIONS': 'certifications',
        'LICENSES': 'certifications',
        'TECHNICAL PROFICIENCIES': 'technicalProficiencies'
      };
      
      for (const line of lines) {
        const trimmed = line.trim().toUpperCase().replace(/[:\s]+$/, '');
        
        if (sectionHeaders[trimmed]) {
          if (currentSection && currentContent.length > 0) {
            sections[currentSection] = currentContent.join('\n').trim();
          }
          currentSection = sectionHeaders[trimmed];
          currentContent = [];
        } else if (currentSection) {
          currentContent.push(line);
        }
      }
      
      if (currentSection && currentContent.length > 0) {
        sections[currentSection] = currentContent.join('\n').trim();
      }

      return sections;
    },

    // ============ FORMAT CLEAN SKILLS SECTION ============
    // FIXED: No ALL CAPS, proper Title Case for categories, comma-separated, max 20 skills
    formatCleanSkillsSection(skillsText) {
      if (!skillsText) return '';
      
      // Parse comma-separated, bullet points, or line-separated skills
      const skillWords = skillsText
        .replace(/[•\-*]/g, ',')
        .split(/[,\n]/)
        .map(s => s.trim())
        .filter(s => {
          if (s.length < 2 || s.length > 40) return false;
          // Filter out soft skills
          if (this.EXCLUDED_SOFT_SKILLS.has(s.toLowerCase())) return false;
          return true;
        });
      
      // Deduplicate
      const uniqueSkills = [];
      const seen = new Set();
      skillWords.forEach(s => {
        const lower = s.toLowerCase();
        if (!seen.has(lower)) {
          seen.add(lower);
          // Format skill properly - keep technical acronyms uppercase
          const formatted = this.formatSkillName(s);
          uniqueSkills.push(formatted);
        }
      });
      
      // Limit to MAX 20 core technical skills
      const coreSkills = uniqueSkills.slice(0, this.CORE_SKILLS_LIMIT);
      
      // Return comma-separated
      return coreSkills.join(', ');
    },

    // ============ FORMAT SKILL NAME (Not ALL CAPS) ============
    formatSkillName(skill) {
      // Known technical acronyms to keep uppercase
      const acronyms = new Set([
        'SQL', 'AWS', 'GCP', 'API', 'REST', 'HTML', 'CSS', 'JSON', 'XML', 'SDK',
        'CI', 'CD', 'ETL', 'ML', 'AI', 'NLP', 'LLM', 'GPU', 'CPU', 'UI', 'UX',
        'HTTP', 'HTTPS', 'SSH', 'FTP', 'TCP', 'IP', 'DNS', 'VPN', 'CDN', 'S3',
        'EC2', 'RDS', 'IAM', 'VPC', 'ECS', 'EKS', 'SQS', 'SNS', 'SES', 'DMS',
        'JWT', 'OAuth', 'SAML', 'SSO', 'RBAC', 'CRUD', 'ORM', 'MVC', 'MVP',
        'TDD', 'BDD', 'DDD', 'SOLID', 'OOP', 'FP', 'MVVM', 'NoSQL', 'SQL',
        'iOS', 'macOS', 'JIRA', 'CI/CD', 'DevOps', 'MLOps', 'DataOps', 'GitOps'
      ]);
      
      // Check if entire skill is an acronym
      if (acronyms.has(skill.toUpperCase())) {
        return skill.toUpperCase();
      }
      
      // Handle compound skills like "Power BI", "Looker Studio"
      return skill.split(/\s+/).map(word => {
        const upper = word.toUpperCase();
        if (acronyms.has(upper)) {
          return upper;
        }
        // Title case for regular words
        if (word.length <= 2) return word.toUpperCase(); // BI, AI, etc.
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }).join(' ');
    },

    // ============ FORMAT EDUCATION SECTION ============
    // FIXED: Compact single-line format per degree - no multi-line spam
    formatEducationSection(educationText) {
      if (!educationText) return '';
      
      const lines = educationText.split('\n').filter(l => l.trim());
      
      // Try to extract structured education entries
      const entries = [];
      let currentEntry = [];
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        
        // Check if this starts a new entry (institution name usually)
        const isNewEntry = /^[A-Z][a-zA-Z\s]+(?:University|College|Institute|School|Academy)/i.test(trimmed) ||
                          /^[A-Z][A-Za-z\s]+(?:\||–|-)/.test(trimmed);
        
        if (isNewEntry && currentEntry.length > 0) {
          entries.push(this.formatEducationEntry(currentEntry));
          currentEntry = [trimmed];
        } else {
          currentEntry.push(trimmed);
        }
      }
      
      // Don't forget the last entry
      if (currentEntry.length > 0) {
        entries.push(this.formatEducationEntry(currentEntry));
      }
      
      return entries.filter(e => e).join('\n');
    },

    formatEducationEntry(lines) {
      if (!lines || lines.length === 0) return '';
      
      // Try to extract: Institution, Degree, Date, GPA
      let institution = '';
      let degree = '';
      let date = '';
      let gpa = '';
      
      const combinedText = lines.join(' ');
      
      // Extract GPA
      const gpaMatch = combinedText.match(/(?:GPA|Grade)[:\s]*(\d+\.?\d*)/i);
      if (gpaMatch) gpa = `GPA: ${gpaMatch[1]}`;
      
      // Extract date range
      const dateMatch = combinedText.match(/(\d{4})\s*[-–]\s*(\d{4}|Present|Current)/i);
      if (dateMatch) date = `${dateMatch[1]} - ${dateMatch[2]}`;
      
      // Extract degree
      const degreeMatch = combinedText.match(/(Bachelor|Master|PhD|Doctor|Associate|Diploma|Certificate|B\.?S\.?|M\.?S\.?|B\.?A\.?|M\.?A\.?|M\.?B\.?A\.?)[^,|]*/i);
      if (degreeMatch) degree = degreeMatch[0].trim();
      
      // First line is usually the institution
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        
        if (/University|College|Institute|School|Academy/i.test(trimmed)) {
          institution = trimmed.split('|')[0].split('–')[0].trim();
          break;
        } else if (!institution && trimmed.length > 5) {
          institution = trimmed.split('|')[0].split('–')[0].trim();
        }
      }
      
      // Format as single line: Institution | Degree | Date | GPA
      const parts = [institution, degree, date, gpa].filter(Boolean);
      return parts.length > 0 ? parts.join(' | ') : lines.join(' ');
    },

    // ============ FORMAT CERTIFICATIONS SECTION ============
    // FIXED: Comma-separated, no bullet spam
    formatCertificationsSection(certsText) {
      if (!certsText) return '';
      
      const certs = certsText
        .replace(/[•\-*]/g, ',')
        .split(/[,\n]/)
        .map(s => s.trim())
        .filter(s => s.length > 5 && s.length < 100);
      
      // Return comma-separated
      return certs.join(', ');
    },

    // ============ EXTRACT MEANINGFUL PROFICIENCIES ============
    // Filter out soft skills spam, keep only technical proficiencies
    extractMeaningfulProficiencies(profsText) {
      if (!profsText) return '';
      
      const items = profsText
        .replace(/[•\-*]/g, ',')
        .split(/[,\n]/)
        .map(s => s.trim())
        .filter(s => {
          if (s.length < 3 || s.length > 50) return false;
          // Filter out soft skills
          const lower = s.toLowerCase();
          if (this.EXCLUDED_SOFT_SKILLS.has(lower)) return false;
          // Keep technical terms only
          if (/communication|learning|love|passion|pressure|integrity|attitude/i.test(s)) return false;
          return true;
        });
      
      return items.length > 0 ? items.join(', ') : '';
    },

    // ============ BUILD PDF TEXT (UTF-8) ============
    buildPDFText(sections) {
      const lines = [];
      
      // CONTACT INFORMATION
      lines.push(sections.contact.name.toUpperCase());
      lines.push(sections.contact.contactLine);
      if (sections.contact.linksLine) {
        lines.push(sections.contact.linksLine);
      }
      lines.push('');
      
      // PROFESSIONAL SUMMARY
      if (sections.summary) {
        lines.push('PROFESSIONAL SUMMARY');
        lines.push(sections.summary);
        lines.push('');
      }
      
      // EXPERIENCE
      if (sections.experience) {
        lines.push('WORK EXPERIENCE');
        lines.push(sections.experience);
        lines.push('');
      }
      
      // EDUCATION
      if (sections.education) {
        lines.push('EDUCATION');
        lines.push(sections.education);
        lines.push('');
      }
      
      // SKILLS (clean, comma-separated, proper case)
      if (sections.skills) {
        lines.push('SKILLS');
        lines.push(sections.skills);
        lines.push('');
      }
      
      // CERTIFICATIONS (comma-separated)
      if (sections.certifications) {
        lines.push('CERTIFICATIONS');
        lines.push(sections.certifications);
      }
      
      // NOTE: Technical Proficiencies section REMOVED (was soft skills spam)
      
      return lines.join('\n');
    },

    // ============ GENERATE WITH jsPDF (Professional Template) ============
    async generateWithJsPDF(sections, candidateData) {
      const { jsPDF } = jspdf;
      const { font, fontSize, margins, lineHeight, pageWidth, pageHeight } = this.CONFIG;
      const contentWidth = pageWidth - margins.left - margins.right - 10; // Safety margin
      
      const doc = new jsPDF({
        format: 'a4',
        unit: 'pt',
        putOnlyUsedFonts: true
      });

      doc.setFont(font, 'normal');
      let yPos = margins.top;

      // Helper: Add text with proper word wrap and page breaks - NO CUT-OFFS
      const addText = (text, isBold = false, isCentered = false, size = fontSize.body) => {
        doc.setFontSize(size);
        doc.setFont(font, isBold ? 'bold' : 'normal');
        
        const lines = doc.splitTextToSize(text, contentWidth);
        lines.forEach(line => {
          // Check for page break BEFORE drawing - prevents cut-offs
          if (yPos > pageHeight - margins.bottom - 30) {
            doc.addPage();
            yPos = margins.top;
          }
          
          const xPos = isCentered ? (pageWidth - doc.getTextWidth(line)) / 2 : margins.left;
          doc.text(line, xPos, yPos);
          yPos += size * lineHeight + 2; // Proper line spacing
        });
      };

      // Helper: Add section header with underline
      const addSectionHeader = (title) => {
        // Check for page break - need space for header + some content
        if (yPos > pageHeight - margins.bottom - 60) {
          doc.addPage();
          yPos = margins.top;
        }
        
        yPos += 12; // Space before section
        doc.setFontSize(fontSize.sectionTitle);
        doc.setFont(font, 'bold');
        doc.text(title.toUpperCase(), margins.left, yPos);
        yPos += fontSize.sectionTitle + 2;
        
        // Underline
        doc.setDrawColor(80, 80, 80);
        doc.setLineWidth(0.5);
        doc.line(margins.left, yPos - 3, pageWidth - margins.right, yPos - 3);
        yPos += 8;
      };

      // === NAME (centered, larger) ===
      if (sections.contact.name) {
        addText(sections.contact.name.toUpperCase(), true, true, fontSize.name);
        yPos += 2;
      }

      // === Contact line (centered) ===
      if (sections.contact.contactLine) {
        addText(sections.contact.contactLine, false, true, fontSize.body);
      }
      
      // === Links line (centered) ===
      if (sections.contact.linksLine) {
        addText(sections.contact.linksLine, false, true, fontSize.small);
      }
      yPos += 10;

      // === PROFESSIONAL SUMMARY ===
      if (sections.summary) {
        addSectionHeader('PROFESSIONAL SUMMARY');
        doc.setFont(font, 'normal');
        addText(sections.summary, false, false, fontSize.body);
      }

      // === WORK EXPERIENCE ===
      if (sections.experience) {
        addSectionHeader('WORK EXPERIENCE');
        const expLines = sections.experience.split('\n');
        
        expLines.forEach(line => {
          const trimmed = line.trim();
          if (!trimmed) {
            yPos += 4; // Small gap for empty lines
            return;
          }
          
          // Bullet points - ALWAYS normal weight
          if (trimmed.startsWith('-') || trimmed.startsWith('•') || trimmed.startsWith('*')) {
            doc.setFont(font, 'normal');
            addText(trimmed, false, false, fontSize.body);
          }
          // Company/Role line - BOLD
          else if (trimmed.includes('|') && !trimmed.match(/^\d{4}/)) {
            doc.setFont(font, 'bold');
            addText(trimmed, true, false, fontSize.body);
          }
          // Date/Location lines - NORMAL, slightly smaller
          else if (trimmed.match(/\d{4}/) || trimmed.match(/^[A-Z][a-z]+,?\s+/)) {
            doc.setFont(font, 'normal');
            addText(trimmed, false, false, fontSize.small);
          }
          // Regular text
          else {
            doc.setFont(font, 'normal');
            addText(trimmed, false, false, fontSize.body);
          }
        });
      }

      // === EDUCATION (Compact format) ===
      if (sections.education) {
        addSectionHeader('EDUCATION');
        const eduLines = sections.education.split('\n');
        
        eduLines.forEach(line => {
          const trimmed = line.trim();
          if (!trimmed) return;
          
          // Each education entry on one line
          doc.setFont(font, 'normal');
          addText(trimmed, false, false, fontSize.body);
        });
      }

      // === SKILLS (Comma-separated, proper case) ===
      if (sections.skills) {
        addSectionHeader('SKILLS');
        doc.setFont(font, 'normal');
        // Skills as a flowing paragraph, wrapped properly
        addText(sections.skills, false, false, fontSize.body);
      }

      // === CERTIFICATIONS (Comma-separated) ===
      if (sections.certifications) {
        addSectionHeader('CERTIFICATIONS');
        doc.setFont(font, 'normal');
        addText(sections.certifications, false, false, fontSize.body);
      }

      // Generate output
      const pdfBlob = doc.output('blob');
      const pdfBase64 = doc.output('datauristring').split(',')[1];

      return { base64: pdfBase64, blob: pdfBlob };
    },

    // ============ GENERATE COVER LETTER PDF ============
    async generateCoverLetterPDF(coverLetterText, candidateData, jobData) {
      const startTime = performance.now();
      
      const firstName = (candidateData?.firstName || candidateData?.first_name || 'Applicant').replace(/\s+/g, '_').replace(/[^a-zA-Z_]/g, '');
      const lastName = (candidateData?.lastName || candidateData?.last_name || '').replace(/\s+/g, '_').replace(/[^a-zA-Z_]/g, '');
      const fileName = lastName ? `${firstName}_${lastName}_Cover_Letter.pdf` : `${firstName}_Cover_Letter.pdf`;

      let pdfBase64 = null;
      let pdfBlob = null;

      if (typeof jspdf !== 'undefined' && jspdf.jsPDF) {
        const { jsPDF } = jspdf;
        const { font, fontSize, margins, lineHeight, pageWidth, pageHeight } = this.CONFIG;
        const contentWidth = pageWidth - margins.left - margins.right - 10;
        
        const doc = new jsPDF({ format: 'a4', unit: 'pt' });
        doc.setFont(font, 'normal');
        doc.setFontSize(fontSize.body);
        
        let yPos = margins.top;
        
        // Helper with page break handling
        const addCoverText = (text, isBold = false) => {
          doc.setFont(font, isBold ? 'bold' : 'normal');
          const lines = doc.splitTextToSize(text, contentWidth);
          lines.forEach(line => {
            if (yPos > pageHeight - margins.bottom - 20) {
              doc.addPage();
              yPos = margins.top;
            }
            doc.text(line, margins.left, yPos);
            yPos += fontSize.body * lineHeight + 2;
          });
        };
        
        // Split cover letter into paragraphs
        const paragraphs = coverLetterText.split('\n\n');
        paragraphs.forEach((para, idx) => {
          const trimmed = para.trim();
          if (!trimmed) return;
          
          addCoverText(trimmed);
          yPos += 8; // Paragraph spacing
        });
        
        pdfBlob = doc.output('blob');
        pdfBase64 = doc.output('datauristring').split(',')[1];
      } else {
        pdfBase64 = btoa(unescape(encodeURIComponent(coverLetterText)));
      }

      const timing = performance.now() - startTime;
      console.log(`[PDFATSTurbo] Cover Letter PDF generated in ${timing.toFixed(0)}ms`);

      return { pdf: pdfBase64, blob: pdfBlob, fileName, timing };
    }
  };

  // Export globally
  if (typeof window !== 'undefined') {
    window.PDFATSTurbo = PDFATSTurbo;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PDFATSTurbo;
  }
})();
