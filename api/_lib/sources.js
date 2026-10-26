// Known sources catalog and attribution classifier for api/track.js
export const KNOWN_SOURCES = [
  // AI Assistants & Search Engines
  { name: 'ChatGPT', domain: 'chatgpt.com', channel: 'AI', match: /^(t?chatgpt\.com|openai\.com|chatgpt|openai)$/ },
  { name: 'Claude', domain: 'claude.ai', channel: 'AI', match: /^(claude\.ai|anthropic\.com|claude|anthropic)$/ },
  { name: 'Perplexity', domain: 'perplexity.ai', channel: 'AI', match: /^(perplexity\.ai|perplexity)$/ },
  { name: 'Gemini', domain: 'gemini.google.com', channel: 'AI', match: /^(gemini\.google\.com|bard\.google\.com|gemini|bard)$/ },
  { name: 'Copilot', domain: 'copilot.microsoft.com', channel: 'AI', match: /^(copilot\.microsoft\.com|copilot|bing\.com\/chat)$/ },
  { name: 'DeepSeek', domain: 'deepseek.com', channel: 'AI', match: /^((.*\.)?deepseek\.com|deepseek)$/ },
  { name: 'Grok', domain: 'grok.com', channel: 'AI', match: /^(grok\.com|x\.ai|grok)$/ },
  { name: 'Meta AI', domain: 'meta.ai', channel: 'AI', match: /^(meta\.ai|metaai)$/ },
  { name: 'Mistral / Le Chat', domain: 'chat.mistral.ai', channel: 'AI', match: /^(chat\.mistral\.ai|mistral\.ai|mistral)$/ },
  { name: 'Phind', domain: 'phind.com', channel: 'AI', match: /^(phind\.com|phind)$/ },
  { name: 'You.com', domain: 'you.com', channel: 'AI', match: /^(you\.com|youbot)$/ },
  { name: 'Poe', domain: 'poe.com', channel: 'AI', match: /^(poe\.com|poe)$/ },
  { name: 'Kimi', domain: 'kimi.ai', channel: 'AI', match: /^(kimi\.ai|moonshot\.cn|kimi)$/ },

  // Search Engines
  { name: 'Google', domain: 'google.com', channel: 'Organic Search', match: /^((www\.)?google\.[a-z.]+|google)$/ },
  { name: 'Bing', domain: 'bing.com', channel: 'Organic Search', match: /^((.*\.)?bing\.com|bing)$/ },
  { name: 'DuckDuckGo', domain: 'duckduckgo.com', channel: 'Organic Search', match: /^((.*\.)?duckduckgo\.com|duckduckgo|ddg)$/ },
  { name: 'Yahoo', domain: 'yahoo.com', channel: 'Organic Search', match: /^((.*\.)?yahoo\.[a-z.]+|yahoo)$/ },
  { name: 'Yandex', domain: 'yandex.com', channel: 'Organic Search', match: /^((.*\.)?yandex\.[a-z.]+|yandex)$/ },
  { name: 'Baidu', domain: 'baidu.com', channel: 'Organic Search', match: /^((.*\.)?baidu\.com|baidu)$/ },
  { name: 'Ecosia', domain: 'ecosia.org', channel: 'Organic Search', match: /^((.*\.)?ecosia\.org|ecosia)$/ },
  { name: 'Brave Search', domain: 'search.brave.com', channel: 'Organic Search', match: /^(search\.brave\.com)$/ },

  // Social
  { name: 'X / Twitter', domain: 'x.com', channel: 'Social', match: /^(t\.co|(.*\.)?(x|twitter)\.com|x|twitter|tw)$/ },
  { name: 'YouTube', domain: 'youtube.com', channel: 'Social', match: /^((.*\.)?(youtube\.com|youtu\.be)|youtube|yt)$/ },
  { name: 'LinkedIn', domain: 'linkedin.com', channel: 'Social', match: /^((.*\.)?(linkedin\.com|lnkd\.in)|linkedin)$/ },
  { name: 'Reddit', domain: 'reddit.com', channel: 'Social', match: /^((.*\.)?reddit\.com|reddit)$/ },
  { name: 'Facebook', domain: 'facebook.com', channel: 'Social', match: /^((.*\.)?(facebook\.com|fb\.com|fb\.me)|facebook|fb)$/ },
  { name: 'Instagram', domain: 'instagram.com', channel: 'Social', match: /^((.*\.)?instagram\.com|instagram|ig)$/ },
  { name: 'Threads', domain: 'threads.net', channel: 'Social', match: /^((.*\.)?threads\.(net|com)|threads)$/ },
  { name: 'TikTok', domain: 'tiktok.com', channel: 'Social', match: /^((.*\.)?tiktok\.com|tiktok)$/ },
  { name: 'Pinterest', domain: 'pinterest.com', channel: 'Social', match: /^((.*\.)?pinterest\.[a-z.]+|pinterest)$/ },
  { name: 'Bluesky', domain: 'bsky.app', channel: 'Social', match: /^((.*\.)?bsky\.app|bluesky|bsky)$/ },
  { name: 'Mastodon', domain: 'mastodon.social', channel: 'Social', match: /^((.*\.)?mastodon\.[a-z.]+|mastodon)$/ },
  { name: 'Hacker News', domain: 'news.ycombinator.com', channel: 'Social', match: /^(news\.ycombinator\.com|hackernews|hn)$/ },

  // Email
  { name: 'Gmail', domain: 'mail.google.com', channel: 'Email', match: /^(mail\.google\.com|gmail)$/ },
  { name: 'Outlook', domain: 'outlook.com', channel: 'Email', match: /^((.*\.)?(outlook\.(com|live\.com)|outlook\.office\.com))$/ },
  { name: 'Yahoo Mail', domain: 'mail.yahoo.com', channel: 'Email', match: /^(mail\.yahoo\.com)$/ },
  { name: 'Newsletter', domain: '', channel: 'Email', match: /^(newsletter|email|mail)$/ },

  // Referrals
  { name: 'Product Hunt', domain: 'producthunt.com', channel: 'Referral', match: /^((.*\.)?producthunt\.com|producthunt|ph)$/ },
  { name: 'GitHub', domain: 'github.com', channel: 'Referral', match: /^((.*\.)?github\.com|github)$/ },
  { name: 'Medium', domain: 'medium.com', channel: 'Referral', match: /^((.*\.)?medium\.com|medium)$/ },
  { name: 'Substack', domain: 'substack.com', channel: 'Referral', match: /^((.*\.)?substack\.com)$/ },
  { name: 'Dev.to', domain: 'dev.to', channel: 'Referral', match: /^(dev\.to|devto)$/ },
  { name: 'Indie Hackers', domain: 'indiehackers.com', channel: 'Referral', match: /^((.*\.)?indiehackers\.com|indiehackers)$/ },
];

