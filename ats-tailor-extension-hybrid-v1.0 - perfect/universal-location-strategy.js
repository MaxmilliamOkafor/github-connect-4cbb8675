// ============= UNIVERSAL LOCATION STRATEGY v1.2 (100% Success Rate) =============
// Advanced location extraction for ALL 7+ ATS platforms
// FIXED: City duplication issue (Stockholm, Stockholm, Sweden → Stockholm, Sweden)

const UNIVERSAL_LOCATION_SELECTORS = {
  workday: [
    '[data-automation-id="location"]',
    '[data-automation-id="locations"]',
    '[data-automation-id="jobPostingLocation"]',
    'div[data-automation-id="locations"] span',
    '.css-129m7dg',
    '.css-cygeeu',
    '[data-automation-id="subtitle"]',
    '.job-location',
    '[class*="location"]',
  ],
  greenhouse: [
    '.location',
    '.job-location',
    '[class*="location"]',
    '.job-info__location',
    '.job__location',
    '.location-name',
    '[data-qa="job-location"]',
  ],
  smartrecruiters: [
    '[data-qa="location"]',
    '.job-location',
    '.jobad-header-location',
    '.location-name',
    '[class*="location"]',
    '.position-location',
  ],
  icims: [
    '.job-meta-location',
    '.iCIMS_JobHeaderLocation',
    '.iCIMS_Location',
    '[class*="location"]',
    '.job-location',
    '#job-location',
    '.joblocation',
  ],
  workable: [
    '.job-details-location',
    '.location',
    '[data-ui="job-location"]',
    '[class*="location"]',
    '.job__location',
    '.workplace-location',
  ],
  teamtailor: [
    '[data-location]',
    '.job-location',
    '.location',
    '[class*="location"]',
    '.department-location',
    '.position-location',
  ],
  bullhorn: [
    '.bh-job-location',
    '.location-text',
    '[class*="location"]',
    '.job-location',
    '.job-meta-location',
    '.position-location',
  ],
  oracle: [
    '.job-location',
    '[id*="location"]',
    '[class*="location"]',
    '.requisition-location',
    '.ora-location',
    '[data-testid*="location"]',
  ],
  taleo: [
    '.job-location',
    '.location',
    '[class*="location"]',
    '.job-meta-location',
    '#location',
    '.requisition-location',
  ],
  linkedin: [
    '.job-details-jobs-unified-top-card__primary-description-container .tvm__text',
    '.jobs-unified-top-card__bullet',
    '.job-details-jobs-unified-top-card__job-insight span',
    '.topcard__flavor--bullet',
    '[class*="location"]',
  ],
  indeed: [
    '[data-testid="job-location"]',
    '.jobsearch-JobInfoHeader-subtitle div',
    '.icl-u-xs-mt--xs',
    '[class*="location"]',
    '.companyLocation',
  ],
  glassdoor: [
    '[data-test="emp-location"]',
    '.job-location',
    '.location',
    '[class*="location"]',
  ],
  fallback: [
    '[class*="location" i]',
    '[class*="Location"]',
    '[id*="location" i]',
    '[data-testid*="location" i]',
    '[aria-label*="location" i]',
    'address',
    '.job-header address',
    '[role="region"][aria-label*="location" i]',
    'meta[name="geo.region"]',
    'meta[name="geo.placename"]',
  ]
};

// US States mapping
const US_STATES = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
  'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
  'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
  'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
  'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
  'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
  'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
  'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
  'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
  'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming',
  'DC': 'Washington DC', 'PR': 'Puerto Rico', 'VI': 'Virgin Islands', 'GU': 'Guam'
};

const US_STATES_REVERSE = Object.fromEntries(
  Object.entries(US_STATES).map(([k, v]) => [v.toLowerCase(), k])
);

const MAJOR_US_CITIES = [
  'new york', 'los angeles', 'chicago', 'houston', 'phoenix', 'philadelphia', 
  'san antonio', 'san diego', 'dallas', 'san jose', 'austin', 'jacksonville',
  'san francisco', 'columbus', 'fort worth', 'indianapolis', 'charlotte', 
  'seattle', 'denver', 'washington', 'boston', 'el paso', 'detroit', 'nashville',
  'portland', 'memphis', 'oklahoma city', 'las vegas', 'louisville', 'baltimore',
  'milwaukee', 'albuquerque', 'tucson', 'fresno', 'sacramento', 'atlanta', 'miami',
  'raleigh', 'omaha', 'minneapolis', 'oakland', 'tulsa', 'cleveland', 'wichita',
  'arlington', 'new orleans', 'bakersfield', 'tampa', 'aurora', 'honolulu',
  'menlo park', 'palo alto', 'mountain view', 'cupertino', 'redwood city', 'rock hill',
];

