// pdf-ats-turbo.js - 100% ATS-Parseable PDF Generator (≤500ms)
// CLEAN SKILLS SECTION - No keyword injection to avoid recruiter stuffing flags

(function() {
  'use strict';

  const PDFATSTurbo = {
    // ============ PDF CONFIGURATION (ATS-PERFECT) ============
    CONFIG: {
      // Font: Arial 10pt
      font: 'helvetica', // jsPDF uses helvetica as Arial equivalent
      fontSize: {
        name: 14,
        sectionTitle: 11,
        body: 10,
        small: 9
      },
      // Margins: 0.75 inches all sides (54pt)
      margins: {
        top: 54,
        bottom: 54,
        left: 54,
        right: 54
      },
      // Line spacing: 1.15
      lineHeight: 1.15,
      // A4 dimensions in points
      pageWidth: 595.28,
      pageHeight: 841.89
    },

    // ============ CORE TECHNICAL SKILLS (MAX 20, NO JOB KEYWORDS) ============
    // These are the candidate's actual skills - NEVER modified by job keywords
    CORE_SKILLS_LIMIT: 20,

    // ============ GENERATE ATS-PERFECT CV PDF (≤500ms) ============
    async generateATSPerfectCV(candidateData, tailoredCV, jobData, workExperienceKeywords = []) {
      const startTime = performance.now();
      console.log('[PDFATSTurbo] Generating ATS-perfect CV (clean skills, WE keywords only)...');

      // Parse and format CV content
      const formattedContent = this.formatCVForATS(tailoredCV, candidateData, workExperienceKeywords);
      
      // Build PDF text (UTF-8 text-only binary)
      const pdfText = this.buildPDFText(formattedContent);
      
      // Generate filename: {FirstName}_{LastName}_CV.pdf
      const firstName = (candidateData?.firstName || candidateData?.first_name || 'Applicant').replace(/\s+/g, '_');
      const lastName = (candidateData?.lastName || candidateData?.last_name || '').replace(/\s+/g, '_');
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
      console.log(`[PDFATSTurbo] CV PDF generated in ${timing.toFixed(0)}ms (target: 500ms)`);

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
      
      // SKILLS - CLEAN: Max 20 core skills, comma-separated, NO job keywords
      sections.skills = this.formatCleanSkillsSection(parsed.skills);
      
      // EDUCATION
      sections.education = parsed.education || '';
      
      // CERTIFICATIONS
      sections.certifications = parsed.certifications || '';

      return sections;
    },

    // ============ BUILD CONTACT SECTION ============
    buildContactSection(candidateData) {
      const firstName = candidateData?.firstName || candidateData?.first_name || '';
      const lastName = candidateData?.lastName || candidateData?.last_name || '';
      const name = `${firstName} ${lastName}`.trim();
      const phone = candidateData?.phone || '';
      const email = candidateData?.email || '';
      const linkedin = candidateData?.linkedin || '';
      const github = candidateData?.github || '';
      const location = candidateData?.city || candidateData?.location || 'Open to relocation';

      return {
        name,
        contactLine: [phone, email, location].filter(Boolean).join(' | '),
        linksLine: [linkedin, github].filter(Boolean).join(' | ')
      };
    },

    // ============ PARSE CV SECTIONS ============
    parseCVSections(cvText) {
      if (!cvText) return {};
      
      const sections = {
        summary: '',
        experience: '',
        skills: '',
        education: '',
        certifications: ''
      };

      const patterns = {
        summary: /(?:PROFESSIONAL\s*SUMMARY|SUMMARY|PROFILE|OBJECTIVE)[\s:]*\n([\s\S]*?)(?=\n(?:EXPERIENCE|WORK|SKILLS|EDUCATION|CERTIFICATIONS|$))/i,
        experience: /(?:EXPERIENCE|WORK\s*EXPERIENCE|EMPLOYMENT|PROFESSIONAL\s*EXPERIENCE)[\s:]*\n([\s\S]*?)(?=\n(?:SKILLS|EDUCATION|CERTIFICATIONS|$))/i,
        skills: /(?:SKILLS|TECHNICAL\s*SKILLS|CORE\s*SKILLS)[\s:]*\n([\s\S]*?)(?=\n(?:EDUCATION|CERTIFICATIONS|$))/i,
        education: /(?:EDUCATION|ACADEMIC)[\s:]*\n([\s\S]*?)(?=\n(?:CERTIFICATIONS|$))/i,
        certifications: /(?:CERTIFICATIONS?|LICENSES?)[\s:]*\n([\s\S]*?)$/i
      };

      for (const [section, pattern] of Object.entries(patterns)) {
        const match = cvText.match(pattern);
        if (match) {
          sections[section] = match[1].trim();
        }
      }

      return sections;
    },

    // ============ FORMAT CLEAN SKILLS SECTION ============
    // CRITICAL: NO job keyword injection - only core technical skills
    formatCleanSkillsSection(skillsText) {
      if (!skillsText) return '';
      
      // Extract existing skills only
      const existingSkills = [];
      
      // Parse comma-separated, bullet points, or line-separated skills
      const skillWords = skillsText
        .replace(/[•\-*]/g, ',')
        .split(/[,\n]/)
        .map(s => s.trim())
        .filter(s => s.length >= 2 && s.length <= 50);
      
      skillWords.forEach(s => {
        if (!existingSkills.includes(s)) {
          existingSkills.push(s);
        }
      });
      
      // Limit to MAX 20 core technical skills
      const coreSkills = existingSkills.slice(0, this.CORE_SKILLS_LIMIT);
      
      // Return comma-separated, single line, Arial 10pt format
      return coreSkills.join(', ');
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
        lines.push('EXPERIENCE');
        lines.push(sections.experience);
        lines.push('');
      }
      
      // SKILLS (clean, comma-separated)
      if (sections.skills) {
        lines.push('SKILLS');
        lines.push(sections.skills);
        lines.push('');
      }
      
      // EDUCATION
      if (sections.education) {
        lines.push('EDUCATION');
        lines.push(sections.education);
        lines.push('');
      }
      
      // CERTIFICATIONS
      if (sections.certifications) {
        lines.push('CERTIFICATIONS');
        lines.push(sections.certifications);
      }
      
      return lines.join('\n');
    },

    // ============ GENERATE WITH jsPDF (≤500ms) ============
    async generateWithJsPDF(sections, candidateData) {
      const { jsPDF } = jspdf;
      const { font, fontSize, margins, lineHeight, pageWidth, pageHeight } = this.CONFIG;
      const contentWidth = pageWidth - margins.left - margins.right;
      
      const doc = new jsPDF({
        format: 'a4',
        unit: 'pt',
        putOnlyUsedFonts: true
      });

      doc.setFont(font, 'normal');
      let yPos = margins.top;

      // Helper: Add text with word wrap
      const addText = (text, isBold = false, isCentered = false, size = fontSize.body) => {
        doc.setFontSize(size);
        doc.setFont(font, isBold ? 'bold' : 'normal');
        
        const lines = doc.splitTextToSize(text, contentWidth);
        lines.forEach(line => {
          if (yPos > pageHeight - margins.bottom - 20) {
            doc.addPage();
            yPos = margins.top;
          }
          
          const xPos = isCentered ? (pageWidth - doc.getTextWidth(line)) / 2 : margins.left;
          doc.text(line, xPos, yPos);
          yPos += size * lineHeight;
        });
      };

      // Helper: Add section header (ALL CAPS, BOLD)
      const addSectionHeader = (title) => {
        yPos += 8;
        doc.setFontSize(fontSize.sectionTitle);
        doc.setFont(font, 'bold');
        doc.text(title.toUpperCase(), margins.left, yPos);
        yPos += fontSize.sectionTitle + 2;
        
        // Underline
        doc.setDrawColor(0);
        doc.setLineWidth(0.5);
        doc.line(margins.left, yPos - 3, pageWidth - margins.right, yPos - 3);
        yPos += 6;
      };

      // NAME (centered, larger)
      addText(sections.contact.name.toUpperCase(), true, true, fontSize.name);
      yPos += 4;

      // Contact line (centered)
      addText(sections.contact.contactLine, false, true, fontSize.body);
      
      // Links line (centered)
      if (sections.contact.linksLine) {
        addText(sections.contact.linksLine, false, true, fontSize.small);
      }
      yPos += 10;

      // PROFESSIONAL SUMMARY
      if (sections.summary) {
        addSectionHeader('PROFESSIONAL SUMMARY');
        addText(sections.summary, false, false, fontSize.body);
      }

      // EXPERIENCE
      if (sections.experience) {
        addSectionHeader('EXPERIENCE');
        const expLines = sections.experience.split('\n');
        expLines.forEach(line => {
          const trimmed = line.trim();
          if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
            addText(trimmed, false, false, fontSize.body);
          } else if (trimmed.includes('|') || /^\d{4}/.test(trimmed) || /[A-Z]{2,}/.test(trimmed.substring(0, 30))) {
            addText(trimmed, true, false, fontSize.body);
          } else if (trimmed) {
            addText(trimmed, false, false, fontSize.body);
          }
        });
      }

      // SKILLS (comma-separated, single line, NO keyword injection)
      if (sections.skills) {
        addSectionHeader('SKILLS');
        addText(sections.skills, false, false, fontSize.body);
      }

      // EDUCATION
      if (sections.education) {
        addSectionHeader('EDUCATION');
        addText(sections.education, false, false, fontSize.body);
      }

      // CERTIFICATIONS
      if (sections.certifications) {
        addSectionHeader('CERTIFICATIONS');
        addText(sections.certifications, false, false, fontSize.body);
      }

      const base64 = doc.output('datauristring').split(',')[1];
      const blob = doc.output('blob');

      return { base64, blob };
    },

    // ============ GENERATE COVER LETTER PDF ============
    async generateCoverLetterPDF(candidateData, coverLetterText, jobData) {
      const startTime = performance.now();
      
      // CRITICAL: Replace all greetings with "Dear Hiring Manager,"
      let formattedCoverLetter = coverLetterText || '';
      formattedCoverLetter = formattedCoverLetter.replace(/Dear\s+Hiring\s+Committee,?/gi, 'Dear Hiring Manager,');
      formattedCoverLetter = formattedCoverLetter.replace(/Dear\s+Sir\/Madam,?/gi, 'Dear Hiring Manager,');
      formattedCoverLetter = formattedCoverLetter.replace(/To\s+Whom\s+It\s+May\s+Concern,?/gi, 'Dear Hiring Manager,');
      formattedCoverLetter = formattedCoverLetter.replace(/Dear\s+Recruiter,?/gi, 'Dear Hiring Manager,');
      
      // Generate filename: {FirstName}_{LastName}_Cover_Letter.pdf
      const firstName = (candidateData?.firstName || candidateData?.first_name || 'Applicant').replace(/\s+/g, '_');
      const lastName = (candidateData?.lastName || candidateData?.last_name || '').replace(/\s+/g, '_');
      const fileName = lastName ? `${firstName}_${lastName}_Cover_Letter.pdf` : `${firstName}_Cover_Letter.pdf`;

      let pdfBase64 = null;
      let pdfBlob = null;

      if (typeof jspdf !== 'undefined' && jspdf.jsPDF) {
        const { jsPDF } = jspdf;
        const { font, fontSize, margins, lineHeight, pageWidth, pageHeight } = this.CONFIG;
        const contentWidth = pageWidth - margins.left - margins.right;
        
        const doc = new jsPDF({ format: 'a4', unit: 'pt' });
        doc.setFont(font, 'normal');
        doc.setFontSize(fontSize.body);
        
        let yPos = margins.top;
        
        // Add date
        const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        doc.text(today, margins.left, yPos);
        yPos += 30;
        
        // Add cover letter content with word wrap
        const paragraphs = formattedCoverLetter.split('\n\n');
        paragraphs.forEach(para => {
          const lines = doc.splitTextToSize(para.trim(), contentWidth);
          lines.forEach(line => {
            if (yPos > pageHeight - margins.bottom - 20) {
              doc.addPage();
              yPos = margins.top;
            }
            doc.text(line, margins.left, yPos);
            yPos += fontSize.body * lineHeight;
          });
          yPos += 10;
        });

        pdfBase64 = doc.output('datauristring').split(',')[1];
        pdfBlob = doc.output('blob');
      } else {
        pdfBase64 = btoa(unescape(encodeURIComponent(formattedCoverLetter)));
      }

      const timing = performance.now() - startTime;
      console.log(`[PDFATSTurbo] Cover Letter PDF generated in ${timing.toFixed(0)}ms`);

      return {
        pdf: pdfBase64,
        blob: pdfBlob,
        fileName,
        text: formattedCoverLetter,
        timing,
        size: pdfBase64 ? Math.round(pdfBase64.length * 0.75 / 1024) : 0
      };
    }
  };

  // Export to global scope
  window.PDFATSTurbo = PDFATSTurbo;
})();
