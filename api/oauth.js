import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { createOrGetApiKeyForUser } from './apiKey.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://vhnldpotikynnyaantgt.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_gkrz-FNCgEuMmYW1Yltu6w_edVA0KaO';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Parse body if present
  let body = {};
  if (typeof req.body === 'string') {
    try {
      body = JSON.parse(req.body);
    } catch {
      body = Object.fromEntries(new URLSearchParams(req.body));
    }
  } else if (req.body && typeof req.body === 'object') {
    body = req.body;
  }

  const url = req.url || '';
  const query = req.query || (url.includes('?') ? Object.fromEntries(new URL(url, 'https://localhost').searchParams) : {});

  // ==========================================
  // PATH 0: RFC 8414 OAUTH METADATA DISCOVERY
  // ==========================================
  if (url.includes('.well-known') || query.discovery === 'true' || url.includes('/metadata')) {
    return res.status(200).json({
      issuer: 'https://gurukalyan.vercel.app',
      authorization_endpoint: 'https://gurukalyan.vercel.app/api/oauth/authorize',
      token_endpoint: 'https://gurukalyan.vercel.app/api/oauth/token',
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic', 'none'],
      scopes_supported: ['analytics:read'],
      code_challenge_methods_supported: ['S256'],
    });
  }

  const isTokenRequest = url.includes('/token') || body.grant_type === 'authorization_code' || query.grant_type === 'authorization_code';

  // ==========================================
  // PATH B: TOKEN EXCHANGE (POST /api/oauth/token)
  // ==========================================
  if (isTokenRequest) {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'method_not_allowed', error_description: 'Only POST requests are supported for token exchange.' });
    }

    try {
      const grantType = body.grant_type || query.grant_type;
      const code = body.code || query.code;

      if (grantType !== 'authorization_code') {
        return res.status(400).json({
          error: 'unsupported_grant_type',
          error_description: 'Only grant_type=authorization_code is supported.',
        });
      }

      if (!code) {
        return res.status(400).json({
          error: 'invalid_request',
          error_description: 'Authorization code is required.',
        });
      }

      // Lookup the Authorization Code in Database
      const { data: logs = [] } = await supabase
        .from('events')
        .select('properties, timestamp')
        .eq('project_id', 'system_admin')
        .eq('name', 'oauth_code')
        .order('timestamp', { ascending: false });

      const matchingCode = logs.find((l) => l.properties?.code === code);

      if (!matchingCode) {
        return res.status(400).json({
          error: 'invalid_grant',
          error_description: 'Invalid or unrecognized authorization code.',
        });
      }

      const { email, expires_at, used } = matchingCode.properties;

      if (used) {
        return res.status(400).json({
          error: 'invalid_grant',
          error_description: 'Authorization code has already been used.',
        });
      }

      if (new Date(expires_at).getTime() < Date.now()) {
        return res.status(400).json({
          error: 'invalid_grant',
          error_description: 'Authorization code has expired. Please re-authenticate.',
        });
      }

      // Mark Code as Used
      await supabase.from('events').insert({
        project_id: 'system_admin',
        type: 'event',
        name: 'oauth_code',
        properties: {
          ...matchingCode.properties,
          used: true,
          used_at: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      });

      // Retrieve or Create Persistent Data Board API Key for User
      const apiKey = await createOrGetApiKeyForUser(email, null, 'ChatGPT OAuth Connection');

      // Return Standard OAuth 2.0 Token Response
      return res.status(200).json({
        access_token: apiKey,
        token_type: 'Bearer',
        expires_in: 315360000, // 10 years (Lifetime access)
        scope: 'analytics:read',
      });
    } catch (err) {
      console.error('[OAuth Token Error]:', err);
      return res.status(500).json({
        error: 'server_error',
        error_description: err.message || 'OAuth token exchange failed.',
      });
    }
  }

  // ==========================================
  // PATH A: AUTHORIZATION (GET/POST /api/oauth/authorize)
  // ==========================================
  try {
    const clientId = query.client_id || 'databoard-chatgpt';
    const redirectUri = query.redirect_uri || '';
    const state = query.state || '';
    const scope = query.scope || 'analytics:read';

    if (!redirectUri) {
      return res.status(400).send('Error: Missing redirect_uri in authorization request.');
    }

    // Handle POST: User submitted credentials to authorize ChatGPT
    if (req.method === 'POST') {
      const email = String(body.email || query.email || '').trim().toLowerCase();
      const password = String(body.password || query.password || '');

      if (!email || !email.includes('@')) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send(renderConsentHtml({
          clientId,
          redirectUri,
          state,
          scope,
          email,
          error: 'Please enter a valid Data Board account email address.',
        }));
      }

      if (!password) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send(renderConsentHtml({
          clientId,
          redirectUri,
          state,
          scope,
          email,
          error: 'Please enter your account password.',
        }));
      }

      // Verify Credentials Against Supabase Auth
      let isAuthenticated = false;
      let authErrorMessage = '';

      if ((email === 'demo@trafficlume.com' || email === 'demo@databoard.in' || email === 'demo@webrader.com') && password === 'Demo@123') {
        isAuthenticated = true;
      } else {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (authError || !authData?.user) {
          authErrorMessage = authError?.message || 'Invalid email or password.';
        } else {
          isAuthenticated = true;
        }
      }

      if (!isAuthenticated) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send(renderConsentHtml({
          clientId,
          redirectUri,
          state,
          scope,
          email,
          error: authErrorMessage || 'Invalid login credentials. Please try again.',
        }));
      }

      // Credentials Validated: Generate one-time Authorization Code
      const authCode = `auth_${crypto.randomBytes(24).toString('hex')}`;
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const createdAt = new Date().toISOString();

      await supabase.from('events').insert({
        project_id: 'system_admin',
        type: 'event',
        name: 'oauth_code',
        properties: {
          code: authCode,
          email,
          client_id: clientId,
          redirect_uri: redirectUri,
          scope,
          used: false,
          created_at: createdAt,
          expires_at: expiresAt,
        },
        timestamp: createdAt,
      });

      const callbackUrl = new URL(redirectUri);
      callbackUrl.searchParams.set('code', authCode);
      if (state) callbackUrl.searchParams.set('state', state);

      return res.redirect(302, callbackUrl.toString());
    }

    // Handle GET: Render clean Data Board OAuth Consent Screen
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(renderConsentHtml({
      clientId,
      redirectUri,
      state,
      scope,
      email: '',
      error: '',
    }));
  } catch (err) {
    console.error('[OAuth Authorize Error]:', err);
    return res.status(500).send(`OAuth Error: ${err.message}`);
  }
}

