import { createClient } from '@supabase/supabase-js';
import { classifyAttribution } from './_lib/sources.js';
import { getTelegramConfig, sendTelegramMessage } from './telegram.js';
import { getCloudflareConfig, executeD1Query } from './cloudflare.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://vhnldpotikynnyaantgt.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_gkrz-FNCgEuMmYW1Yltu6w_edVA0KaO';

// If service role key is available in Vercel, it bypasses RLS completely
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// In-memory sliding rate limiter per IP to prevent DDoS and event flooding
const ipBuckets = new Map();
function isRateLimited(ip) {
  if (!ip) return false;
  const now = Date.now();
  if (ipBuckets.size > 10000) {
    for (const [k, v] of ipBuckets) {
      if (v.resetAt <= now) ipBuckets.delete(k);
    }
  }
  const bucket = ipBuckets.get(ip);
  if (!bucket || bucket.resetAt <= now) {
    ipBuckets.set(ip, { count: 1, resetAt: now + 60000 });
    return false;
  }
  bucket.count++;
  return bucket.count > 240; // Max 240 events per minute per IP
}

// Bot & crawler pattern: prevent scrapers, headless spiders, and automated tests from skewing analytics
const BOT_REGEX = /(bot|crawler|spider|slurp|facebookexternalhit|whatsapp|preview|headless|lighthouse|monitor|postman|curl|wget|python|node-fetch|axios|insomnia)/i;

// AI Crawler definitions for Generative Engine Optimization (GEO)
const AI_CRAWLER_DEFINITIONS = [
  { pattern: /ChatGPT-User/i, name: 'ChatGPT Search', vendor: 'OpenAI', purpose: 'Live Search Citations' },
  { pattern: /OAI-SearchBot/i, name: 'OAI-SearchBot', vendor: 'OpenAI', purpose: 'Search Indexing' },
  { pattern: /GPTBot/i, name: 'GPTBot', vendor: 'OpenAI', purpose: 'Model Training & Indexing' },
  { pattern: /PerplexityBot/i, name: 'PerplexityBot', vendor: 'Perplexity AI', purpose: 'Live Search Citations' },
  { pattern: /ClaudeBot|Claude-Web|anthropic-ai/i, name: 'ClaudeBot', vendor: 'Anthropic', purpose: 'Model Training & Citations' },
  { pattern: /Google-Extended/i, name: 'Google-Extended', vendor: 'Google AI', purpose: 'Gemini Model Training' },
  { pattern: /GoogleOther/i, name: 'GoogleOther', vendor: 'Google AI', purpose: 'AI Web Indexing' },
  { pattern: /Meta-ExternalAgent|Meta-ExternalFetcher/i, name: 'Meta AI', vendor: 'Meta', purpose: 'Live Search Citations' },
  { pattern: /Applebot-Extended/i, name: 'Apple Intelligence', vendor: 'Apple', purpose: 'Apple Intelligence Training' },
  { pattern: /Bytespider/i, name: 'Bytespider', vendor: 'ByteDance', purpose: 'AI Indexing & Retrieval' },
  { pattern: /cohere-ai/i, name: 'Cohere AI', vendor: 'Cohere', purpose: 'LLM Training' },
  { pattern: /MistralAI/i, name: 'Mistral AI', vendor: 'Mistral', purpose: 'LLM Crawling' },
  { pattern: /Diffbot/i, name: 'Diffbot', vendor: 'Diffbot', purpose: 'Knowledge Graph Extraction' },
  { pattern: /DuckAssistBot/i, name: 'DuckAssistBot', vendor: 'DuckDuckGo', purpose: 'Live Search Citations' },
  { pattern: /YouBot/i, name: 'YouBot', vendor: 'You.com', purpose: 'Live Search Citations' },
  { pattern: /CCBot/i, name: 'CCBot (Common Crawl)', vendor: 'Common Crawl', purpose: 'Foundation Model Training' },
  { pattern: /Amazonbot/i, name: 'Amazonbot', vendor: 'Amazon', purpose: 'Alexa & Titan AI Training' },
];

