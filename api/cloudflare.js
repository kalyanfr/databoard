import { createClient } from '@supabase/supabase-js';
import { getTelegramConfig, sendTelegramMessage } from './telegram.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://vhnldpotikynnyaantgt.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_gkrz-FNCgEuMmYW1Yltu6w_edVA0KaO';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export async function executeD1Query(accountId, databaseId, apiToken, sql, params = []) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId.trim()}/d1/database/${databaseId.trim()}/query`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken.trim()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql, params }),
  });

  const data = await res.json();
  if (!data.success) {
    const errorMsg = data.errors?.[0]?.message || 'Cloudflare D1 query failed';
    throw new Error(errorMsg);
  }
  return data.result?.[0] || {};
}

export async function getCloudflareConfig(key) {
  try {
    const { data } = await supabase
      .from('events')
      .select('properties')
      .eq('project_id', 'system_admin')
      .eq('name', `cloudflare_config_${key}`)
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.properties) {
      return data.properties;
    }
  } catch {}

  return {
    enabled: false,
    account_id: process.env.CLOUDFLARE_ACCOUNT_ID || '',
    database_id: process.env.CLOUDFLARE_D1_DATABASE_ID || '',
    api_token: process.env.CLOUDFLARE_API_TOKEN || '',
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

    // 1. Get Config
    if (action === 'get_config') {
      const config = await getCloudflareConfig(targetKey);
      return res.status(200).json({
        ok: true,
        config: {
          enabled: Boolean(config.enabled),
          account_id: config.account_id || '',
          database_id: config.database_id || '',
          account_name: config.account_name || '',
          database_name: config.database_name || '',
          api_token_masked: config.api_token ? `${config.api_token.slice(0, 4)}••••••••${config.api_token.slice(-4)}` : '',
          has_token: Boolean(config.api_token),
        },
      });
    }

    // 2. Save Config (Manual Mode)
    if (action === 'save_config') {
      const current = await getCloudflareConfig(targetKey);
      const incoming = payload.config || {};

      const updated = {
        enabled: incoming.enabled !== undefined ? Boolean(incoming.enabled) : current.enabled,
        account_id: incoming.account_id !== undefined ? incoming.account_id.trim() : current.account_id,
        database_id: incoming.database_id !== undefined ? incoming.database_id.trim() : current.database_id,
        api_token: (incoming.api_token && !incoming.api_token.includes('••••')) ? incoming.api_token.trim() : current.api_token,
        account_name: incoming.account_name || current.account_name || '',
        database_name: incoming.database_name || current.database_name || '',
      };

      await supabase.from('events').insert({
        project_id: 'system_admin',
        type: 'event',
        name: `cloudflare_config_${targetKey}`,
        properties: updated,
        timestamp: new Date().toISOString(),
      });

      return res.status(200).json({ ok: true, message: 'Cloudflare D1 settings saved successfully!' });
    }

    // 3. 1-Step Auto Setup (Single Token Magic Flow)
    if (action === 'auto_setup') {
      const current = await getCloudflareConfig(targetKey);
      const apiToken = (payload.api_token && !payload.api_token.includes('••••'))
        ? payload.api_token.trim()
        : current.api_token;

      if (!apiToken) {
        return res.status(400).json({ error: 'Please enter your Cloudflare API Token.' });
      }

      // Step 1: Detect Account ID via /client/v4/accounts
      const accRes = await fetch('https://api.cloudflare.com/client/v4/accounts', {
        headers: { Authorization: `Bearer ${apiToken}` },
      });
      const accData = await accRes.json();
      if (!accData.success || !accData.result?.length) {
        const errMsg = accData.errors?.[0]?.message || 'Invalid Cloudflare API Token or permission denied.';
        throw new Error(errMsg);
      }

      const account = accData.result[0];
      const accountId = account.id;
      const accountName = account.name || 'Personal Account';

      // Step 2: Check if D1 database "databoard_analytics" (or "datopin_analytics") exists, or create it
      const dbListRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database`, {
        headers: { Authorization: `Bearer ${apiToken}` },
      });
      const dbListData = await dbListRes.json();
      let d1Database = dbListData.result?.find((db) => db.name === 'databoard_analytics' || db.name === 'datopin_analytics');

      if (!d1Database) {
        // Create it automatically
        const createDbRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'databoard_analytics' }),
        });
        const createDbData = await createDbRes.json();
        if (!createDbData.success) {
          throw new Error(createDbData.errors?.[0]?.message || 'Failed to create D1 database in Cloudflare account.');
        }
        d1Database = createDbData.result;
      }

      const databaseId = d1Database.uuid || d1Database.id;
      const databaseName = d1Database.name || 'databoard_analytics';

      // Step 3: Initialize Database Tables
      const schemaSql = `
        CREATE TABLE IF NOT EXISTS events (
          id TEXT PRIMARY KEY,
          project_id TEXT,
          type TEXT,
          name TEXT,
          path TEXT,
          url TEXT,
          referrer TEXT,
          referrer_domain TEXT,
          channel TEXT,
          visitor_id TEXT,
          session_id TEXT,
          timestamp TEXT,
          device TEXT,
          browser TEXT,
          os TEXT,
          country TEXT,
          revenue REAL,
          properties TEXT
        );

        CREATE TABLE IF NOT EXISTS sessions (
          session_id TEXT PRIMARY KEY,
          project_id TEXT,
          visitor_id TEXT,
          started_at TEXT,
          entry_path TEXT,
          referrer_domain TEXT,
          channel TEXT,
          device TEXT,
          browser TEXT,
          os TEXT,
          country TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_events_project_time ON events(project_id, timestamp);
      `;

      await executeD1Query(accountId, databaseId, apiToken, schemaSql);

      // Step 4: Save & Enable Configuration Automatically
      const updated = {
        enabled: true,
        account_id: accountId,
        database_id: databaseId,
        api_token: apiToken,
        account_name: accountName,
        database_name: databaseName,
      };

      await supabase.from('events').insert({
        project_id: 'system_admin',
        type: 'event',
        name: `cloudflare_config_${targetKey}`,
        properties: updated,
        timestamp: new Date().toISOString(),
      });

      return res.status(200).json({
        ok: true,
        account_id: accountId,
        account_name: accountName,
        database_id: databaseId,
        database_name: databaseName,
        message: `Connected! Auto-created D1 database "${databaseName}" on Cloudflare account "${accountName}". Tracking data is now 100% stored in your own Cloudflare account.`,
      });
    }

    // 4. Test Connection
    if (action === 'test_connection') {
      const current = await getCloudflareConfig(targetKey);
      const accountId = payload.account_id || current.account_id;
      const databaseId = payload.database_id || current.database_id;
      const apiToken = (payload.api_token && !payload.api_token.includes('••••')) ? payload.api_token : current.api_token;

      if (!accountId || !databaseId || !apiToken) {
        return res.status(400).json({ error: 'Account ID, Database ID, and API Token are required.' });
      }

      // Check database info
      const url = `https://api.cloudflare.com/client/v4/accounts/${accountId.trim()}/d1/database/${databaseId.trim()}`;
      const r = await fetch(url, {
        headers: { Authorization: `Bearer ${apiToken.trim()}` },
      });
      const data = await r.json();

      if (!data.success) {
        throw new Error(data.errors?.[0]?.message || 'Failed to authenticate with Cloudflare D1');
      }

      // Test SELECT 1
      await executeD1Query(accountId, databaseId, apiToken, 'SELECT 1 as connected;');

      return res.status(200).json({
        ok: true,
        message: `Successfully connected to Cloudflare D1 database "${data.result?.name || databaseId}"!`,
        database_name: data.result?.name,
      });
    }

    // 5. Initialize Database Schema
    if (action === 'init_schema') {
      const current = await getCloudflareConfig(targetKey);
      const accountId = payload.account_id || current.account_id;
      const databaseId = payload.database_id || current.database_id;
      const apiToken = (payload.api_token && !payload.api_token.includes('••••')) ? payload.api_token : current.api_token;

      if (!accountId || !databaseId || !apiToken) {
        return res.status(400).json({ error: 'Cloudflare credentials missing.' });
      }

      const createEventsTable = `
        CREATE TABLE IF NOT EXISTS events (
          id TEXT PRIMARY KEY,
          project_id TEXT,
          type TEXT,
          name TEXT,
          path TEXT,
          url TEXT,
          referrer TEXT,
          referrer_domain TEXT,
          channel TEXT,
          visitor_id TEXT,
          session_id TEXT,
          timestamp TEXT,
          device TEXT,
          browser TEXT,
          os TEXT,
          country TEXT,
          revenue REAL,
          properties TEXT
        );
      `;

      const createSessionsTable = `
        CREATE TABLE IF NOT EXISTS sessions (
          session_id TEXT PRIMARY KEY,
          project_id TEXT,
          visitor_id TEXT,
          started_at TEXT,
          entry_path TEXT,
          referrer_domain TEXT,
          channel TEXT,
          device TEXT,
          browser TEXT,
          os TEXT,
          country TEXT
        );
      `;

      const createIndex = `
        CREATE INDEX IF NOT EXISTS idx_events_project_time ON events(project_id, timestamp);
      `;

      await executeD1Query(accountId, databaseId, apiToken, createEventsTable);
      await executeD1Query(accountId, databaseId, apiToken, createSessionsTable);
      await executeD1Query(accountId, databaseId, apiToken, createIndex);

      return res.status(200).json({
        ok: true,
        message: 'Cloudflare D1 tables (events, sessions) initialized successfully! Your analytics can now write directly to your personal Cloudflare database.',
      });
    }

    // 6. Check BYOC Access Status for a User
    if (action === 'check_byoc_status') {
      const email = String(payload.email || req.query.email || '').trim().toLowerCase();
      const isAdminUser = email === 'gurukalyanreddyd@gmail.com';

      if (isAdminUser) {
        return res.status(200).json({ ok: true, status: 'approved', is_admin: true });
      }

      if (!email) {
        return res.status(200).json({ ok: true, status: 'none', is_admin: false });
      }

      const { data: logs } = await supabase
        .from('events')
        .select('properties, timestamp')
        .eq('project_id', 'system_admin')
        .eq('name', 'byoc_request')
        .order('timestamp', { ascending: false });

      const userLog = (logs || []).find((l) => (l.properties?.email || '').toLowerCase() === email);

      const status = userLog?.properties?.status || 'none';
      return res.status(200).json({
        ok: true,
        status, // 'approved', 'pending', 'revoked', 'none'
        requested_at: userLog?.properties?.requested_at || userLog?.timestamp || null,
        is_admin: false,
      });
    }

    // 7. User Submits Request for BYOC Access
    if (action === 'request_byoc') {
      const email = String(payload.email || '').trim().toLowerCase();
      if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'Valid email address is required.' });
      }

      const requestedAt = new Date().toISOString();

      await supabase.from('events').insert({
        project_id: 'system_admin',
        type: 'event',
        name: 'byoc_request',
        properties: {
          email,
          user_id: payload.user_id || null,
          project_id: payload.project_id || targetKey,
          status: 'pending',
          requested_at: requestedAt,
        },
        timestamp: requestedAt,
      });

      // Notify Founder on Telegram
      try {
        const tg = await getTelegramConfig('default');
        if (tg?.bot_token && tg?.chat_id) {
          const msg = `
📢 <b>New Cloudflare BYOC Access Request!</b>
━━━━━━━━━━━━━━━━━━━━
<b>User Email:</b> <code>${email}</code>
<b>Project:</b> <code>${payload.project_id || 'Personal'}</code>
<b>Time:</b> ${new Date().toLocaleTimeString()}

<i>Approve with 1 click in your Admin Panel:</i>
https://gurukalyan.vercel.app/admin/marketing
          `.trim();
          sendTelegramMessage(tg.bot_token, tg.chat_id, msg).catch(() => {});
        }
      } catch {}

      return res.status(200).json({
        ok: true,
        status: 'pending',
        message: 'Request submitted! Guru Kalyan will review and activate Cloudflare BYOC access for your email shortly.',
      });
    }

    // 8. Admin: List All BYOC Requests
    if (action === 'admin_get_byoc_requests') {
      const { data: logs = [] } = await supabase
        .from('events')
        .select('*')
        .eq('project_id', 'system_admin')
        .eq('name', 'byoc_request')
        .order('timestamp', { ascending: false })
        .limit(200);

      const emailMap = new Map();
      for (const l of logs) {
        const em = (l.properties?.email || '').toLowerCase().trim();
        if (em && !emailMap.has(em)) {
          emailMap.set(em, {
            id: l.id,
            email: l.properties.email,
            status: l.properties.status || 'pending',
            project_id: l.properties.project_id || '',
            requested_at: l.properties.requested_at || l.timestamp,
            updated_at: l.properties.updated_at || l.timestamp,
          });
        }
      }

      return res.status(200).json({
        ok: true,
        requests: Array.from(emailMap.values()),
      });
    }

    // 9. Admin: Approve or Revoke Access for an Email ID
    if (action === 'admin_set_byoc_access') {
      const email = String(payload.email || '').trim().toLowerCase();
      const newStatus = payload.status === 'revoked' ? 'revoked' : 'approved';

      if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'Valid user email is required.' });
      }

      const updatedAt = new Date().toISOString();

      await supabase.from('events').insert({
        project_id: 'system_admin',
        type: 'event',
        name: 'byoc_request',
        properties: {
          email,
          status: newStatus,
          updated_at: updatedAt,
          approved_by: 'admin',
        },
        timestamp: updatedAt,
      });

      return res.status(200).json({
        ok: true,
        status: newStatus,
        message: `Cloudflare BYOC access successfully ${newStatus} for ${email}!`,
      });
    }

    return res.status(400).json({ error: `Unknown action "${action}"` });
  } catch (err) {
    console.error('[Cloudflare Function Error]:', err);
    return res.status(500).json({ error: err.message || 'Cloudflare Error' });
  }
}