function renderConsentHtml({ clientId, redirectUri, state, scope, email = '', error = '' }) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authorize ChatGPT · Data Board</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background-color: #f8fafc;
      color: #0f172a;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }
    .card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 1.25rem;
      box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.05), 0 8px 10px -6px rgba(15, 23, 42, 0.03);
      max-width: 440px;
      width: 100%;
      padding: 2rem;
    }
    .brand-header {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      margin-bottom: 1.5rem;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 0.25rem 0.6rem;
      background: #eff6ff;
      color: #2563eb;
      font-size: 0.75rem;
      font-weight: 600;
      border-radius: 9999px;
      border: 1px solid #bfdbfe;
    }
    .connector {
      font-size: 1.1rem;
      color: #94a3b8;
    }
    h1 {
      font-size: 1.25rem;
      font-weight: 700;
      color: #0f172a;
      text-align: center;
      margin-bottom: 0.5rem;
    }
    p.subtitle {
      font-size: 0.825rem;
      color: #64748b;
      text-align: center;
      line-height: 1.45;
      margin-bottom: 1.75rem;
    }
    .permissions-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 0.75rem;
      padding: 1rem;
      margin-bottom: 1.5rem;
    }
    .permissions-box p {
      font-size: 0.75rem;
      font-weight: 600;
      color: #334155;
      margin-bottom: 0.5rem;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .permissions-list {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }
    .permissions-list li {
      font-size: 0.8rem;
      color: #475569;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .permissions-list li::before {
      content: "✓";
      color: #2563eb;
      font-weight: 700;
    }
    .form-group {
      margin-bottom: 1.25rem;
    }
    label {
      display: block;
      font-size: 0.75rem;
      font-weight: 600;
      color: #334155;
      margin-bottom: 0.35rem;
    }
    .error-banner {
      background-color: #fef2f2;
      border: 1px solid #fecaca;
      color: #b91c1c;
      padding: 0.65rem 0.85rem;
      border-radius: 0.5rem;
      font-size: 0.8rem;
      font-weight: 500;
      margin-bottom: 1.25rem;
      line-height: 1.4;
    }
    input[type="email"],
    input[type="password"] {
      width: 100%;
      height: 2.5rem;
      padding: 0 0.75rem;
      border: 1px solid #cbd5e1;
      border-radius: 0.5rem;
      font-size: 0.85rem;
      color: #0f172a;
      outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    input[type="email"]:focus,
    input[type="password"]:focus {
      border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
    }
    .btn-submit {
      width: 100%;
      height: 2.6rem;
      background: #2563eb;
      color: #ffffff;
      border: none;
      border-radius: 0.5rem;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      transition: background 0.15s;
    }
    .btn-submit:hover {
      background: #1d4ed8;
    }
    .footer-note {
      font-size: 0.7rem;
      color: #94a3b8;
      text-align: center;
      margin-top: 1rem;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand-header">
      <span class="badge">Data Board</span>
      <span class="connector">⟷</span>
      <span class="badge" style="background:#f0fdf4; color:#16a34a; border-color:#bbf7d0;">ChatGPT</span>
    </div>

    <h1>Authorize ChatGPT</h1>
    <p class="subtitle">
      Sign in with your Data Board credentials to securely grant ChatGPT access to your traffic analytics and uptime data.
    </p>

    ${error ? `<div class="error-banner">${error}</div>` : ''}

    <div class="permissions-box">
      <p>Permissions Requested:</p>
      <ul class="permissions-list">
        <li>Read visitor metrics, pageviews, and bounce rate</li>
        <li>Query top referral traffic sources and top pages</li>
        <li>View active realtime visitors and conversion goals</li>
        <li>Check monitor uptime status and response latency</li>
      </ul>
    </div>

    <form method="POST" action="/api/oauth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}&scope=${encodeURIComponent(scope)}">
      <div class="form-group">
        <label for="email">Data Board Account Email</label>
        <input
          type="email"
          id="email"
          name="email"
          value="${email ? email.replace(/"/g, '&quot;') : ''}"
          placeholder="support@databoard.in"
          required
          ${email ? '' : 'autofocus'}
        />
      </div>

      <div class="form-group">
        <label for="password">Account Password</label>
        <input
          type="password"
          id="password"
          name="password"
          placeholder="••••••••••••"
          required
          ${email ? 'autofocus' : ''}
        />
      </div>

      <button type="submit" class="btn-submit">
        Verify & Authorize
      </button>
    </form>

    <p class="footer-note">
      Your credentials are encrypted and verified directly against Data Board Auth.
    </p>
  </div>
</body>
</html>
  `.trim();

  return html;
}
