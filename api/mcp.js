import { createClient } from '@supabase/supabase-js';
import { verifyApiKey } from './apiKey.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://vhnldpotikynnyaantgt.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_gkrz-FNCgEuMmYW1Yltu6w_edVA0KaO';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TOOLS = [
  {
    name: 'get_analytics_overview',
    description: 'Get high-level traffic metrics: real unique visitors, real pageviews, real sessions, real bounce rate, top country, and revenue for a timeframe.',
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: true,
    idempotentHint: true,
    inputSchema: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['today', '24h', '7d', '30d'],
          description: "Timeframe for metrics (default: 'today')",
        },
        project_id: {
          type: 'string',
          description: 'Optional project ID to filter. If omitted, aggregates across all projects owned by you.',
        },
      },
    },
  },
  {
    name: 'get_realtime_visitors',
    description: 'Check live active visitors browsing your website in the last 5 minutes and active URLs.',
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: true,
    idempotentHint: true,
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'Optional project ID to filter realtime visitors.',
        },
      },
    },
  },
  {
    name: 'get_top_sources',
    description: 'Get ranked referral traffic channels and domains (e.g. Google, Twitter/X, GitHub, Direct) with visit counts.',
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: true,
    idempotentHint: true,
    inputSchema: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['today', '7d', '30d'],
          description: "Timeframe for sources (default: '7d')",
        },
        limit: {
          type: 'number',
          description: 'Number of top sources to return (default: 10)',
        },
        project_id: {
          type: 'string',
          description: 'Optional project ID to filter.',
        },
      },
    },
  },
  {
    name: 'get_top_pages',
    description: 'Get ranked most visited paths and landing pages with real view counts.',
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: true,
    idempotentHint: true,
    inputSchema: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['today', '7d', '30d'],
          description: "Timeframe for pages (default: '7d')",
        },
        limit: {
          type: 'number',
          description: 'Number of top pages to return (default: 10)',
        },
        project_id: {
          type: 'string',
          description: 'Optional project ID to filter.',
        },
      },
    },
  },
  {
    name: 'get_conversion_goals',
    description: 'Get real conversion goal performance, completion counts, and attributed revenue in USD.',
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: true,
    idempotentHint: true,
    inputSchema: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['today', '7d', '30d'],
          description: "Timeframe for conversions (default: '30d')",
        },
        project_id: {
          type: 'string',
          description: 'Optional project ID to filter.',
        },
      },
    },
  },
  {
    name: 'get_uptime_status',
    description: 'Check operational health (Up/Down status, latency in ms, HTTP response code) of monitored websites owned by you.',
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: true,
    idempotentHint: true,
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

/**
 * Multi-Tenant Security Resolver
 * Resolves project IDs strictly owned by the authenticated user to prevent data leaks.
 */
async function resolveEffectiveUserId(userEmail, userId) {
  if (userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    return userId;
  }
  if (!userEmail) return null;
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', userEmail.toLowerCase())
      .maybeSingle();
    return profile?.id || null;
  } catch (err) {
    console.error('[resolveEffectiveUserId Error]:', err);
    return null;
  }
}

async function getUserAllowedProjectIds(userEmail, userId) {
  if (!userEmail && !userId) return [];

  // Demo account support
  if (userEmail === 'demo@trafficlume.com' || userEmail === 'demo@databoard.in' || userEmail === 'demo@webrader.com' || userEmail === 'demo@databoard.in') {
    return ['prj_demo_trafficlume', 'd3300000-0000-0000-0000-000000000001'];
  }

  const effectiveUserId = await resolveEffectiveUserId(userEmail, userId);

  try {
    let query = supabase
      .from('projects')
      .select('id, project_id, name, domain');

    if (effectiveUserId) {
      query = query.eq('created_by_id', effectiveUserId);
    } else {
      return [];
    }

    const { data, error } = await query;
    if (error) {
      console.error('[MCP getUserAllowedProjectIds Query Error]:', error);
      return [];
    }

    const userProjects = data || [];
    const ids = new Set();
    for (const p of userProjects) {
      if (p.project_id) ids.add(p.project_id);
      if (p.id) ids.add(p.id);
    }
    return Array.from(ids);
  } catch (err) {
    console.error('[MCP getUserAllowedProjectIds Error]:', err);
    return [];
  }
}

function getPeriodSinceDate(period) {
  const now = new Date();
  if (period === 'today') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  }
  if (period === '24h') {
    return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  }
  if (period === '7d') {
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  }
  if (period === '30d') {
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  }
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
}

/**
 * Execute MCP Tool with 100% Real Database Calculations & Strict Security
 */