function detectAiCrawler(ua = '') {
  if (!ua) return null;
  for (const crawler of AI_CRAWLER_DEFINITIONS) {
    if (crawler.pattern.test(ua)) return crawler;
  }
  return null;
}

const TRANSPARENT_GIF_BUFFER = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

function extractDomain(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const clean = raw.trim().toLowerCase();
  try {
    const withScheme = /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
    const hostname = new URL(withScheme).hostname;
    return hostname.replace(/^www\./, '').replace(/:\d+$/, '');
  } catch {
    return clean.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].split(':')[0];
  }
}

function isDomainAuthorized(incomingDomain, projectDomain) {
  if (!incomingDomain || !projectDomain) return true;
  const inc = extractDomain(incomingDomain);
  const proj = extractDomain(projectDomain);

  if (!inc || !proj) return true;

  // 1. Exact match (e.g. example.com === example.com)
  if (inc === proj) return true;

  // 2. Subdomain match (e.g. app.example.com, blog.example.com for example.com)
  if (inc.endsWith('.' + proj)) return true;

  // 3. Localhost and local developer testing
  if (inc === 'localhost' || inc === '127.0.0.1' || inc === '0.0.0.0') return true;

  // 4. SaaS platform host for onboarding verification & preview pings
  if (inc === 'gurukalyan.vercel.app' || inc.endsWith('.vercel.app') || inc.includes('datopin.com') || inc.includes('databoard.in') || inc.includes('trafficlume.com')) {
    return true;
  }

  return false;
}

const KNOWN_PROJECT_DOMAINS = {};