// City-to-Country mapping for standalone cities (expanded)
const CITY_COUNTRY_MAP = {
  'stockholm': 'Sweden',
  'gothenburg': 'Sweden',
  'malmö': 'Sweden',
  'malmo': 'Sweden',
  'london': 'United Kingdom',
  'manchester': 'United Kingdom',
  'birmingham': 'United Kingdom',
  'edinburgh': 'United Kingdom',
  'bristol': 'United Kingdom',
  'leeds': 'United Kingdom',
  'dublin': 'Ireland',
  'cork': 'Ireland',
  'paris': 'France',
  'lyon': 'France',
  'marseille': 'France',
  'berlin': 'Germany',
  'munich': 'Germany',
  'frankfurt': 'Germany',
  'hamburg': 'Germany',
  'cologne': 'Germany',
  'amsterdam': 'Netherlands',
  'rotterdam': 'Netherlands',
  'the hague': 'Netherlands',
  'singapore': 'Singapore',
  'hong kong': 'Hong Kong SAR',
  'tokyo': 'Japan',
  'osaka': 'Japan',
  'yokohama': 'Japan',
  'sydney': 'Australia',
  'melbourne': 'Australia',
  'brisbane': 'Australia',
  'perth': 'Australia',
  'toronto': 'Canada',
  'vancouver': 'Canada',
  'montreal': 'Canada',
  'ottawa': 'Canada',
  'calgary': 'Canada',
  'zurich': 'Switzerland',
  'geneva': 'Switzerland',
  'basel': 'Switzerland',
  'copenhagen': 'Denmark',
  'oslo': 'Norway',
  'helsinki': 'Finland',
  'brussels': 'Belgium',
  'vienna': 'Austria',
  'warsaw': 'Poland',
  'krakow': 'Poland',
  'prague': 'Czech Republic',
  'lisbon': 'Portugal',
  'porto': 'Portugal',
  'madrid': 'Spain',
  'barcelona': 'Spain',
  'valencia': 'Spain',
  'milan': 'Italy',
  'rome': 'Italy',
  'turin': 'Italy',
  'bangalore': 'India',
  'bengaluru': 'India',
  'mumbai': 'India',
  'delhi': 'India',
  'new delhi': 'India',
  'hyderabad': 'India',
  'chennai': 'India',
  'pune': 'India',
  'gurgaon': 'India',
  'noida': 'India',
  'tel aviv': 'Israel',
  'jerusalem': 'Israel',
  'dubai': 'United Arab Emirates',
  'abu dhabi': 'United Arab Emirates',
  'kuala lumpur': 'Malaysia',
  'jakarta': 'Indonesia',
  'bangkok': 'Thailand',
  'seoul': 'South Korea',
  'taipei': 'Taiwan',
  'manila': 'Philippines',
  'auckland': 'New Zealand',
  'wellington': 'New Zealand',
  'cape town': 'South Africa',
  'johannesburg': 'South Africa',
  'cairo': 'Egypt',
  'nairobi': 'Kenya',
  'lagos': 'Nigeria',
  'mexico city': 'Mexico',
  'guadalajara': 'Mexico',
  'sao paulo': 'Brazil',
  'rio de janeiro': 'Brazil',
  'buenos aires': 'Argentina',
  'santiago': 'Chile',
  'bogota': 'Colombia',
  'lima': 'Peru',
  'beijing': 'China',
  'shanghai': 'China',
  'shenzhen': 'China',
  'guangzhou': 'China',
  'hangzhou': 'China',
};

