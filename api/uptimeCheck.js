import { createClient } from '@supabase/supabase-js';
import { getTelegramConfig, sendTelegramMessage } from './telegram.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://vhnldpotikynnyaantgt.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_gkrz-FNCgEuMmYW1Yltu6w_edVA0KaO';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

function normalizeUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(withScheme).href;
  } catch {
    return withScheme;
  }
}

async function probeUrl(targetUrl) {
  const url = normalizeUrl(targetUrl);
  if (!url) {
    return { ok: false, status: 0, ms: 0, error: 'Invalid URL' };
  }

  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);

    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 DataBoard-Uptime/1.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Cache-Control': 'no-cache',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const duration = Date.now() - start;
    const status = res.status;
    // Standard uptime assessment:
    // 2xx and 3xx are fully up.
    // 401 (Auth required), 403 (Forbidden), 405 (Method Not Allowed) mean the web server is alive and responding.
    // 404 (Not Found), 5xx (Server Error), or timeouts mean the site/endpoint is down.
    const isUp = (status >= 200 && status < 400) || status === 401 || status === 403 || status === 405;
    const errorMsg = isUp ? null : (status === 404 ? 'HTTP 404 Not Found' : `HTTP ${status}`);

    return {
      ok: isUp,
      status,
      ms: duration,
      error: errorMsg,
    };
  } catch (err) {
    const duration = Date.now() - start;
    let message = err?.message || 'Connection failed';
    if (err?.name === 'AbortError') {
      message = 'Request timed out (9s)';
    } else if (/enotfound|getaddrinfo/i.test(message)) {
      message = 'Domain name could not be resolved (DNS)';
    } else if (/econnrefused/i.test(message)) {
      message = 'Connection refused by server';
    }
    return {
      ok: false,
      status: 0,
      ms: duration,
      error: message,
    };
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const authHeader = req.headers.authorization;
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      global: {
        headers: authHeader ? { Authorization: authHeader } : {},
      },
    });

    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    const query = req.query || {};

    const singleUrl = body.url || body.probe_url || query.url || query.probe_url;
    const monitorId = body.monitor_id || body.id || query.monitor_id || query.id;
    const monitorsPayload = Array.isArray(body.monitors) ? body.monitors : null;

    // 1. Direct URL probe mode (e.g. testing an arbitrary link)
    if (singleUrl && !monitorId) {
      const result = await probeUrl(singleUrl);
      return res.status(200).json({
        checked: 1,
        ok: result.ok,
        status: result.status,
        ms: result.ms,
        error: result.error,
        results: [{ url: singleUrl, ...result }],
      });
    }

    // 2. Resolve monitors to check
    let targetMonitors = [];

    if (monitorsPayload && monitorsPayload.length > 0) {
      targetMonitors = monitorsPayload;
    } else if (monitorId) {
      // Find monitor by ID
      const { data: mData } = await supabase.from('monitors').select('*').eq('id', monitorId).maybeSingle();
      if (mData) {
        targetMonitors = [mData];
      } else if (singleUrl || body.name) {
        targetMonitors = [{ id: monitorId, name: body.name || 'Monitor', url: singleUrl || body.url }];
      }
    } else {
      // Check all active monitors
      const { data: allMonitors } = await supabase.from('monitors').select('*').neq('status', 'paused').limit(50);
      if (allMonitors && allMonitors.length > 0) {
        targetMonitors = allMonitors;
      }
    }

    if (!targetMonitors.length && singleUrl) {
      targetMonitors = [{ id: monitorId || 'temp', name: body.name || 'Website', url: singleUrl }];
    }

    if (!targetMonitors.length) {
      return res.status(200).json({ checked: 0, results: [], message: 'No monitors found to check' });
    }

    // 3. Probe monitors in parallel
    const checkedAt = new Date().toISOString();
    const probeResults = await Promise.all(
      targetMonitors.map(async (m) => {
        const probe = await probeUrl(m.url);
        return {
          monitor: m,
          result: probe,
        };
      })
    );

    // 4. Update Supabase records
    const results = [];
    for (const { monitor, result } of probeResults) {
      const isUp = result.ok;
      const statusCode = result.status;
      const duration = result.ms;
      const errorMsg = result.error;

      if (monitor.id && monitor.id !== 'temp') {
        const failures = isUp ? 0 : (monitor.consecutive_failures || 0) + 1;
        
        // Trigger Telegram alert on status change or downtime
        if (monitor.status && monitor.status !== (isUp ? 'up' : 'down')) {
          const tgKey = monitor.project_id || monitor.created_by_id || 'default';
          getTelegramConfig(tgKey).then((tg) => {
            if (tg?.bot_token && tg?.chat_id && tg.alert_uptime) {
              const msg = `
${isUp ? '✅' : '🔴'} <b>Uptime Alert: ${isUp ? 'Site Recovered' : 'Site Down!'}</b>
━━━━━━━━━━━━━━━━━━━━
<b>Monitor:</b> ${monitor.name || monitor.url}
<b>URL:</b> <code>${monitor.url}</code>
<b>Status Code:</b> ${statusCode || 0}
${errorMsg ? `<b>Error:</b> ${errorMsg}\n` : ''}<b>Time:</b> ${new Date().toLocaleTimeString()}
              `.trim();
              sendTelegramMessage(tg.bot_token, tg.chat_id, msg).catch(() => {});
            }
          }).catch(() => {});
        }

        // Update monitor status
        await supabase
          .from('monitors')
          .update({
            status: isUp ? 'up' : 'down',
            last_checked_at: checkedAt,
            last_status_code: statusCode,
            last_response_ms: duration,
            consecutive_failures: failures,
          })
          .eq('id', monitor.id)
          .catch(() => {});

        // Insert check record
        await supabase
          .from('monitor_checks')
          .insert({
            monitor_id: monitor.id,
            checked_at: checkedAt,
            status: isUp ? 'up' : 'down',
            status_code: statusCode,
            response_ms: duration,
            error: errorMsg,
          })
          .catch(() => {});
      }

      results.push({
        id: monitor.id,
        name: monitor.name || monitor.url,
        url: monitor.url,
        ok: isUp,
        status: statusCode,
        ms: duration,
        error: errorMsg,
      });
    }

    return res.status(200).json({
      checked: results.length,
      ok: results.every((r) => r.ok),
      results,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message, checked: 0, results: [] });
  }
}
