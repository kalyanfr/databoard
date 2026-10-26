/**
 * Event names the tracking snippet captures automatically. They are kept out of
 * conversion counts and get friendly labels in the realtime feed.
 */
export const AUTO_EVENT_NAMES = ["outbound_link", "file_download", "form_submit", "scroll_depth", "engaged_time"];

export const EVENT_LABELS = {
  outbound_link: "Outbound link",
  file_download: "File download",
  form_submit: "Form submitted",
  scroll_depth: "Scroll depth",
  engaged_time: "Engaged time",
};