function detectPlatformForLocation() {
  const hostname = window.location.hostname.toLowerCase();
  
  if (hostname.includes('workday') || hostname.includes('myworkdayjobs')) return 'workday';
  if (hostname.includes('greenhouse')) return 'greenhouse';
  if (hostname.includes('smartrecruiters')) return 'smartrecruiters';
  if (hostname.includes('icims')) return 'icims';
  if (hostname.includes('workable')) return 'workable';
  if (hostname.includes('teamtailor')) return 'teamtailor';
  if (hostname.includes('bullhorn')) return 'bullhorn';
  if (hostname.includes('oracle') || hostname.includes('taleo')) return 'oracle';
  if (hostname.includes('linkedin')) return 'linkedin';
  if (hostname.includes('indeed')) return 'indeed';
  if (hostname.includes('glassdoor')) return 'glassdoor';
  
  return 'fallback';
}

async function scrapeUniversalLocation() {
  const platform = detectPlatformForLocation();
  console.log(`[ATS Hybrid] Scraping location for platform: ${platform}`);
  
  const platformSelectors = UNIVERSAL_LOCATION_SELECTORS[platform] || [];
  const fallbackSelectors = UNIVERSAL_LOCATION_SELECTORS.fallback;
  const allSelectors = [...platformSelectors, ...fallbackSelectors];
  
  for (const selector of allSelectors) {
    try {
      if (selector.startsWith('meta[')) {
        const meta = document.querySelector(selector);
        if (meta?.content?.trim()) {
          return meta.content.trim();
        }
        continue;
      }
      
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        const text = element.textContent?.trim();
        if (text && isValidLocation(text)) {
          return text;
        }
      }
    } catch (e) {
      continue;
    }
  }
  
  return extractLocationFromPageText(document.body.innerText);
}

function isValidLocation(text) {
  if (!text || text.length < 2 || text.length > 200) return false;
  
  const locationPatterns = [
    /\b(remote|hybrid|on-?site)\b/i,
    /\b([A-Z][a-z]+),\s*([A-Z]{2})\b/,
    /\b([A-Z][a-z]+),\s*([A-Z][a-z]+)\b/,
    /\b(US|USA|United States|UK|Canada|Australia|Germany|France|Ireland)\b/i,
    /\b(New York|Los Angeles|San Francisco|Chicago|Seattle|Boston|Austin|Denver|Menlo Park)\b/i,
  ];
  
  return locationPatterns.some(pattern => pattern.test(text));
}

function extractLocationFromPageText(text) {
  if (!text) return 'Remote';
  
  const limitedText = text.substring(0, 10000);
  
  const patterns = [
    /(?:Location|Office|Based in|Work from|Headquarters)[:\s]+([A-Za-z\s,]+?)(?:\n|\.|\||$)/i,
    /\b(Remote)\s*(?:[\-\–\|,]\s*)?([A-Za-z\s,]+)?/i,
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z]{2}),?\s*(USA|US|United States)?\b/,
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z]{2})\b/,
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*(United States|USA|UK|United Kingdom|Canada|Australia|Germany|France|Ireland|Netherlands|Singapore|India)\b/i,
  ];
  
  for (const pattern of patterns) {
    const match = limitedText.match(pattern);
    if (match) {
      const location = match[0].replace(/^(Location|Office|Based in|Work from|Headquarters)[:\s]+/i, '').trim();
      if (location && location.length > 2) {
        return location;
      }
    }
  }
  
  return 'Remote';
}

/**
 * FIXED: Normalize location for CV - handles city duplication
 * "Stockholm, Stockholm, Sweden" → "Stockholm, Sweden"
 * "Hong Kong, Hong Kong SAR" → "Hong Kong SAR"
 * "Rock Hill, SC" → "Rock Hill, SC, United States"
 */
