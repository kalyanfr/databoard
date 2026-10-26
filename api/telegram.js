import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://vhnldpotikynnyaantgt.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_gkrz-FNCgEuMmYW1Yltu6w_edVA0KaO';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Sliding window to prevent alert flooding (max 1 spike alert per 15 minutes per project)
const spikeCooldowns = new Map();

export async function sendTelegramMessage(botToken, chatId, htmlText) {
  if (!botToken || !chatId) {
    throw new Error('Telegram Bot Token and Chat ID are required.');
  }

  const endpoint = `https://api.telegram.org/bot${botToken.trim()}/sendMessage`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: String(chatId).trim(),
      text: htmlText,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });

  const data = await res.json();
  if (!data.ok) {
    throw new Error(data.description || 'Failed to deliver Telegram message.');
  }
  return data;
}

export async function getTelegramConfig(projectIdOrUserId) {
  try {
    const { data } = await supabase
      .from('events')
      .select('properties')
      .eq('project_id', 'system_admin')
      .eq('name', `telegram_config_${projectIdOrUserId}`)
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.properties) {
      return data.properties;
    }
  } catch {}

  return {
    bot_token: process.env.TELEGRAM_BOT_TOKEN || '',
    chat_id: process.env.TELEGRAM_CHAT_ID || '',
    alert_conversions: true,
    alert_spikes: true,
    alert_ai_crawlers: true,
    alert_uptime: true,
    spike_threshold: 20,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let payload = {};
    if (typeof req.body === 'string') {
      try { payload = JSON.parse(req.body); } catch { payload = {}; }
    } else if (req.body && typeof req.body === 'object') {
      payload = req.body;
    }

    const action = payload.action || req.query.action || 'get_config';
    const targetKey = payload.project_id || payload.user_id || 'default';

    // 1. Get Telegram Settings
    if (action === 'get_config') {
      const config = await getTelegramConfig(targetKey);
      return res.status(200).json({
        ok: true,
        config: {
          ...config,
          bot_token_masked: config.bot_token ? `${config.bot_token.slice(0, 5)}••••••••${config.bot_token.slice(-4)}` : '',
          has_token: Boolean(config.bot_token),
        },
      });
    }

    // 2. Save Telegram Settings
    if (action === 'save_config') {
      const current = await getTelegramConfig(targetKey);
      const incoming = payload.config || {};

      const updated = {
        bot_token: (incoming.bot_token && !incoming.bot_token.includes('••••')) ? incoming.bot_token.trim() : current.bot_token,
        chat_id: incoming.chat_id !== undefined ? String(incoming.chat_id).trim() : current.chat_id,
        alert_conversions: incoming.alert_conversions !== undefined ? Boolean(incoming.alert_conversions) : current.alert_conversions,
        alert_spikes: incoming.alert_spikes !== undefined ? Boolean(incoming.alert_spikes) : current.alert_spikes,
        alert_ai_crawlers: incoming.alert_ai_crawlers !== undefined ? Boolean(incoming.alert_ai_crawlers) : current.alert_ai_crawlers,
        alert_uptime: incoming.alert_uptime !== undefined ? Boolean(incoming.alert_uptime) : current.alert_uptime,
        spike_threshold: Number(incoming.spike_threshold) || 20,
      };

      await supabase.from('events').insert({
        project_id: 'system_admin',
        type: 'event',
        name: `telegram_config_${targetKey}`,
        properties: updated,
        timestamp: new Date().toISOString(),
      });

      return res.status(200).json({ ok: true, message: 'Telegram settings saved successfully!' });
    }

    // 3. Test Telegram Message
    if (action === 'test_message') {
      const current = await getTelegramConfig(targetKey);
      const botToken = (payload.bot_token && !payload.bot_token.includes('••••')) ? payload.bot_token.trim() : current.bot_token;
      const chatId = payload.chat_id ? String(payload.chat_id).trim() : current.chat_id;

      if (!botToken || !chatId) {
        return res.status(400).json({ error: 'Please provide both a Telegram Bot Token and Chat ID.' });
      }

      const domain = payload.domain || 'adstracker.in';
      const testMsg = `
🚀 <b>Data Board Telegram Alerts Connected!</b>
━━━━━━━━━━━━━━━━━━━━
<b>Status:</b> Active & Verified ✅
<b>Project:</b> <code>${domain}</code>
<b>Alerts:</b> Spikes · Conversions · AI Crawlers · Uptime
<b>Time:</b> ${new Date().toISOString()}

<i>You will now receive instant notifications right here whenever visitors convert, traffic spikes occur, or ChatGPT cites your site!</i>
      `.trim();

      await sendTelegramMessage(botToken, chatId, testMsg);

      return res.status(200).json({
        ok: true,
        message: 'Test alert delivered to Telegram successfully! Check your chat.',
      });
    }

    // 4. Send Real Alert (Internal Dispatcher)
    if (action === 'send_alert') {
      const config = await getTelegramConfig(targetKey);
      if (!config.bot_token || !config.chat_id) {
        return res.status(200).json({ ok: false, reason: 'Telegram not configured' });
      }

      const alertType = payload.type; // 'conversion', 'spike', 'ai_crawler', 'uptime'

      if (alertType === 'conversion' && !config.alert_conversions) {
        return res.status(200).json({ ok: false, skipped: true });
      }
      if (alertType === 'spike' && !config.alert_spikes) {
        return res.status(200).json({ ok: false, skipped: true });
      }
      if (alertType === 'ai_crawler' && !config.alert_ai_crawlers) {
        return res.status(200).json({ ok: false, skipped: true });
      }
      if (alertType === 'uptime' && !config.alert_uptime) {
        return res.status(200).json({ ok: false, skipped: true });
      }

      // Check spike cooldown
      if (alertType === 'spike') {
        const lastSpike = spikeCooldowns.get(targetKey) || 0;
        const now = Date.now();
        if (now - lastSpike < 15 * 60 * 1000) {
          return res.status(200).json({ ok: false, reason: 'Spike alert in cooldown' });
        }
        spikeCooldowns.set(targetKey, now);
      }

      let message = '';
      const domain = payload.domain || 'your site';

      if (alertType === 'conversion') {
        const rev = payload.revenue ? ` ($${payload.revenue})` : '';
        message = `
💰 <b>Goal Conversion Achieved!</b>
━━━━━━━━━━━━━━━━━━━━
<b>Project:</b> <code>${domain}</code>
<b>Goal:</b> <b>${payload.goal_name || 'Conversion'}</b>${rev}
<b>Source:</b> ${payload.source || 'Direct'}
<b>Country:</b> ${payload.country ? `${payload.country}` : 'Global'}
<b>Page:</b> ${payload.path || '/'}
<b>Time:</b> ${new Date().toLocaleTimeString()}
        `.trim();
      } else if (alertType === 'spike') {
        message = `
🔥 <b>Traffic Spike Detected!</b>
━━━━━━━━━━━━━━━━━━━━
<b>Project:</b> <code>${domain}</code>
<b>Active Visitors:</b> <b>${payload.active_count} concurrent</b>
<b>Threshold:</b> > ${config.spike_threshold || 20}
<b>Top Page:</b> ${payload.path || '/'}
<b>Time:</b> ${new Date().toLocaleTimeString()}
        `.trim();
      } else if (alertType === 'ai_crawler') {
        message = `
🤖 <b>AI Citation & GEO Alert</b>
━━━━━━━━━━━━━━━━━━━━
<b>Project:</b> <code>${domain}</code>
<b>Engine:</b> <b>${payload.bot_name || 'AI Engine'}</b> (${payload.vendor || 'AI Search'})
<b>Purpose:</b> ${payload.purpose || 'Live Citation'}
<b>Crawled Page:</b> ${payload.path || '/'}
<b>Time:</b> ${new Date().toLocaleTimeString()}
        `.trim();
      } else if (alertType === 'uptime') {
        const isUp = payload.status === 'up';
        message = `
${isUp ? '✅' : '🔴'} <b>Uptime Alert: ${isUp ? 'Site Recovered' : 'Site Down!'}</b>
━━━━━━━━━━━━━━━━━━━━
<b>Target:</b> <code>${payload.url}</code>
<b>Status Code:</b> ${payload.status_code || 0}
${payload.error ? `<b>Error:</b> ${payload.error}\n` : ''}<b>Time:</b> ${new Date().toLocaleTimeString()}
        `.trim();
      }

      if (message) {
        await sendTelegramMessage(config.bot_token, config.chat_id, message);
      }

      return res.status(200).json({ ok: true, delivered: true });
    }

    return res.status(400).json({ error: `Unknown action "${action}"` });
  } catch (err) {
    console.error('[Telegram Function Error]:', err);
    return res.status(500).json({ error: err.message || 'Telegram Error' });
  }
}
