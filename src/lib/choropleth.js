import topoData from "./countries-110m.json";

// Numeric ISO 3166-1 to ISO 2-letter country code mapping
const NUMERIC_TO_ISO2 = {
  "4": "AF", "8": "AL", "10": "AQ", "12": "DZ", "24": "AO", "32": "AR",
  "36": "AU", "40": "AT", "31": "AZ", "44": "BS", "50": "BD", "51": "AM",
  "56": "BE", "64": "BT", "68": "BO", "70": "BA", "72": "BW", "76": "BR",
  "84": "BZ", "96": "BN", "100": "BG", "104": "MM", "108": "BI", "112": "BY",
  "116": "KH", "120": "CM", "124": "CA", "140": "CF", "148": "TD", "152": "CL",
  "156": "CN", "170": "CO", "178": "CG", "180": "CD", "188": "CR", "191": "HR",
  "192": "CU", "196": "CY", "203": "CZ", "204": "BJ", "208": "DK", "214": "DO",
  "218": "EC", "222": "SV", "226": "GQ", "231": "ET", "232": "ER", "233": "EE",
  "242": "FJ", "246": "FI", "250": "FR", "260": "TF", "262": "DJ", "266": "GA",
  "268": "GE", "270": "GM", "276": "DE", "288": "GH", "300": "GR", "304": "GL",
  "320": "GT", "324": "GN", "328": "GY", "332": "HT", "340": "HN", "348": "HU",
  "352": "IS", "356": "IN", "360": "ID", "364": "IR", "368": "IQ", "372": "IE",
  "376": "IL", "380": "IT", "384": "CI", "388": "JM", "392": "JP", "398": "KZ",
  "400": "JO", "404": "KE", "408": "KP", "410": "KR", "414": "KW", "417": "KG",
  "418": "LA", "422": "LB", "426": "LS", "428": "LV", "430": "LR", "434": "LY",
  "440": "LT", "442": "LU", "450": "MG", "454": "MW", "458": "MY", "466": "ML",
  "478": "MR", "484": "MX", "496": "MN", "498": "MD", "504": "MA", "508": "MZ",
  "512": "OM", "516": "NA", "524": "NP", "528": "NL", "540": "NC", "548": "VU",
  "554": "NZ", "558": "NI", "562": "NE", "566": "NG", "578": "NO", "586": "PK",
  "591": "PA", "598": "PG", "600": "PY", "604": "PE", "608": "PH", "616": "PL",
  "620": "PT", "624": "GW", "634": "QA", "642": "RO", "643": "RU", "646": "RW",
  "682": "SA", "686": "SN", "688": "RS", "694": "SL", "702": "SG", "703": "SK",
  "704": "VN", "705": "SI", "706": "SO", "710": "ZA", "716": "ZW", "724": "ES",
  "728": "SS", "729": "SD", "732": "EH", "740": "SR", "748": "SZ", "752": "SE",
  "756": "CH", "760": "SY", "762": "TJ", "764": "TH", "768": "TG", "780": "TT",
  "784": "AE", "788": "TN", "792": "TR", "795": "TM", "800": "UG", "804": "UA",
  "818": "EG", "826": "GB", "834": "TZ", "840": "US", "854": "BF", "858": "UY",
  "860": "UZ", "862": "VE", "887": "YE", "894": "ZM",
};

const NAME_ALIASES = {
  "united states of america": "US",
  "united states": "US",
  "w. sahara": "EH",
  "dem. rep. congo": "CD",
  "dominican rep.": "DO",
  "falkland is.": "FK",
  "central african rep.": "CF",
  "eq. guinea": "GQ",
  "eswatini": "SZ",
  "bosnia and herz.": "BA",
  "s. sudan": "SS",
  "solomon is.": "SB",
  "korea": "KR",
  "south korea": "KR",
  "north korea": "KP",
  "dem. rep. korea": "KP",
  "lao pdr": "LA",
  "laos": "LA",
  "syria": "SY",
  "iran": "IR",
  "tanzania": "TZ",
  "united rep. of tanzania": "TZ",
  "vietnam": "VN",
  "viet nam": "VN",
  "russia": "RU",
  "russian federation": "RU",
  "moldova": "MD",
  "venezuela": "VE",
  "bolivia": "BO",
  "brunei": "BN",
  "taiwan": "TW",
  "czech rep.": "CZ",
  "czechia": "CZ",
  "macedonia": "MK",
  "north macedonia": "MK",
  "côte d'ivoire": "CI",
  "ivory coast": "CI",
  "congo": "CG",
  "somaliland": "SO",
  "greenland": "GL",
  "kosovo": "XK",
  "n. cyprus": "CY",
};

// Color intensity tiers adapting to Dark / Light theme
export function getIntensityTiers(isDark = true) {
  if (isDark) {
    return [
      { min: 1, max: 10, label: "1 - 10", color: "#38bdf8" },
      { min: 11, max: 50, label: "11 - 50", color: "#60a5fa" },
      { min: 51, max: 200, label: "51 - 200", color: "#2563eb" },
      { min: 201, max: 500, label: "201 - 500", color: "#0ea5e9" },
      { min: 501, max: Infinity, label: "501+", color: "#06b6d4" },
    ];
  }
  return [
    { min: 1, max: 10, label: "1 - 10", color: "#93c5fd" },
    { min: 11, max: 50, label: "11 - 50", color: "#60a5fa" },
    { min: 51, max: 200, label: "51 - 200", color: "#38bdf8" },
    { min: 201, max: 500, label: "201 - 500", color: "#0ea5e9" },
    { min: 501, max: Infinity, label: "501+", color: "#06b6d4" },
  ];
}

export const INTENSITY_TIERS = getIntensityTiers(true);