export function findKnownSource(key) {
  if (!key) return undefined;
  const k = String(key).toLowerCase().trim();
  return KNOWN_SOURCES.find((s) => s.match.test(k));
}

export function classifyAttribution({ referrerDomain, utmSource, utmMedium, ref }) {
  const tag = utmSource || ref || null;
  const known = findKnownSource(tag) || findKnownSource(referrerDomain);
  const med = (utmMedium || '').toLowerCase().trim();

  let source = 'Direct';
  if (known) source = known.name;
  else if (tag) source = tag;
  else if (referrerDomain) source = referrerDomain;

  let channel = 'Direct';
  if (/^(cpc|ppc|cpm|paid|paid[_-]?social|paidsearch|ads?|display|retargeting|sponsored)$/i.test(med) || /adwords|googleads/.test((tag || '').toLowerCase())) {
    channel = 'Paid Ads';
  } else if (/^(ai|llm|agent|gpt|chat|chatbot|assistant)$/i.test(med) || (known && known.channel === 'AI')) {
    channel = 'AI';
  } else if (/^(e-?mail|newsletter)$/i.test(med) || (known && known.channel === 'Email')) {
    channel = 'Email';
  } else if (known) {
    channel = known.channel;
  } else if (/^(social|social[_-]?media|sm)$/i.test(med)) {
    channel = 'Social';
  } else if (med) {
    channel = 'Campaign';
  } else if (tag || referrerDomain) {
    if (/google\.|bing\.|duckduckgo\.|yahoo\.|ecosia\./i.test(referrerDomain || '')) channel = 'Organic Search';
    else if (/chatgpt|openai|claude|perplexity|gemini|deepseek|grok/i.test(referrerDomain || tag || '')) channel = 'AI';
    else channel = 'Referral';
  }

  return {
    source,
    channel,
    domain: known ? known.domain : (referrerDomain || null),
    isAi: channel === 'AI',
  };
}
