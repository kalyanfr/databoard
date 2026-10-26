/** The copy-paste snippet users install on their site. Exactly one line. */
export function trackingSnippet(origin, domain, projectKey) {
  const base = origin || "";
  const site = domain || projectKey || "databoard.in";
  const keyAttr = projectKey && projectKey !== site ? ` data-key="${projectKey}"` : "";
  return `<script defer src="${base}/t.js" data-site="${site}"${keyAttr}></script>`;
}

export const ingestionEndpoint = (origin) => `${origin || ""}/functions/track`;

export const setupSteps = [
  "Copy the single-line snippet below.",
  "Paste it into the <head> of every page you want to track.",
  "Click Verify Ownership Now to activate analytics for the domain.",
];