function parseUserAgent(ua = '') {
  const agent = String(ua || '');
  let browser = 'Other';
  if (/edg\//i.test(agent)) browser = 'Edge';
  else if (/opr\/|opera/i.test(agent)) browser = 'Opera';
  else if (/chrome|crios/i.test(agent)) browser = 'Chrome';
  else if (/firefox|fxios/i.test(agent)) browser = 'Firefox';
  else if (/safari/i.test(agent)) browser = 'Safari';

  let os = 'Other';
  if (/windows/i.test(agent)) os = 'Windows';
  else if (/iphone|ipad|ipod/i.test(agent)) os = 'iOS';
  else if (/android/i.test(agent)) os = 'Android';
  else if (/mac os x|macintosh/i.test(agent)) os = 'macOS';
  else if (/linux|x11/i.test(agent)) os = 'Linux';

  const device = /ipad|tablet/i.test(agent) ? 'Tablet' : /mobile|phone/i.test(agent) ? 'Mobile' : 'Desktop';
  return { device, browser, os };
}

function classifyChannel(referrer, medium, source) {
  const result = classifyAttribution({ referrerDomain: referrer, utmSource: source, utmMedium: medium });
  return result.channel;
}


// Asynchronous Cloudflare D1 Storage & Telegram Notifications (Non-blocking)
async function handleIntegrations(projectKey, expectedDomain, eventRows, aiCrawler) {
  try {
    const domain = expectedDomain || projectKey;

    // A. Cloudflare D1 BYOC Storage
    try {
      const cf = await getCloudflareConfig(projectKey);
      if (cf?.enabled && cf?.account_id && cf?.database_id && cf?.api_token) {
        for (const row of eventRows) {
          const sql = `
            INSERT INTO events (
              id, project_id, type, name, path, url, referrer, referrer_domain, 
              channel, visitor_id, session_id, timestamp, device, browser, os, country, revenue, properties
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;
          const params = [
            'evt_' + Math.random().toString(36).slice(2, 10),
            row.project_id,
            row.type,
            row.name || null,
            row.path || '/',
            row.url || null,
            row.referrer || null,
            row.referrer_domain || null,
            row.channel || 'Direct',
            row.visitor_id,
            row.session_id,
            row.timestamp,
            row.device || null,
            row.browser || null,
            row.os || null,
            row.country || null,
            row.revenue || null,
            JSON.stringify(row.properties || {}),
          ];
          executeD1Query(cf.account_id, cf.database_id, cf.api_token, sql, params).catch(() => {});
        }
      }
    } catch (cfErr) {
      console.warn('[Cloudflare D1 Dispatch Warning]:', cfErr.message);
    }

    // B. Telegram Alerts Dispatch
    try {
      const tg = await getTelegramConfig(projectKey);
      if (tg?.bot_token && tg?.chat_id) {
        // 1. Goal Conversion & Revenue
        if (tg.alert_conversions) {
          const conv = eventRows.find((r) =>
            (typeof r.revenue === 'number' && r.revenue > 0) ||
            (r.type === 'event' && r.name && !['pageview', 'scroll_depth', 'engaged_time', 'ai_crawler'].includes(r.name))
          );
          if (conv) {
            const revStr = conv.revenue ? ` (${conv.revenue})` : '';
            const msg = `
💰 <b>Goal Conversion Achieved!</b>
━━━━━━━━━━━━━━━━━━━━
<b>Project:</b> <code>${domain}</code>
<b>Goal:</b> <b>${conv.name || 'Conversion'}</b>${revStr}
<b>Source:</b> ${conv.referrer_domain || conv.channel || 'Direct'}
<b>Country:</b> ${conv.country || 'Global'}
<b>Page:</b> ${conv.path || '/'}
<b>Time:</b> ${new Date().toLocaleTimeString()}
            `.trim();
            sendTelegramMessage(tg.bot_token, tg.chat_id, msg).catch(() => {});
          }
        }

        // 2. AI Crawler / GEO Citation
        if (tg.alert_ai_crawlers && aiCrawler) {
          const msg = `
🤖 <b>AI Citation & GEO Alert</b>
━━━━━━━━━━━━━━━━━━━━
<b>Project:</b> <code>${domain}</code>
<b>Engine:</b> <b>${aiCrawler.name}</b> (${aiCrawler.vendor})
<b>Purpose:</b> ${aiCrawler.purpose}
<b>Crawled Page:</b> ${eventRows[0]?.path || '/'}
<b>Time:</b> ${new Date().toLocaleTimeString()}
          `.trim();
          sendTelegramMessage(tg.bot_token, tg.chat_id, msg).catch(() => {});
        }

        // 3. Traffic Spike Detection
        if (tg.alert_spikes && !aiCrawler) {
          const threshold = Number(tg.spike_threshold) || 20;
          const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
          const { count } = await supabase
            .from('events')
            .select('*', { count: 'exact', head: true })
            .eq('project_id', projectKey)
            .gte('timestamp', fiveMinAgo);

          if (count && count >= threshold) {
            const spikeMsg = `
🔥 <b>Traffic Spike Detected!</b>
━━━━━━━━━━━━━━━━━━━━
<b>Project:</b> <code>${domain}</code>
<b>Active Visitors:</b> <b>${count} concurrent</b>
<b>Threshold:</b> > ${threshold}
<b>Top Page:</b> ${eventRows[0]?.path || '/'}
<b>Time:</b> ${new Date().toLocaleTimeString()}
            `.trim();
            sendTelegramMessage(tg.bot_token, tg.chat_id, spikeMsg).catch(() => {});
          }
        }
      }
    } catch (tgErr) {
      console.warn('[Telegram Dispatch Warning]:', tgErr.message);
    }
  } catch {}
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Content-Type'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const isGet = req.method === 'GET';
  if (req.method !== 'POST' && !isGet) {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate Limiting Protection (Anti-DDoS / Anti-Loop)
  const clientIp =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    '';
  if (isRateLimited(clientIp)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Please throttle requests.' });
  }

  // Bot & Crawler Filtering vs AI Crawler Classification (GEO)
  const userAgent = req.headers['x-simulated-ua'] || req.headers['user-agent'] || '';
  const aiCrawler = detectAiCrawler(userAgent);

  // Filter out generic scraper/bot spam while capturing legitimate AI LLM agents
  if (!aiCrawler && BOT_REGEX.test(userAgent)) {
    // Asynchronous Cloudflare D1 & Telegram Dispatch (Non-blocking)
    handleIntegrations(resolvedProjectKey, expectedDomain, eventRows, aiCrawler).catch(() => {});

    if (isGet) {
      res.setHeader('Content-Type', 'image/gif');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      return res.status(200).send(TRANSPARENT_GIF_BUFFER);
    }
    return res.status(200).json({ ok: true, ignored: 'bot_traffic' });
  }

  try {
    let rawPid, events;
    let body = req.body;

    if (isGet) {
      // 1-pixel image beacon: /api/track?pid=...&p=/docs
      rawPid = req.query?.pid || req.query?.project_id || req.query?.site;
      const path = req.query?.p || req.query?.path || '/';
      const ref = req.headers.referer || req.query?.r || null;
      if (!rawPid) {
        res.setHeader('Content-Type', 'image/gif');
        return res.status(200).send(TRANSPARENT_GIF_BUFFER);
      }
      events = [
        {
          t: aiCrawler ? 'event' : 'pageview',
          n: aiCrawler ? 'ai_crawler' : null,
          p: path,
          r: ref,
          vid: 'bot_' + Math.random().toString(36).slice(2, 10),
          sid: 'bot_sess_' + Math.random().toString(36).slice(2, 10),
        },
      ];
    } else {
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch {
          return res.status(400).json({ error: 'Invalid JSON' });
        }
      }

      rawPid = body?.pid || body?.project_id || body?.site;
      let rawEvents = Array.isArray(body?.events) ? body.events : [];
      
      // Auto-wrap flat single-event payloads (e.g. { pid: '...', path: '/pricing' })
      if (!rawEvents.length && (body?.path || body?.p || body?.name || body?.event || body?.pid || body?.project_id)) {
        rawEvents = [
          {
            t: body?.type || (aiCrawler ? 'event' : (body?.event || body?.name ? 'event' : 'pageview')),
            n: body?.name || body?.event || (aiCrawler ? 'ai_crawler' : null),
            p: body?.path || body?.p || '/',
            r: body?.referrer || body?.r || null,
            u: body?.url || body?.u || null,
            vid: body?.vid || body?.visitor_id || 'anon_' + Math.random().toString(36).slice(2, 10),
            sid: body?.sid || body?.session_id || 'sess_' + Math.random().toString(36).slice(2, 10),
            props: body?.properties || body?.props || undefined,
            traits: body?.traits || undefined,
            ti: body?.timestamp || body?.ti || new Date().toISOString()
          }
        ];
      }

      if (!rawPid || !rawEvents.length) {
        return res.status(400).json({ error: 'Missing pid or events' });
      }
      // Limit batch to 30 events per request
      events = rawEvents.slice(0, 30);
    }

    const pid = String(rawPid).trim();
    const cleanDomain = pid.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');

    // Hardened key aliases for seamless migration across project recreations
    const KEY_ALIASES = {};

    // Resolve project Key
    let resolvedProjectKey = KEY_ALIASES[pid] || pid;
    let projectId = null;
    let project = null;

    // Project keys resolved dynamically from projects table

    try {
      const { data } = await supabase
        .from('projects')
        .select('id, project_id, domain, status')
        .or(`project_id.eq.${pid},domain.eq.${cleanDomain}`)
        .maybeSingle();
      if (data) project = data;

      // Fallback: If pid was an old/deleted project key, attempt resolution via the website domain from the event URL or headers
      if (!project) {
        const sampleUrl = events[0]?.u || req.headers.origin || req.headers.referer || body?.site;
        if (sampleUrl) {
          try {
            const urlObj = sampleUrl.startsWith('http') ? new URL(sampleUrl) : new URL(`https://${sampleUrl}`);
            const hostDomain = urlObj.hostname.replace(/^www\./, '').toLowerCase();
            if (hostDomain && hostDomain.includes('.')) {
              const { data: fallbackProject } = await supabase
                .from('projects')
                .select('id, project_id, domain, status')
                .eq('domain', hostDomain)
                .maybeSingle();
              if (fallbackProject) {
                project = fallbackProject;
              }
            }
          } catch {
            // URL parse error ignored
          }
        }
      }

      if (project) {
        resolvedProjectKey = project.project_id;
        projectId = project.id;
        if (project.project_id && project.domain) {
          KNOWN_PROJECT_DOMAINS[project.project_id] = project.domain;
        }

        if (project.status !== 'verified') {
          await supabase
            .from('projects')
            .update({ status: 'verified', verified_at: new Date().toISOString() })
            .eq('id', project.id);
        }
      }
    } catch (lookupErr) {
      console.warn('[Project lookup warn]:', lookupErr.message);
    }

    // Domain Whitelist Security Enforcement (P1 Protection)
    const expectedDomain =
      project?.domain ||
      KNOWN_PROJECT_DOMAINS[resolvedProjectKey] ||
      KNOWN_PROJECT_DOMAINS[pid] ||
      (cleanDomain.includes('.') ? cleanDomain : null);

    const incomingUrl = events[0]?.u || req.headers.origin || req.headers.referer || body?.site || '';
    const incomingDomain = extractDomain(incomingUrl);

    if (expectedDomain && incomingDomain) {
      if (!isDomainAuthorized(incomingDomain, expectedDomain)) {
        console.warn(`[Track 403 Forbidden]: Unauthorized origin "${incomingDomain}" attempted to send hits to project "${expectedDomain}" (${resolvedProjectKey})`);
        return res.status(403).json({
          error: 'Forbidden: Origin domain not authorized for this project.',
          domain: incomingDomain,
          authorized_domain: expectedDomain,
        });
      }
    }

    const { device, browser, os } = parseUserAgent(req.headers['user-agent']);
    const headerCountry =
      req.headers['x-vercel-ip-country'] ||
      req.headers['cf-ipcountry'] ||
      req.headers['x-country-code'] ||
      req.headers['x-real-ip-country'] ||
      null;
    const region = req.headers['x-vercel-ip-country-region'] || null;

    const eventRows = [];
    const sessionsMap = new Map();
    const visitorDaysMap = new Map();

    for (const hit of events) {
      const type = aiCrawler ? 'event' : (hit.t === 'identify' || hit.t === 'event' ? 'event' : 'pageview');
      const eventName = aiCrawler ? 'ai_crawler' : (hit.t === 'identify' ? 'identify' : (hit.n || null));
      const timestamp = hit.ti ? new Date(hit.ti).toISOString() : new Date().toISOString();
      const path = hit.p || '/';
      const url = hit.u || null;
      const rawCountry = hit.country || hit.geo?.country || headerCountry || null;
      const country = rawCountry && rawCountry !== 'XX' ? String(rawCountry).trim().toUpperCase() : null;
      const referrer = hit.r || null;
      let referrerDomain = null;
      if (referrer) {
        try {
          referrerDomain = new URL(referrer).hostname.replace(/^www\./, '');
        } catch {
          referrerDomain = null;
        }
      }

      const attr = classifyAttribution({
        referrerDomain,
        utmSource: hit.utm?.source,
        utmMedium: hit.utm?.medium,
        ref: hit.ref || hit.utm?.source,
      });
      if (!referrerDomain && attr.domain) {
        referrerDomain = attr.domain;
      }
      const channel = attr.channel;
      const rowChannel = aiCrawler ? 'AI Search / GEO' : channel;
      const rowDevice = aiCrawler ? 'Server / AI Bot' : device;
      const rowBrowser = aiCrawler ? aiCrawler.name : browser;
      const rowOs = aiCrawler ? aiCrawler.vendor : os;
      const dayStr = timestamp.slice(0, 10);

      // Extract user identity metadata from identify() or auto-tagged uid
      const userId = hit.uid || hit.user_id || hit.traits?.user_id || hit.props?.user_id || null;
      const eventProps = {
        ...(hit.props || {}),
        ...(hit.traits || {}),
        ...(aiCrawler ? {
          is_ai: true,
          vendor: aiCrawler.vendor,
          purpose: aiCrawler.purpose,
          bot_name: aiCrawler.name,
          user_agent: String(userAgent).slice(0, 250),
        } : {}),
      };
      if (userId) {
        eventProps.user_id = String(userId).slice(0, 100);
      }
      if (hit.traits?.email || hit.props?.email) {
        eventProps.email = String(hit.traits?.email || hit.props?.email).slice(0, 120);
      }
      if (hit.traits?.name || hit.props?.name) {
        eventProps.name = String(hit.traits?.name || hit.props?.name).slice(0, 100);
      }
      if (hit.traits?.plan || hit.props?.plan) {
        eventProps.plan = String(hit.traits?.plan || hit.props?.plan).slice(0, 60);
      }

      eventRows.push({
        project_id: resolvedProjectKey,
        type,
        name: eventName,
        url,
        path,
        referrer,
        referrer_domain: referrerDomain,
        channel: rowChannel,
        visitor_id: hit.vid || 'anon_' + Math.random().toString(36).slice(2, 10),
        session_id: hit.sid || 'sess_' + Math.random().toString(36).slice(2, 10),
        timestamp,
        device: rowDevice,
        browser: rowBrowser,
        os: rowOs,
        country,
        region,
        utm_source: hit.utm?.source || null,
        utm_medium: hit.utm?.medium || null,
        utm_campaign: hit.utm?.campaign || null,
        screen_width: hit.sw || null,
        target: hit.tg || null,
        scroll_depth: hit.sd || null,
        engaged_seconds: hit.eg || null,
        properties: eventProps,
        revenue: typeof hit.rev === 'number' ? hit.rev : (hit.props && typeof hit.props.revenue === 'number' ? hit.props.revenue : null),
      });

      if (!aiCrawler && hit.sid) {
        sessionsMap.set(hit.sid, {
          project_id: resolvedProjectKey,
          session_id: hit.sid,
          visitor_id: hit.vid,
          started_at: timestamp,
          last_seen_at: timestamp,
          entry_path: path,
          referrer_domain: referrerDomain,
          channel,
          device,
          browser,
          os,
          country,
          region,
        });
      }

      if (!aiCrawler && hit.vid) {
        const vKey = `${resolvedProjectKey}_${hit.vid}_${dayStr}`;
        visitorDaysMap.set(vKey, {
          project_id: resolvedProjectKey,
          visitor_id: hit.vid,
          date: dayStr,
          first_seen_at: timestamp,
        });
      }
    }

    // 1. Insert events (primary data for Realtime and Analytics)
    if (eventRows.length > 0) {
      const { error: insertErr } = await supabase.from('events').insert(eventRows);
      if (insertErr) {
        console.error('[Events Insert Error]:', insertErr);
        return res.status(500).json({ error: insertErr.message });
      }
    }

        // 2. Insert or update sessions (calculating real duration and bounce status)
    for (const session of sessionsMap.values()) {
      try {
        const { data: existingSession } = await supabase
          .from('sessions')
          .select('id, started_at, pageview_count, event_count')
          .eq('session_id', session.session_id)
          .maybeSingle();

        if (existingSession) {
          const startTime = new Date(existingSession.started_at).getTime();
          const currentTime = new Date(session.last_seen_at).getTime();
          const durationSeconds = Math.max(0, Math.round((currentTime - startTime) / 1000));

          await supabase
            .from('sessions')
            .update({
              last_seen_at: session.last_seen_at,
              exit_path: session.entry_path,
              duration_seconds: durationSeconds,
              is_bounce: false,
              pageview_count: (existingSession.pageview_count || 1) + 1,
            })
            .eq('id', existingSession.id);
        } else {
          await supabase.from('sessions').insert({
            ...session,
            duration_seconds: 0,
            is_bounce: true,
            pageview_count: 1,
          });
        }
      } catch (sErr) {
        // Ignore session upsert errors to ensure event collection continues uninterrupted
      }
    }

    // 3. Upsert visitor days
    for (const vd of visitorDaysMap.values()) {
      try {
        await supabase.from('visitor_days').upsert(vd, { onConflict: 'project_id,visitor_id,date' });
      } catch (vErr) {
        // ignore unique constraint collisions
      }
    }

    if (isGet) {
      res.setHeader('Content-Type', 'image/gif');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      return res.status(200).send(TRANSPARENT_GIF_BUFFER);
    }

    return res.status(200).json({
      ok: true,
      count: eventRows.length,
      project_id: resolvedProjectKey,
      is_ai_crawler: !!aiCrawler,
    });
  } catch (err) {
    console.error('[Track Handler Error]:', err);
    return res.status(500).json({ error: err.message });
  }
}