/** Resolves the choropleth fill color for a given visitor count */
export function getVisitorColor(visitors, isDark = true) {
  const v = Number(visitors) || 0;
  if (isDark) {
    // Dark mode: sleek midnight navy continents (zero green, high contrast)
    if (v <= 0) return "#0f172a";
    if (v <= 10) return "#38bdf8";
    if (v <= 50) return "#60a5fa";
    if (v <= 200) return "#2563eb";
    if (v <= 500) return "#0ea5e9";
    return "#06b6d4";
  }
  // Light mode: pristine porcelain snow-white continents (zero green, zero dull gray)
  if (v <= 0) return "#ffffff";
  if (v <= 10) return "#93c5fd";
  if (v <= 50) return "#60a5fa";
  if (v <= 200) return "#38bdf8";
  if (v <= 500) return "#0ea5e9";
  return "#06b6d4";
}

// Decode TopoJSON arcs into geographic [lon, lat] points
let cachedDecodedArcs = null;
function getDecodedArcs() {
  if (cachedDecodedArcs) return cachedDecodedArcs;
  const { scale, translate } = topoData.transform;
  cachedDecodedArcs = topoData.arcs.map((arc) => {
    let x = 0;
    let y = 0;
    return arc.map(([dx, dy]) => {
      x += dx;
      y += dy;
      return [x * scale[0] + translate[0], y * scale[1] + translate[1]];
    });
  });
  return cachedDecodedArcs;
}

function getArc(idx) {
  const arcs = getDecodedArcs();
  if (idx >= 0) return arcs[idx];
  return [...arcs[~idx]].reverse();
}

/** Resolves ISO-2 country code for a geometry */
export function getCountryCode(geom) {
  if (!geom) return null;
  const rawId = String(geom.id || "");
  const numId = String(Number(geom.id));
  if (NUMERIC_TO_ISO2[numId]) return NUMERIC_TO_ISO2[numId];
  if (NUMERIC_TO_ISO2[rawId]) return NUMERIC_TO_ISO2[rawId];
  const name = String(geom.properties?.name || "").toLowerCase();
  if (NAME_ALIASES[name]) return NAME_ALIASES[name];
  return null;
}

/**
 * Generates an equirectangular offscreen canvas texture where each country
 * is filled according to its visitor intensity tier and bordered with crisp white lines.
 */
export function renderChoroplethCanvas(markers = [], width = 2048, height = 1024, isDark = false) {
  if (typeof document === "undefined") return null;

  // Build visitor lookup map by ISO2 code
  const visitorMap = new Map();
  for (const m of markers) {
    if (m?.country) {
      const code = String(m.country).toUpperCase();
      visitorMap.set(code, (visitorMap.get(code) || 0) + (Number(m.visitors) || 0));
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  if (isDark) {
    // 1. Deep cosmic midnight ocean base for dark mode with subtle planetary depth
    ctx.fillStyle = "#0c1729";
    ctx.fillRect(0, 0, width, height);

    const oceanGrad = ctx.createLinearGradient(0, 0, 0, height);
    oceanGrad.addColorStop(0, "rgba(12, 23, 41, 0.95)");
    oceanGrad.addColorStop(0.5, "rgba(18, 35, 64, 0.85)");
    oceanGrad.addColorStop(1, "rgba(10, 19, 34, 0.95)");
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, width, height);
  } else {
    // 1. Luminous crystal sapphire ocean with rich planetary depth for light mode
    ctx.fillStyle = "#1e40af";
    ctx.fillRect(0, 0, width, height);

    // Realistic ocean depth gradient
    const oceanGrad = ctx.createLinearGradient(0, 0, 0, height);
    oceanGrad.addColorStop(0, "rgba(30, 64, 175, 0.95)");
    oceanGrad.addColorStop(0.3, "rgba(29, 78, 216, 0.9)");
    oceanGrad.addColorStop(0.5, "rgba(37, 99, 235, 0.95)");
    oceanGrad.addColorStop(0.7, "rgba(29, 78, 216, 0.9)");
    oceanGrad.addColorStop(1, "rgba(30, 58, 138, 0.95)");
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, width, height);
  }

  // Helper to convert geographic lon/lat to equirectangular canvas coordinates
  const projectX = (lon) => ((lon + 180) / 360) * width;
  const projectY = (lat) => ((90 - lat) / 180) * height;

  // 2. Render each country's landmass polygons
  for (const geom of topoData.objects.countries.geometries) {
    const code = getCountryCode(geom);
    const visitors = code ? visitorMap.get(code) || 0 : 0;
    const fillColor = getVisitorColor(visitors, isDark);

    ctx.fillStyle = fillColor;
    ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.75)" : "rgba(37, 99, 235, 0.35)";
    ctx.lineWidth = isDark ? 1.1 : 1.0;

    const polygons =
      geom.type === "Polygon"
        ? [geom.arcs]
        : geom.type === "MultiPolygon"
          ? geom.arcs
          : [];

    for (const poly of polygons) {
      ctx.beginPath();
      for (const ring of poly) {
        let first = true;
        let prevLon = null;
        for (const arcIdx of ring) {
          const arc = getArc(arcIdx);
          for (const [lon, lat] of arc) {
            // Prevent antimeridian jumps across the map
            if (prevLon !== null && Math.abs(lon - prevLon) > 180) {
              first = true;
            }
            const px = projectX(lon);
            const py = projectY(lat);
            if (first) {
              ctx.moveTo(px, py);
              first = false;
            } else {
              ctx.lineTo(px, py);
            }
            prevLon = lon;
          }
        }
        ctx.closePath();
      }
      ctx.fill();
      ctx.stroke();
    }
  }

  return canvas;
}