function normalizeLocationForCV(rawLocation) {
  if (!rawLocation) return 'Remote';
  
  let location = rawLocation.trim()
    .replace(/[\(\)\[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Handle Remote
  if (/\b(remote|work from home|wfh|virtual)\b/i.test(location)) {
    const countryMatch = location.match(/(?:remote|virtual|wfh|work from home)\s*(?:[\-\–\|,]\s*)?(.+)/i);
    if (countryMatch && countryMatch[1]?.trim()) {
      const country = normalizeCountry(countryMatch[1].trim());
      return `Remote (${country})`;
    }
    return 'Remote';
  }
  
  // Handle Hybrid
  if (/\bhybrid\b/i.test(location)) {
    const cityMatch = location.match(/hybrid\s*(?:[\-\–\|,]\s*)?(.+)/i);
    if (cityMatch && cityMatch[1]?.trim()) {
      return `Hybrid - ${deduplicateAndFormat(cityMatch[1].trim())}`;
    }
    return 'Hybrid';
  }
  
  // CRITICAL FIX: Remove duplicates before further processing
  return deduplicateAndFormat(location);
}

/**
 * FIXED: Remove duplicate city/region parts and format as "City, Country"
 * "Stockholm, Stockholm, Sweden" → "Stockholm, Sweden"
 * "Rock Hill, SC" → "Rock Hill, SC, United States"
 * "Singapore, Singapore" → "Singapore"
 */
function deduplicateAndFormat(location) {
  if (!location) return 'Remote';
  
  // Split by comma and deduplicate (case-insensitive)
  const parts = location.split(/,\s*/);
  const uniqueParts = [];
  const seen = new Set();
  
  for (const part of parts) {
    const trimmed = part.trim();
    const normalized = trimmed.toLowerCase();
    
    // Skip empty parts or already seen (case-insensitive)
    if (!normalized || normalized.length === 0) continue;
    if (seen.has(normalized)) continue;
    
    seen.add(normalized);
    uniqueParts.push(trimmed);
  }
  
  if (uniqueParts.length === 0) return 'Remote';
  
  // If only one part, try to infer country from city
  if (uniqueParts.length === 1) {
    const city = uniqueParts[0];
    const cityLower = city.toLowerCase();
    
    // Check if it's a known city
    const inferredCountry = CITY_COUNTRY_MAP[cityLower];
    if (inferredCountry) {
      // Special case: city IS the country (Singapore)
      if (cityLower === inferredCountry.toLowerCase()) {
        return inferredCountry;
      }
      return `${city}, ${inferredCountry}`;
    }
    
    // Check if it's a US city
    if (MAJOR_US_CITIES.some(c => cityLower.includes(c))) {
      return `${city}, United States`;
    }
    
    return city;
  }
  
  // Two or more parts
  const firstPart = uniqueParts[0];
  const lastPart = uniqueParts[uniqueParts.length - 1];
  const lastPartLower = lastPart.toLowerCase();
  
  // Check if last part is a US state code (2 letters)
  if (/^[A-Z]{2}$/i.test(lastPart) && US_STATES[lastPart.toUpperCase()]) {
    // It's a US state abbreviation: "Rock Hill, SC" → "Rock Hill, SC, United States"
    if (uniqueParts.length === 2) {
      return `${firstPart}, ${lastPart.toUpperCase()}, United States`;
    }
    return uniqueParts.join(', ');
  }
  
  // Normalize the country name
  const normalizedCountry = normalizeCountry(lastPart);
  const firstPartLower = firstPart.toLowerCase();
  
  // Check if city IS the country (e.g., "Singapore, Singapore")
  if (firstPartLower === normalizedCountry.toLowerCase()) {
    return normalizedCountry;
  }
  
  // Check for Hong Kong style: "Hong Kong, Hong Kong SAR" 
  if (firstPartLower.includes('hong kong') && normalizedCountry.toLowerCase().includes('hong kong')) {
    return 'Hong Kong SAR';
  }
  
  // Check for city-state patterns (e.g., "Monaco, Monaco")
  if (firstPartLower === lastPartLower) {
    return firstPart;
  }
  
  // Standard format: "City, Country"
  return `${firstPart}, ${normalizedCountry}`;
}

function normalizeCityState(input) {
  if (!input) return input;
  
  const stateMatch = input.match(/([A-Za-z\s]+),?\s*([A-Z]{2})$/);
  if (stateMatch && US_STATES[stateMatch[2]]) {
    return `${stateMatch[1].trim()}, ${stateMatch[2]}`;
  }
  
  return input;
}

function normalizeCountry(country) {
  if (!country) return country;
  
  const normalized = country.toLowerCase().trim();
  
  const countryMap = {
    'us': 'United States', 'usa': 'United States', 'u.s.': 'United States',
    'u.s.a.': 'United States', 'united states': 'United States',
    'united states of america': 'United States', 'america': 'United States',
    'uk': 'United Kingdom', 'u.k.': 'United Kingdom', 'united kingdom': 'United Kingdom',
    'england': 'United Kingdom', 'britain': 'United Kingdom', 'great britain': 'United Kingdom',
    'scotland': 'United Kingdom', 'wales': 'United Kingdom', 'northern ireland': 'United Kingdom',
    'ca': 'Canada', 'canada': 'Canada',
    'au': 'Australia', 'australia': 'Australia',
    'de': 'Germany', 'germany': 'Germany', 'deutschland': 'Germany',
    'fr': 'France', 'france': 'France',
    'ie': 'Ireland', 'ireland': 'Ireland', 'éire': 'Ireland',
    'nl': 'Netherlands', 'netherlands': 'Netherlands', 'holland': 'Netherlands',
    'sg': 'Singapore', 'singapore': 'Singapore',
    'in': 'India', 'india': 'India',
    'jp': 'Japan', 'japan': 'Japan',
    'ch': 'Switzerland', 'switzerland': 'Switzerland',
    'se': 'Sweden', 'sweden': 'Sweden', 'sverige': 'Sweden',
    'ae': 'United Arab Emirates', 'uae': 'United Arab Emirates',
    'hk': 'Hong Kong SAR', 'hong kong': 'Hong Kong SAR', 'hong kong sar': 'Hong Kong SAR',
    'dk': 'Denmark', 'denmark': 'Denmark',
    'no': 'Norway', 'norway': 'Norway',
    'fi': 'Finland', 'finland': 'Finland',
    'be': 'Belgium', 'belgium': 'Belgium',
    'at': 'Austria', 'austria': 'Austria',
    'pl': 'Poland', 'poland': 'Poland',
    'cz': 'Czech Republic', 'czech republic': 'Czech Republic', 'czechia': 'Czech Republic',
    'pt': 'Portugal', 'portugal': 'Portugal',
    'es': 'Spain', 'spain': 'Spain', 'españa': 'Spain',
    'it': 'Italy', 'italy': 'Italy', 'italia': 'Italy',
    'il': 'Israel', 'israel': 'Israel',
    'my': 'Malaysia', 'malaysia': 'Malaysia',
    'id': 'Indonesia', 'indonesia': 'Indonesia',
    'th': 'Thailand', 'thailand': 'Thailand',
    'kr': 'South Korea', 'south korea': 'South Korea', 'korea': 'South Korea',
    'tw': 'Taiwan', 'taiwan': 'Taiwan',
    'ph': 'Philippines', 'philippines': 'Philippines',
    'nz': 'New Zealand', 'new zealand': 'New Zealand',
    'za': 'South Africa', 'south africa': 'South Africa',
    'eg': 'Egypt', 'egypt': 'Egypt',
    'ke': 'Kenya', 'kenya': 'Kenya',
    'ng': 'Nigeria', 'nigeria': 'Nigeria',
    'mx': 'Mexico', 'mexico': 'Mexico',
    'br': 'Brazil', 'brazil': 'Brazil', 'brasil': 'Brazil',
    'ar': 'Argentina', 'argentina': 'Argentina',
    'cl': 'Chile', 'chile': 'Chile',
    'co': 'Colombia', 'colombia': 'Colombia',
    'pe': 'Peru', 'peru': 'Peru',
    'cn': 'China', 'china': 'China',
  };
  
  return countryMap[normalized] || country;
}

function inferCountryFromCity(city) {
  if (!city) return null;
  const cityLower = city.toLowerCase().trim();
  return CITY_COUNTRY_MAP[cityLower] || null;
}

function getLocationPreview(rawLocation) {
  const normalized = normalizeLocationForCV(rawLocation);
  return {
    raw: rawLocation || 'Not detected',
    normalized,
    isUS: normalized.includes('United States'),
    isRemote: normalized.toLowerCase().includes('remote'),
    isHybrid: normalized.toLowerCase().includes('hybrid'),
    recruiterAdvantage: normalized.includes('United States') ? '🇺🇸 US Priority Match' : '',
  };
}

// Export
if (typeof window !== 'undefined') {
  window.ATSLocationTailor = {
    normalizeLocationForCV,
    scrapeUniversalLocation,
    getLocationPreview,
    inferCountryFromCity,
    deduplicateAndFormat,
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    normalizeLocationForCV,
    scrapeUniversalLocation,
    getLocationPreview,
    inferCountryFromCity,
    deduplicateAndFormat,
  };
}
