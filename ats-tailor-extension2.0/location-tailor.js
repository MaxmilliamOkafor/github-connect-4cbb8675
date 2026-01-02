/**
 * Location Tailor Module
 * Extracts and normalizes job location for dynamic CV tailoring
 * Handles REMOTE (anywhere in US) -> "United States" conversion
 */

(function() {
  'use strict';

  const LocationTailor = {
    // Location extraction selectors in priority order
    LOCATION_SELECTORS: [
      '.job-location',
      '[data-location]',
      '.location',
      '[class*="location"]',
      '[class*="Location"]',
      '.job-meta .location',
      '.job-details .location',
      '[data-automation="job-location"]',
      '[data-testid="job-location"]',
      '.jd-header-location',
      '.posting-location',
      '.job-info .location',
      'span[class*="location"]',
      'div[class*="location"]',
      '.workplace-type',
      '.job-workplace'
    ],

    // Country mapping for normalization
    COUNTRY_MAP: {
      'us': 'United States',
      'usa': 'United States',
      'united states': 'United States',
      'u.s.': 'United States',
      'u.s.a.': 'United States',
      'america': 'United States',
      'uk': 'United Kingdom',
      'united kingdom': 'United Kingdom',
      'great britain': 'United Kingdom',
      'england': 'United Kingdom',
      'gb': 'United Kingdom',
      'canada': 'Canada',
      'ca': 'Canada',
      'australia': 'Australia',
      'au': 'Australia',
      'germany': 'Germany',
      'de': 'Germany',
      'france': 'France',
      'fr': 'France',
      'ireland': 'Ireland',
      'ie': 'Ireland',
      'netherlands': 'Netherlands',
      'nl': 'Netherlands'
    },

    // US State abbreviations
    US_STATES: {
      'al': 'Alabama', 'ak': 'Alaska', 'az': 'Arizona', 'ar': 'Arkansas',
      'ca': 'California', 'co': 'Colorado', 'ct': 'Connecticut', 'de': 'Delaware',
      'fl': 'Florida', 'ga': 'Georgia', 'hi': 'Hawaii', 'id': 'Idaho',
      'il': 'Illinois', 'in': 'Indiana', 'ia': 'Iowa', 'ks': 'Kansas',
      'ky': 'Kentucky', 'la': 'Louisiana', 'me': 'Maine', 'md': 'Maryland',
      'ma': 'Massachusetts', 'mi': 'Michigan', 'mn': 'Minnesota', 'ms': 'Mississippi',
      'mo': 'Missouri', 'mt': 'Montana', 'ne': 'Nebraska', 'nv': 'Nevada',
      'nh': 'New Hampshire', 'nj': 'New Jersey', 'nm': 'New Mexico', 'ny': 'New York',
      'nc': 'North Carolina', 'nd': 'North Dakota', 'oh': 'Ohio', 'ok': 'Oklahoma',
      'or': 'Oregon', 'pa': 'Pennsylvania', 'ri': 'Rhode Island', 'sc': 'South Carolina',
      'sd': 'South Dakota', 'tn': 'Tennessee', 'tx': 'Texas', 'ut': 'Utah',
      'vt': 'Vermont', 'va': 'Virginia', 'wa': 'Washington', 'wv': 'West Virginia',
      'wi': 'Wisconsin', 'wy': 'Wyoming', 'dc': 'Washington D.C.'
    },

    /**
     * Extract location from job page HTML
     * @param {Document|string} source - DOM document or HTML string
     * @returns {string} Normalized location or fallback
     */
    extractJobLocation(source) {
      let doc = source;
      
      // If string, parse as HTML
      if (typeof source === 'string') {
        const parser = new DOMParser();
        doc = parser.parseFromString(source, 'text/html');
      }

      // Try each selector in priority order
      for (const selector of this.LOCATION_SELECTORS) {
        try {
          const el = doc.querySelector(selector);
          if (el?.textContent?.trim()) {
            const normalized = this.normalizeLocation(el.textContent.trim());
            if (normalized && normalized !== 'Open to relocation') {
              console.log('[LocationTailor] Found location:', el.textContent, '->', normalized);
              return normalized;
            }
          }
        } catch (e) {
          // Selector may fail on some pages, continue
        }
      }

      // Fallback: Search page text for location patterns
      const bodyText = doc.body?.textContent || '';
      const locationFromText = this.extractLocationFromText(bodyText);
      if (locationFromText) {
        console.log('[LocationTailor] Extracted from text:', locationFromText);
        return locationFromText;
      }

      return 'Open to relocation';
    },

    /**
     * Extract location from job data object
     * @param {Object} jobData - Job data with location field
     * @returns {string} Normalized location
     */
    extractFromJobData(jobData) {
      if (!jobData) return 'Open to relocation';

      // Check common location fields
      const locationText = jobData.location || 
                          jobData.jobLocation || 
                          jobData.workplace || 
                          jobData.city ||
                          '';

      if (locationText) {
        return this.normalizeLocation(locationText);
      }

      // Check if HTML is available
      if (jobData.html) {
        return this.extractJobLocation(jobData.html);
      }

      return 'Open to relocation';
    },

    // Default location when nothing is specified or remote
    DEFAULT_LOCATION: 'Dublin, Ireland',

    /**
     * Normalize location string to ATS-friendly "City, Country" format
     * Rules:
     * 1. Standard format: "City, Country"
     * 2. If job specifies location, match it in that format
     * 3. If location is not specified or says "Remote", default to "Dublin, Ireland"
     * 4. If it mentions only "US", use "United States" as country
     * 5. No addresses, counties/states unless explicitly in posting
     * 6. Plain text only for ATS parsing
     * @param {string} text - Raw location text
     * @returns {string} Normalized location in "City, Country" format
     */
    normalizeLocation(text) {
      if (!text) return this.DEFAULT_LOCATION;
      
      const originalText = text;
      let location = text.toLowerCase().trim();
      
      // Check if location is essentially "Remote" or unspecified
      const isRemote = /^(remote|fully?\s*remote|work\s*from\s*(home|anywhere)|anywhere|worldwide|global|distributed|wfh)$/i.test(location) ||
                       /^\s*remote\s*$/i.test(location);
      
      if (isRemote) {
        console.log('[LocationTailor] Remote detected, using default:', this.DEFAULT_LOCATION);
        return this.DEFAULT_LOCATION;
      }
      
      // Remove common noise but preserve city/country info
      let cleanedLocation = originalText
        .replace(/[\(\[\{].*?[\)\]\}]/g, ' ') // Remove parentheticals
        .replace(/remote\s*[-–—]?\s*/gi, '')
        .replace(/hybrid\s*[-–—]?\s*/gi, '')
        .replace(/on-?site\s*[-–—]?\s*/gi, '')
        .replace(/anywhere\s*(in|within)?\s*/gi, '')
        .replace(/work\s*from\s*(home|anywhere)/gi, '')
        .replace(/fully?\s*remote/gi, '')
        .replace(/,?\s*remote\s*$/gi, '')
        .replace(/\bor\s+remote\b/gi, '')
        .replace(/\|/g, ',')
        .trim();
      
      // If cleaned text is empty or just noise, return default
      if (!cleanedLocation || cleanedLocation.length < 2) {
        return this.DEFAULT_LOCATION;
      }

      // Handle US-only mentions: "US", "USA", "United States" without city
      const usOnlyPattern = /^(us|usa|united\s*states|u\.s\.?a?\.?)$/i;
      if (usOnlyPattern.test(cleanedLocation.trim())) {
        console.log('[LocationTailor] US only detected, using: United States');
        return 'United States';
      }

      // Handle "REMOTE (anywhere in US)" or just "US" mentions
      if (/\b(us|usa|united\s*states|u\.s\.?a?\.?)\b/i.test(originalText)) {
        // Try to extract city before US mention
        const cityUSMatch = originalText.match(/([A-Za-z\s]+?)(?:,\s*|\s+)(?:US|USA|United\s*States|U\.S\.?A?\.?)/i);
        if (cityUSMatch && cityUSMatch[1].trim().length > 1) {
          const city = this.capitalizeWords(cityUSMatch[1].trim());
          // Filter out noise words
          if (!['remote', 'anywhere', 'in', 'the', 'hybrid', 'or'].includes(city.toLowerCase())) {
            console.log('[LocationTailor] City + US:', city);
            return `${city}, United States`;
          }
        }
        // No city found, just return United States
        return 'United States';
      }

      // Check for country codes/names and extract "City, Country" format
      for (const [code, country] of Object.entries(this.COUNTRY_MAP)) {
        const codePattern = new RegExp(`\\b${code}\\b`, 'i');
        if (codePattern.test(cleanedLocation)) {
          // Extract city before country
          const cityCountryMatch = cleanedLocation.match(new RegExp(`([A-Za-z\\s]+?)(?:,\\s*|\\s+)${code}`, 'i'));
          if (cityCountryMatch && cityCountryMatch[1].trim().length > 1) {
            const city = this.capitalizeWords(cityCountryMatch[1].trim());
            if (!['remote', 'hybrid', 'anywhere', 'in', 'the', 'or'].includes(city.toLowerCase())) {
              return `${city}, ${country}`;
            }
          }
          // Check if there's a city mentioned separately
          const parts = cleanedLocation.split(/[,\s]+/).filter(p => 
            p.length > 1 && !['remote', 'hybrid', 'anywhere', 'in', 'the', 'or'].includes(p.toLowerCase())
          );
          if (parts.length > 1) {
            const city = this.capitalizeWords(parts[0]);
            return `${city}, ${country}`;
          }
          return country;
        }
      }

      // Check for US state abbreviations - convert to "City, United States" (no state)
      for (const [abbr, stateName] of Object.entries(this.US_STATES)) {
        const statePattern = new RegExp(`\\b${abbr}\\b`, 'i');
        if (statePattern.test(cleanedLocation)) {
          // Extract city before state
          const cityStateMatch = cleanedLocation.match(new RegExp(`([A-Za-z\\s]+?)(?:,\\s*|\\s+)${abbr}`, 'i'));
          if (cityStateMatch && cityStateMatch[1].trim().length > 1) {
            const city = this.capitalizeWords(cityStateMatch[1].trim());
            if (!['remote', 'anywhere', 'in', 'hybrid', 'or'].includes(city.toLowerCase())) {
              // Return "City, United States" - no state per ATS rules
              return `${city}, United States`;
            }
          }
          // No city, just return United States
          return 'United States';
        }
      }

      // If we have a clean city name, try to identify and format it
      const cityOnly = this.capitalizeWords(cleanedLocation.split(',')[0].trim());
      if (cityOnly.length > 1 && !['remote', 'hybrid', 'anywhere'].includes(cityOnly.toLowerCase())) {
        // Check if second part is a country
        const parts = cleanedLocation.split(',').map(p => p.trim());
        if (parts.length >= 2) {
          const potentialCountry = parts[1].toLowerCase();
          for (const [code, country] of Object.entries(this.COUNTRY_MAP)) {
            if (potentialCountry.includes(code)) {
              return `${cityOnly}, ${country}`;
            }
          }
          // Return as-is if it looks like "City, Country"
          return `${cityOnly}, ${this.capitalizeWords(parts[1])}`;
        }
        // Single city without country - might need context
        return cityOnly;
      }

      // Fallback to default
      return this.DEFAULT_LOCATION;
    },

    /**
     * Extract location from free text using patterns
     * @param {string} text - Full page text
     * @returns {string|null} Extracted location or null
     */
    extractLocationFromText(text) {
      if (!text) return null;

      // Common patterns
      const patterns = [
        /location[:\s]+([A-Za-z\s,]+(?:US|USA|United States))/i,
        /based\s+in\s+([A-Za-z\s,]+)/i,
        /office[:\s]+([A-Za-z\s,]+)/i,
        /([A-Za-z\s]+),\s*(US|USA|United States)/i,
        /remote\s*\(([^)]+)\)/i
      ];

      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          const normalized = this.normalizeLocation(match[1]);
          if (normalized !== 'Open to relocation') {
            return normalized;
          }
        }
      }

      return null;
    },

    /**
     * Capitalize each word in a string
     * @param {string} str - Input string
     * @returns {string} Capitalized string
     */
    capitalizeWords(str) {
      return str.split(/\s+/)
        .filter(w => w.length > 0)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    },

    /**
     * Generate tailored CV header with dynamic location
     * Uses "City, Country" format - no "open to relocation" suffix
     * @param {Object} candidateData - User profile data
     * @param {string} tailoredLocation - Normalized job location in "City, Country" format
     * @returns {string} Formatted header
     */
    generateHeader(candidateData, tailoredLocation) {
      const phone = candidateData.phone || '+353 0874261508';
      const email = candidateData.email || 'maxokafordev@gmail.com';
      const location = tailoredLocation || this.DEFAULT_LOCATION;
      const linkedin = candidateData.linkedin || 'https://www.linkedin.com/in/maxokafor/';
      const github = candidateData.github || 'https://github.com/MaxmilliamOkafor';
      const portfolio = candidateData.portfolio || 'https://maxmilliamplusplus.web.app/';

      // Clean format: phone | email | City, Country
      return `${phone} | ${email} | ${location}
${linkedin} | ${github} | ${portfolio}`;
    }
  };

  // Export to global scope
  window.LocationTailor = LocationTailor;
})();
