import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://vhnldpotikynnyaantgt.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_gkrz-FNCgEuMmYW1Yltu6w_edVA0KaO';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
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
    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: authHeader ? { Authorization: authHeader } : {},
      },
    });
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_KEY);

    const body = req.body || {};
    const id = body.id || body.project_id;
    const domainInput = body.domain;

    if (!id && !domainInput) {
      return res.status(400).json({ verified: false, error: 'Project identifier is required' });
    }

    // Try finding the project
    let project = null;

    if (id) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id));
      if (isUuid) {
        const { data } = await supabaseUser.from('projects').select('*').eq('id', id).maybeSingle();
        project = data;
        if (!project) {
          const { data: adminData } = await supabaseAdmin.from('projects').select('*').eq('id', id).maybeSingle();
          project = adminData;
        }
      }
      if (!project) {
        const { data } = await supabaseUser.from('projects').select('*').eq('project_id', id).maybeSingle();
        project = data;
        if (!project) {
          const { data: adminData } = await supabaseAdmin.from('projects').select('*').eq('project_id', id).maybeSingle();
          project = adminData;
        }
      }
    }

    if (!project && domainInput) {
      const clean = domainInput.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
      const { data } = await supabaseUser.from('projects').select('*').eq('domain', clean).maybeSingle();
      project = data;
      if (!project) {
        const { data: adminData } = await supabaseAdmin.from('projects').select('*').eq('domain', clean).maybeSingle();
        project = adminData;
      }
    }

    // Target domain to check
    const domain = (project?.domain || domainInput || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
    const projectKey = project?.project_id || id || '';

    if (!domain) {
      return res.status(400).json({ verified: false, error: 'Valid website domain is required' });
    }

    if (!projectKey) {
      return res.status(400).json({ verified: false, error: 'Tracking project key is required for verification' });
    }

    // Check 1: Did any live events already arrive with THIS project's specific key?
    const { count: liveHitsCount } = await supabaseAdmin
      .from('events')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectKey);

    if (liveHitsCount && liveHitsCount > 0) {
      if (project?.id) {
        await supabaseAdmin.from('projects').update({ status: 'verified', verified_at: new Date().toISOString() }).eq('id', project.id);
      }
      return res.status(200).json({
        verified: true,
        message: `Live telemetry received (${liveHitsCount} hits). Domain ownership verified!`,
      });
    }

    // Check 2: Inspect website HTML specifically for THIS project's unique key
    const probeUrls = [
      `https://${domain}`,
      `https://www.${domain}`,
      `http://${domain}`,
      `http://www.${domain}`,
    ];

    let snippetFound = false;
    let foreignSnippetFound = false;
    let lastError = null;

    for (const url of probeUrls) {
      try {
        const response = await fetch(url, {
          redirect: 'follow',
          signal: AbortSignal.timeout(9000),
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        });

        if (response.ok) {
          const html = await response.text();

          // Strict ownership check: Must contain THIS project's unique key
          const hasThisKey = html.includes(projectKey);

          if (hasThisKey) {
            snippetFound = true;
            break;
          }

          // Did we find a generic Data Board snippet but with a DIFFERENT key?
          const hasAnyDataBoardSnippet =
            html.includes('t.js') ||
            html.includes('data-site=') ||
            html.includes('/api/track') ||
            /pk_[0-9a-f]{16}/i.test(html);

          if (hasAnyDataBoardSnippet) {
            foreignSnippetFound = true;
            lastError = `A tracking code was detected on ${domain}, but it uses a DIFFERENT tracking key. To verify ownership, you must update your website code with your assigned key: ${projectKey}`;
          } else {
            lastError = `Tracking snippet not detected on ${domain}. Please paste your tracking code into your site's <head> or <body> and try again.`;
          }
        } else {
          lastError = `HTTP ${response.status} from ${url}`;
        }
      } catch (e) {
        lastError = e.message || 'Connection failed';
      }
    }

    if (snippetFound) {
      if (project?.id) {
        await supabaseAdmin.from('projects').update({ status: 'verified', verified_at: new Date().toISOString() }).eq('id', project.id);
      }
      return res.status(200).json({
        verified: true,
        message: `Snippet with your tracking key (${projectKey}) detected! Domain ownership verified.`,
      });
    }

    // Verification failed: strictly revert/keep project status as pending
    if (project?.id) {
      await supabaseAdmin.from('projects').update({ status: 'pending', verified_at: null }).eq('id', project.id);
    }

    return res.status(400).json({
      verified: false,
      error: foreignSnippetFound
        ? `A tracking snippet is active on ${domain}, but it has a DIFFERENT tracking key. You must install your assigned key (${projectKey}) to verify ownership.`
        : (lastError || `Tracking code with key ${projectKey} was not found on ${domain}.`),
    });
  } catch (err) {
    return res.status(500).json({ verified: false, error: err.message });
  }
}
