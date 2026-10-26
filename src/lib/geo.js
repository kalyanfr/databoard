/**
 * Country helpers for the realtime map: a readable name, the flag image and an
 * approximate centre for the globe marker. Events store the two-letter ISO code
 * the platform resolves from the request.
 */
const CENTRES = {
  US: [39.8, -98.6], CA: [56.1, -106.3], MX: [23.6, -102.6], BR: [-14.2, -51.9], AR: [-38.4, -63.6],
  CL: [-35.7, -71.5], CO: [4.6, -74.3], PE: [-9.2, -75.0], VE: [7.1, -66.2], EC: [-1.8, -78.2],
  UY: [-32.5, -55.8], BO: [-16.3, -63.6], PY: [-23.4, -58.4], CR: [9.7, -83.8], PA: [8.5, -80.8],
  GB: [54.0, -2.5], IE: [53.4, -8.2], FR: [46.6, 2.2], DE: [51.2, 10.4], NL: [52.1, 5.3],
  BE: [50.5, 4.5], LU: [49.8, 6.1], CH: [46.8, 8.2], AT: [47.5, 14.6], IT: [41.9, 12.6],
  ES: [40.5, -3.7], PT: [39.4, -8.2], SE: [60.1, 18.6], NO: [60.5, 8.5], DK: [56.3, 9.5],
  FI: [61.9, 25.7], IS: [64.9, -19.0], PL: [51.9, 19.1], CZ: [49.8, 15.5], SK: [48.7, 19.7],
  HU: [47.2, 19.5], RO: [45.9, 25.0], BG: [42.7, 25.5], GR: [39.1, 21.8], HR: [45.1, 15.2],
  RS: [44.0, 21.0], UA: [48.4, 31.2], BY: [53.7, 27.9], RU: [61.5, 105.3], TR: [39.0, 35.2],
  IL: [31.0, 34.9], SA: [23.9, 45.1], AE: [24.0, 54.0], QA: [25.4, 51.2], KW: [29.3, 47.5],
  EG: [26.8, 30.8], MA: [31.8, -7.1], DZ: [28.0, 1.7], TN: [33.9, 9.6], NG: [9.1, 8.7],
  KE: [0.0, 37.9], GH: [7.9, -1.0], ZA: [-30.6, 22.9], ET: [9.1, 40.5], TZ: [-6.4, 34.9],
  UG: [1.4, 32.3], SN: [14.5, -14.5], CM: [7.4, 12.4], CI: [7.5, -5.5], CN: [35.9, 104.2],
  JP: [36.2, 138.3], KR: [35.9, 127.8], IN: [20.6, 79.0], PK: [30.4, 69.3], BD: [23.7, 90.4],
  LK: [7.9, 80.8], NP: [28.4, 84.1], TH: [15.9, 101.0], VN: [14.1, 108.3], MY: [4.2, 101.9],
  SG: [1.35, 103.8], ID: [-0.8, 113.9], PH: [12.9, 121.8], HK: [22.3, 114.2], TW: [23.7, 121.0],
  AU: [-25.3, 133.8], NZ: [-40.9, 174.9], KZ: [48.0, 66.9], UZ: [41.4, 64.6], AZ: [40.1, 47.6],
  GE: [42.3, 43.4], AM: [40.1, 45.0], IR: [32.4, 53.7], IQ: [33.2, 43.7], JO: [30.6, 36.2],
  LB: [33.9, 35.9], LK2: [7.9, 80.8], CY: [35.1, 33.4], MT: [35.9, 14.4], EE: [58.6, 25.0],
  LV: [56.9, 24.6], LT: [55.2, 23.9], SI: [46.2, 15.0], AL: [41.2, 20.2], MD: [47.4, 28.4],
};

const displayNames =
  typeof Intl !== "undefined" && typeof Intl.DisplayNames === "function"
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