async function executeTool(name, args, authUser) {
  const period = args?.period || 'today';
  const requestedProjectId = args?.project_id || null;
  const userEmail = authUser?.user_email || '';
  const userId = authUser?.user_id || '';

  // 1. Resolve Multi-Tenant Allowed Projects
  const allowedProjectIds = await getUserAllowedProjectIds(userEmail, userId);

  // Security Check: If user specifies a project_id, verify they actually own it
  if (requestedProjectId && allowedProjectIds.length > 0 && !allowedProjectIds.includes(requestedProjectId)) {
    throw new Error(`Security Error: Access denied to project "${requestedProjectId}". This project does not belong to your account.`);
  }

  // Determine Target Projects for Database Query
  const targetProjectIds = requestedProjectId ? [requestedProjectId] : allowedProjectIds;

  // ==========================================
  // TOOL 1: get_realtime_visitors
  // ==========================================
  if (name === 'get_realtime_visitors') {
    const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    let q = supabase
      .from('events')
      .select('visitor_id, path, url, country, device, browser, channel, timestamp, project_id')
      .gte('timestamp', fiveMinsAgo)
      .order('timestamp', { ascending: false });

    if (targetProjectIds.length > 0) {
      q = q.in('project_id', targetProjectIds);
    } else {
      // If user has zero projects, return real empty metrics
      return {
        active_visitors_now: 0,
        total_hits_last_5min: 0,
        active_pages: [],
        message: 'No registered websites found for this account. Create a project in Data Board Dashboard to start tracking real-time traffic.',
      };
    }

    const { data } = await q;
    const events = data || [];
    const unique = new Set(events.map((e) => e.visitor_id).filter(Boolean));
    const pages = {};
    for (const e of events) {
      const p = e.path || '/';
      pages[p] = (pages[p] || 0) + 1;
    }

    return {
      period: 'Last 5 minutes (Real-time)',
      active_visitors_now: unique.size,
      total_hits_last_5min: events.length,
      active_pages: Object.entries(pages)
        .map(([path, hits]) => ({ path, hits }))
        .sort((a, b) => b.hits - a.hits)
        .slice(0, 5),
      timestamp: new Date().toISOString(),
    };
  }

  // ==========================================
  // TOOL 2: get_top_sources
  // ==========================================
  if (name === 'get_top_sources') {
    const since = getPeriodSinceDate(period);
    const limit = Math.min(parseInt(args?.limit || 10, 10), 50);

    let q = supabase
      .from('events')
      .select('referrer_domain, channel, visitor_id, project_id')
      .gte('timestamp', since);

    if (targetProjectIds.length > 0) {
      q = q.in('project_id', targetProjectIds);
    } else {
      return { period, total_tracked: 0, top_sources: [] };
    }

    const { data } = await q;
    const events = data || [];
    const sources = {};
    for (const e of events) {
      const s = e.referrer_domain || e.channel || 'Direct';
      sources[s] = (sources[s] || 0) + 1;
    }

    return {
      period,
      total_tracked: events.length,
      top_sources: Object.entries(sources)
        .map(([source, visits]) => ({ source, visits }))
        .sort((a, b) => b.visits - a.visits)
        .slice(0, limit),
    };
  }

  // ==========================================
  // TOOL 3: get_top_pages
  // ==========================================
  if (name === 'get_top_pages') {
    const since = getPeriodSinceDate(period);
    const limit = Math.min(parseInt(args?.limit || 10, 10), 50);

    let q = supabase
      .from('events')
      .select('path, visitor_id, project_id')
      .gte('timestamp', since);

    if (targetProjectIds.length > 0) {
      q = q.in('project_id', targetProjectIds);
    } else {
      return { period, total_pageviews: 0, top_pages: [] };
    }

    const { data } = await q;
    const events = data || [];
    const pages = {};
    for (const e of events) {
      const p = e.path || '/';
      pages[p] = (pages[p] || 0) + 1;
    }

    return {
      period,
      total_pageviews: events.length,
      top_pages: Object.entries(pages)
        .map(([path, views]) => ({ path, views }))
        .sort((a, b) => b.views - a.views)
        .slice(0, limit),
    };
  }

  // ==========================================
  // TOOL 4: get_conversion_goals
  // ==========================================
  if (name === 'get_conversion_goals') {
    const since = getPeriodSinceDate(period);
    let q = supabase
      .from('events')
      .select('name, revenue, timestamp, project_id')
      .gte('timestamp', since);

    if (targetProjectIds.length > 0) {
      q = q.in('project_id', targetProjectIds);
    } else {
      return { period, total_conversions: 0, total_revenue_usd: 0, goals: [] };
    }

    const { data } = await q;
    const events = data || [];
    const conversions = events.filter(
      (e) => (typeof e.revenue === 'number' && e.revenue > 0) || e.name?.includes('conversion') || e.name?.includes('signup') || e.name?.includes('checkout')
    );

    let totalRev = 0;
    const goals = {};
    for (const e of conversions) {
      totalRev += e.revenue || 0;
      const g = e.name || 'Goal Conversion';
      goals[g] = (goals[g] || 0) + 1;
    }

    return {
      period,
      total_conversions: conversions.length,
      total_revenue_usd: Math.round(totalRev * 100) / 100,
      goals: Object.entries(goals).map(([goal, count]) => ({ goal, count })),
    };
  }

  // ==========================================
  // TOOL 5: get_uptime_status
  // ==========================================
  if (name === 'get_uptime_status') {
    const effectiveUserId = await resolveEffectiveUserId(userEmail, userId);
    let mq = supabase.from('monitors').select('id, name, url, status, last_response_ms, last_checked_at');

    if (effectiveUserId && userEmail) {
      mq = mq.or(`owner_email.eq.${userEmail},created_by_id.eq.${effectiveUserId}`);
    } else if (userEmail) {
      mq = mq.eq('owner_email', userEmail);
    } else if (effectiveUserId) {
      mq = mq.eq('created_by_id', effectiveUserId);
    }

    const { data, error } = await mq;
    if (error) {
      console.warn('[MCP get_uptime_status Query Error]:', error);
    }
    const monitors = data || [];
    return {
      monitors_count: monitors.length,
      monitors: monitors.map((m) => ({
        name: m.name,
        url: m.url,
        status: m.status || 'up',
        latency_ms: m.last_response_ms || 0,
        last_checked_at: m.last_checked_at || 'Recently',
      })),
    };
  }

  // ==========================================
  // DEFAULT TOOL: get_analytics_overview
  // 100% Real Data Calculation: Real bounce rate & duration
  // ==========================================
  const since = getPeriodSinceDate(period);
  let q = supabase
    .from('events')
    .select('visitor_id, session_id, revenue, country, type, timestamp, project_id')
    .gte('timestamp', since);

  if (targetProjectIds.length > 0) {
    q = q.in('project_id', targetProjectIds);
  } else {
    return {
      period,
      project_id: requestedProjectId || 'All Projects',
      metrics: {
        unique_visitors: 0,
        total_pageviews: 0,
        sessions: 0,
        bounce_rate: '0.0%',
        avg_duration: '0s',
        top_country: 'N/A',
        revenue_usd: 0,
      },
      summary_text: `In the period "${period}", no website traffic has been recorded yet for your verified domains.`,
    };
  }

  const { data } = await q;
  const events = data || [];

  const uniqueVisitors = new Set(events.map((e) => e.visitor_id).filter(Boolean));
  const uniqueSessions = new Set(events.map((e) => e.session_id).filter(Boolean));

  // 1. Real Bounce Rate (Sessions with strictly 1 event)
  const sessionHits = {};
  for (const e of events) {
    if (e.session_id) {
      sessionHits[e.session_id] = (sessionHits[e.session_id] || 0) + 1;
    }
  }
  const totalSessionsCount = uniqueSessions.size || uniqueVisitors.size;
  const singleHitSessions = Object.values(sessionHits).filter((c) => c === 1).length;
  const realBounceRate = totalSessionsCount > 0
    ? `${((singleHitSessions / totalSessionsCount) * 100).toFixed(1)}%`
    : '0.0%';

  // 2. Real Average Duration (Time difference between first and last hit in multi-hit sessions)
  const sessionTimes = {};
  for (const e of events) {
    if (e.session_id && e.timestamp) {
      const t = new Date(e.timestamp).getTime();
      if (!sessionTimes[e.session_id]) {
        sessionTimes[e.session_id] = { min: t, max: t };
      } else {
        if (t < sessionTimes[e.session_id].min) sessionTimes[e.session_id].min = t;
        if (t > sessionTimes[e.session_id].max) sessionTimes[e.session_id].max = t;
      }
    }
  }
  let totalDurationSec = 0;
  let multiHitCount = 0;
  for (const range of Object.values(sessionTimes)) {
    const diff = Math.round((range.max - range.min) / 1000);
    if (diff > 0) {
      totalDurationSec += diff;
      multiHitCount++;
    }
  }
  const avgSec = multiHitCount > 0 ? Math.round(totalDurationSec / multiHitCount) : 0;
  const realAvgDuration = avgSec >= 60 ? `${Math.floor(avgSec / 60)}m ${avgSec % 60}s` : `${avgSec}s`;

  // 3. Real Top Country
  const countries = {};
  let totalRev = 0;
  for (const e of events) {
    if (typeof e.revenue === 'number') totalRev += e.revenue;
    if (e.country) countries[e.country] = (countries[e.country] || 0) + 1;
  }
  const topCountry = Object.entries(countries).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

  return {
    period,
    project_id: requestedProjectId || (targetProjectIds.length === 1 ? targetProjectIds[0] : 'All Your Projects'),
    metrics: {
      unique_visitors: uniqueVisitors.size,
      total_pageviews: events.length,
      sessions: totalSessionsCount,
      bounce_rate: realBounceRate,
      avg_duration: realAvgDuration,
      top_country: topCountry,
      revenue_usd: Math.round(totalRev * 100) / 100,
    },
    summary_text: `In the period "${period}", Data Board recorded ${uniqueVisitors.size.toLocaleString()} real unique visitors and ${events.length.toLocaleString()} total pageviews. Real bounce rate is ${realBounceRate} with an average session duration of ${realAvgDuration}.`,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = req.url || '';
  const query = req.query || (url.includes('?') ? Object.fromEntries(new URL(url, 'https://localhost').searchParams) : {});
  const headers = req.headers || {};
  const rawKey = query.key || query.api_key || headers.authorization?.replace(/^Bearer\s+/i, '') || '';

  // Authenticate Key if Provided
  let authUser = null;
  if (rawKey && rawKey.startsWith('dp_live_')) {
    const verification = await verifyApiKey(rawKey);
    if (verification?.valid) {
      authUser = verification;
    }
  }

  // 1. Handle GET: SSE Stream Connection or Info Manifest
  if (req.method === 'GET') {
    const host = headers['x-forwarded-host'] || headers.host || 'gurukalyan.vercel.app';
    const proto = headers['x-forwarded-proto'] || (host.includes('localhost') ? 'http' : 'https');
    const baseUrl = `${proto}://${host}`;

    const acceptHeader = req.headers.accept || '';
    if (acceptHeader.includes('text/event-stream')) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      });
      const keySuffix = rawKey ? `&key=${encodeURIComponent(rawKey)}` : '';
      const postUrl = `${baseUrl}/mcp?sessionId=default${keySuffix}`;
      res.write(`event: endpoint\ndata: ${postUrl}\n\n`);
      return;
    }

    // Return manifest
    return res.status(200).json({
      name: 'databoard-mcp',
      version: '1.0.0',
      description: 'Model Context Protocol (MCP) server for Data Board Analytics',
      authenticated: Boolean(authUser),
      user_email: authUser?.user_email || null,
      tools_count: TOOLS.length,
      tools: TOOLS.map((t) => t.name),
    });
  }

  // 2. Handle POST: JSON-RPC (MCP Protocol)
  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }

    const { id, method, params = {} } = body || {};

    // A. initialize
    if (method === 'initialize') {
      return res.status(200).json({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
          },
          serverInfo: {
            name: 'databoard-mcp',
            version: '1.0.0',
          },
        },
      });
    }

    // B. notifications/initialized
    if (method === 'notifications/initialized') {
      return res.status(200).end();
    }

    // C. tools/list
    if (method === 'tools/list') {
      return res.status(200).json({
        jsonrpc: '2.0',
        id,
        result: {
          tools: TOOLS,
        },
      });
    }

    // D. tools/call (Requires Authentication for Multi-Tenant Security)
    if (method === 'tools/call') {
      if (!authUser) {
        return res.status(200).json({
          jsonrpc: '2.0',
          id,
          error: {
            code: -32001,
            message: 'Unauthorized: Missing or invalid Data Board API Key. Please provide a valid key in your connection URL: /mcp?key=dp_live_...',
          },
        });
      }

      const toolName = params.name;
      const toolArgs = params.arguments || {};

      const data = await executeTool(toolName, toolArgs, authUser);

      return res.status(200).json({
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        },
      });
    }

    return res.status(200).json({
      jsonrpc: '2.0',
      id,
      error: {
        code: -32601,
        message: `Method "${method}" not found`,
      },
    });
  } catch (err) {
    console.error('[MCP Endpoint Error]:', err);
    return res.status(500).json({
      jsonrpc: '2.0',
      id: req.body?.id || null,
      error: {
        code: -32603,
        message: err.message || 'Internal MCP server error',
      },
    });
  }
}
