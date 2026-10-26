import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://vhnldpotikynnyaantgt.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_gkrz-FNCgEuMmYW1Yltu6w_edVA0KaO';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Verify an API key (dp_live_...) against active keys
 */
export async function verifyApiKey(rawKey) {
  if (!rawKey || typeof rawKey !== 'string' || !rawKey.startsWith('dp_live_')) {
    return { valid: false, error: 'Invalid API key format. Expected dp_live_...' };
  }

  const cleanKey = rawKey.trim();

  try {
    const { data: logs } = await supabase
      .from('events')
      .select('properties, timestamp')
      .eq('project_id', 'system_admin')
      .eq('name', 'api_key')
      .order('timestamp', { ascending: false });

    if (!logs || !logs.length) {
      return { valid: false, error: 'API key not found' };
    }

    // Find the latest record matching this key
    const matching = logs.find((l) => l.properties?.key === cleanKey);
    if (!matching) {
      return { valid: false, error: 'API key not found' };
    }

    if (matching.properties?.status === 'revoked') {
      return { valid: false, error: 'API key has been revoked' };
    }

    let userId = matching.properties?.user_id || null;
    const userEmail = matching.properties?.user_email || null;

    if (!userId && userEmail) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', userEmail.toLowerCase())
          .maybeSingle();
        if (profile?.id) {
          userId = profile.id;
        }
      } catch (err) {
        console.warn('[VerifyApiKey profile lookup warning]:', err.message);
      }
    }

    return {
      valid: true,
      user_id: userId,
      user_email: userEmail,
      name: matching.properties?.name || 'Default Key',
    };
  } catch (err) {
    console.error('[VerifyApiKey Error]:', err);
    return { valid: false, error: 'Failed to verify API key' };
  }
}

/**
 * Retrieve or automatically generate an API key for a user (used by OAuth flow)
 */
export async function createOrGetApiKeyForUser(email, userId, name = 'ChatGPT OAuth Integration') {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail) throw new Error('Email is required');

  const { data: logs = [] } = await supabase
    .from('events')
    .select('properties, timestamp')
    .eq('project_id', 'system_admin')
    .eq('name', 'api_key')
    .order('timestamp', { ascending: false });

  // Look for existing active key
  const activeLog = logs.find(
    (l) => l.properties?.user_email?.toLowerCase() === cleanEmail && l.properties?.status === 'active' && l.properties?.key
  );

  if (activeLog?.properties?.key) {
    return activeLog.properties.key;
  }

  // Otherwise generate new key
  const randomBytes = crypto.randomBytes(24).toString('hex');
  const apiKey = `dp_live_${randomBytes}`;
  const keyId = `key_${crypto.randomBytes(8).toString('hex')}`;
  const createdAt = new Date().toISOString();

  await supabase.from('events').insert({
    project_id: 'system_admin',
    type: 'event',
    name: 'api_key',
    properties: {
      key: apiKey,
      key_id: keyId,
      name,
      user_id: userId || null,
      user_email: cleanEmail,
      status: 'active',
      created_at: createdAt,
    },
    timestamp: createdAt,
  });

  return apiKey;
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
    let payload = {};
    if (typeof req.body === 'string') {
      try { payload = JSON.parse(req.body); } catch { payload = {}; }
    } else if (req.body && typeof req.body === 'object') {
      payload = req.body;
    }

    const action = payload.action || req.query.action || 'get_keys';
    const email = String(payload.email || req.query.email || '').trim().toLowerCase();
    const userId = payload.user_id || req.query.user_id || null;

    // 1. Generate a new API Key
    if (action === 'generate_key') {
      if (!email) {
        return res.status(400).json({ error: 'User email is required to generate an API key.' });
      }

      const randomBytes = crypto.randomBytes(24).toString('hex');
      const apiKey = `dp_live_${randomBytes}`;
      const keyId = `key_${crypto.randomBytes(8).toString('hex')}`;
      const name = payload.name?.trim() || 'Data Board AI & MCP Key';
      const createdAt = new Date().toISOString();

      await supabase.from('events').insert({
        project_id: 'system_admin',
        type: 'event',
        name: 'api_key',
        properties: {
          key: apiKey,
          key_id: keyId,
          name,
          user_id: userId,
          user_email: email,
          status: 'active',
          created_at: createdAt,
        },
        timestamp: createdAt,
      });

      return res.status(200).json({
        ok: true,
        key: apiKey,
        key_id: keyId,
        name,
        created_at: createdAt,
        message: 'New API key created successfully! Copy it now as it will not be shown in full again.',
      });
    }

    // 2. Get All Keys for a User
    if (action === 'get_keys') {
      if (!email) {
        return res.status(200).json({ ok: true, keys: [] });
      }

      const { data: logs = [] } = await supabase
        .from('events')
        .select('properties, timestamp')
        .eq('project_id', 'system_admin')
        .eq('name', 'api_key')
        .order('timestamp', { ascending: false });

      // Deduplicate by key_id or key to get latest status
      const keysMap = new Map();
      for (const l of logs) {
        const p = l.properties || {};
        if (p.user_email?.toLowerCase() === email && p.key_id && !keysMap.has(p.key_id)) {
          if (p.status !== 'revoked') {
            keysMap.set(p.key_id, {
              key_id: p.key_id,
              name: p.name || 'API Key',
              created_at: p.created_at || l.timestamp,
              key: p.key,
              masked_key: p.key ? `${p.key.slice(0, 12)}••••••••${p.key.slice(-4)}` : '',
            });
          }
        }
      }

      // If user doesn't have an active key yet, automatically create a default key
      if (keysMap.size === 0 && email) {
        const autoKey = await createOrGetApiKeyForUser(email, userId, 'Default AI & MCP Key');
        keysMap.set('auto_default', {
          key_id: 'key_default',
          name: 'Default AI & MCP Key',
          created_at: new Date().toISOString(),
          key: autoKey,
          masked_key: `${autoKey.slice(0, 12)}••••••••${autoKey.slice(-4)}`,
        });
      }

      return res.status(200).json({
        ok: true,
        keys: Array.from(keysMap.values()),
      });
    }

    // 3. Revoke an API Key
    if (action === 'revoke_key') {
      const keyId = payload.key_id;
      if (!keyId) {
        return res.status(400).json({ error: 'Key ID is required to revoke.' });
      }

      const revokedAt = new Date().toISOString();

      // Find the key to revoke
      const { data: logs = [] } = await supabase
        .from('events')
        .select('properties')
        .eq('project_id', 'system_admin')
        .eq('name', 'api_key')
        .order('timestamp', { ascending: false });

      const target = logs.find((l) => l.properties?.key_id === keyId);
      if (!target) {
        return res.status(404).json({ error: 'API key not found.' });
      }

      await supabase.from('events').insert({
        project_id: 'system_admin',
        type: 'event',
        name: 'api_key',
        properties: {
          ...target.properties,
          status: 'revoked',
          revoked_at: revokedAt,
        },
        timestamp: revokedAt,
      });

      return res.status(200).json({
        ok: true,
        message: 'API key successfully revoked.',
      });
    }

    return res.status(400).json({ error: `Unknown action: "${action}"` });
  } catch (err) {
    console.error('[APIKey Handler Error]:', err);
    return res.status(500).json({ error: err.message || 'API Key Error' });
  }
}