const ALPHA3_TO_ALPHA2 = {
  USA: "US", GBR: "GB", IND: "IN", DEU: "DE", FRA: "FR", CAN: "CA", AUS: "AU",
  JPN: "JP", BRA: "BR", CHN: "CN", ESP: "ES", ITA: "IT", NLD: "NL", RUS: "RU",
  KOR: "KR", MEX: "MX", SGP: "SG", CHE: "CH", SWE: "SE", POL: "PL", TUR: "TR",
  ZAF: "ZA", ARG: "AR", NOR: "NO", DNK: "DK", FIN: "FI", IRL: "IE", NZL: "NZ",
  AUT: "AT", BEL: "BE", PRT: "PT", ISR: "IL", ARE: "AE", SAU: "SA", EGY: "EG",
  THA: "TH", VNM: "VN", IDN: "ID", PHL: "PH", MYS: "MY", PAK: "PK", BGD: "BD",
  NGA: "NG", KEN: "KE", UKR: "UA", COL: "CO", CHL: "CL", PER: "PE", CZE: "CZ",
  ROU: "RO", GRC: "GR", HUN: "HU", TWN: "TW", HKG: "HK",
};

const COMMON_NAMES = {
  "united states": "US", "united states of america": "US", "usa": "US",
  "united kingdom": "GB", "great britain": "GB", "uk": "GB", "england": "GB",
  "india": "IN", "germany": "DE", "deutschland": "DE", "france": "FR",
  "canada": "CA", "australia": "AU", "japan": "JP", "brazil": "BR",
  "china": "CN", "spain": "ES", "italy": "IT", "netherlands": "NL",
  "russia": "RU", "south korea": "KR", "korea": "KR", "mexico": "MX",
  "singapore": "SG", "switzerland": "CH", "sweden": "SE", "poland": "PL",
  "turkey": "TR", "south africa": "ZA", "argentina": "AR", "norway": "NO",
  "denmark": "DK", "finland": "FI", "ireland": "IE", "new zealand": "NZ",
  "austria": "AT", "belgium": "BE", "portugal": "PT", "israel": "IL",
  "united arab emirates": "AE", "uae": "AE", "saudi arabia": "SA",
  "egypt": "EG", "thailand": "TH", "vietnam": "VN", "indonesia": "ID",
  "philippines": "PH", "malaysia": "MY", "pakistan": "PK", "bangladesh": "BD",
  "nigeria": "NG", "kenya": "KE", "ukraine": "UA", "colombia": "CO",
};

export function normalizeCountryCode(input) {
  if (!input) return null;
  const raw = String(input).trim();
  const upper = raw.toUpperCase();
  if (/^[A-Z]{2}$/.test(upper)) return upper;
  if (ALPHA3_TO_ALPHA2[upper]) return ALPHA3_TO_ALPHA2[upper];
  const lower = raw.toLowerCase();
  if (COMMON_NAMES[lower]) return COMMON_NAMES[lower];
  return null;
}

export const countryName = (code) => {
  const normalized = normalizeCountryCode(code) || code;
  const value = String(normalized ?? "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(value)) return code ? String(code) : "Unknown";
  try {
    return displayNames?.of(value) || value;
  } catch {
    return value;
  }
};

/** Approximate centre for a country code, or null when it is not charted. */
export function countryCentre(code) {
  const normalized = normalizeCountryCode(code) || code;
  const entry = CENTRES[String(normalized ?? "").toUpperCase()];
  return entry ? { lat: entry[0], lng: entry[1] } : null;
}

/** Name and centre for a two-letter country code, or null when not charted. */
export function countryMeta(code) {
  const centre = countryCentre(code);
  if (!centre) return null;
  return { name: countryName(code), lat: centre.lat, lng: centre.lng };
}

export function flagUrl(code, width = 80) {
  const value = String(code ?? "").toLowerCase();
  if (!/^[a-z]{2}$/.test(value)) return null;
  const allowed = [20, 40, 80, 160, 320];
  const w = allowed.includes(width) ? width : 80;
  return `https://flagcdn.com/w${w}/${value}.png`;
}

export const flagEmoji = (code) => {
  const value = String(code ?? "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(value)) return "";
  return String.fromCodePoint(...[...value].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65));
};