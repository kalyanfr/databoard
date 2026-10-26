import { createClient } from '@supabase/supabase-js';
import { verifyApiKey } from './apiKey.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://vhnldpotikynnyaantgt.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_gkrz-FNCgEuMmYW1Yltu6w_edVA0KaO';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function getSinceDate(period) {
  const now = new Date();
  if (period === 'today') {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return today.toISOString();
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
 * Multi-Tenant Security Resolver
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

  if (userEmail === 'demo@trafficlume.com' || userEmail === 'demo@datopin.com' || userEmail === 'demo@webrader.com' || userEmail === 'demo@databoard.in') {
    return ['prj_demo_trafficlume', 'd3300000-0000-0000-0000-000000000001'];
  }

  const effectiveUserId = await resolveEffectiveUserId(userEmail, userId);

  try {
    let query = supabase.from('projects').select('id, project_id');
    if (effectiveUserId) {
      query = query.eq('created_by_id', effectiveUserId);
    } else {
      return [];
    }

    const { data, error } = await query;
    if (error) {
      console.error('[Analytics getUserAllowedProjectIds Query Error]:', error);
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
    console.error('[Analytics getUserAllowedProjectIds Error]:', err);
    return [];
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // 1. Authenticate Request via Bearer Token or Query Param
    const headers = req.headers || {};
    const authHeader = headers.authorization || '';
    let rawKey = '';
    if (authHeader.startsWith('Bearer ')) {
      rawKey = authHeader.slice(7).trim();
    } else if (req.query.api_key) {
      rawKey = String(req.query.api_key).trim();
    } else if (req.query.key) {
      rawKey = String(req.query.key).trim();
    }

    if (!rawKey) {
      return res.status(401).json({
        error: 'Unauthorized: Missing API Key. Provide via "Authorization: Bearer dp_live_..." header or ?key= param.',
      });
    }

    const auth = await verifyApiKey(rawKey);
    if (!auth.valid) {
      return res.status(401).json({ error: `Unauthorized: ${auth.error}` });
    }

    // 2. Resolve Parameters & Multi-Tenant Scoping
    let body = {};
    if (typeof req.body === 'string') {
      try { body = JSON.parse(req.body); } catch { body = {}; }
    } else if (req.body && typeof req.body === 'object') {
      body = req.body;
    }

    const queryType = body.type || req.query.type || 'overview';
    const period = body.period || req.query.period || 'today';
    const requestedProjectId = body.project_id || req.query.project_id || null;
    const limit = Math.min(parseInt(body.limit || req.query.limit || 10, 10), 100);

    const sinceDate = getSinceDate(period);
    const allowedProjectIds = await getUserAllowedProjectIds(auth.user_email, auth.user_id);

    // Security Check: Enforce user owns requested project
    if (requestedProjectId && allowedProjectIds.length > 0 && !allowedProjectIds.includes(requestedProjectId)) {
      return res.status(403).json({
        error: `Forbidden: Project "${requestedProjectId}" does not belong to your account.`,
      });
    }

    const targetProjectIds = requestedProjectId ? [requestedProjectId] : allowedProjectIds;

    // 3. Handle Queries

    // Type A: Realtime active visitors (last 5 minutes)
    if (queryType === 'realtime') {
      const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      let query = supabase
        .from('events')
        .select('visitor_id, path, url, country, device, browser, channel, timestamp, project_id')
        .gte('timestamp', fiveMinsAgo)
        .order('timestamp', { ascending: false });

      if (targetProjectIds.length > 0) {
        query = query.in('project_id', targetProjectIds);
      } else {
        return res.status(200).json({
          ok: true,
          type: 'realtime',
          active_visitors_now: 0,
          total_hits_last_5min: 0,
          active_pages: [],
          timestamp: new Date().toISOString(),
        });
      }

      const { data: events = [] } = await query;
      const uniqueVisitors = new Set(events.map((e) => e.visitor_id).filter(Boolean));
      const pageCounts = {};
      for (const e of events) {
        const p = e.path || '/';
        pageCounts[p] = (pageCounts[p] || 0) + 1;
      }

      return res.status(200).json({
        ok: true,
        type: 'realtime',
        active_visitors_now: uniqueVisitors.size,
        total_hits_last_5min: events.length,
        active_pages: Object.entries(pageCounts)
          .map(([path, hits]) => ({ path, hits }))
          .sort((a, b) => b.hits - a.hits)
          .slice(0, 5),
        timestamp: new Date().toISOString(),
      });
    }

    // Type B: Traffic Sources Breakdown
    if (queryType === 'sources') {
      let query = supabase
        .from('events')
        .select('referrer_domain, channel, visitor_id, project_id')
        .gte('timestamp', sinceDate);

      if (targetProjectIds.length > 0) {
        query = query.in('project_id', targetProjectIds);
      } else {
        return res.status(200).json({ ok: true, type: 'sources', period, total_tracked_visits: 0, sources: [] });
      }

      const { data: events = [] } = await query;
      const sourceMap = {};
      for (const e of events) {
        const src = e.referrer_domain || e.channel || 'Direct';
        sourceMap[src] = (sourceMap[src] || 0) + 1;
      }

      const topSources = Object.entries(sourceMap)
        .map(([source, visits]) => ({
          source,
          visits,
          percentage: events.length ? Math.round((visits / events.length) * 100) : 0,
        }))
        .sort((a, b) => b.visits - a.visits)
        .slice(0, limit);

      return res.status(200).json({
        ok: true,
        type: 'sources',
        period,
        total_tracked_visits: events.length,
        sources: topSources,
      });
    }

    // Type C: Top Pages Breakdown
    if (queryType === 'pages') {
      let query = supabase
        .from('events')
        .select('path, url, name, visitor_id, project_id')
        .gte('timestamp', sinceDate);

      if (targetProjectIds.length > 0) {
        query = query.in('project_id', targetProjectIds);
      } else {
        return res.status(200).json({ ok: true, type: 'pages', period, total_pageviews: 0, pages: [] });
      }

      const { data: events = [] } = await query;
      const pageMap = {};
      for (const e of events) {
        const p = e.path || '/';
        pageMap[p] = (pageMap[p] || 0) + 1;
      }

      const topPages = Object.entries(pageMap)
        .map(([path, views]) => ({
          path,
          views,
          percentage: events.length ? Math.round((views / events.length) * 100) : 0,
        }))
        .sort((a, b) => b.views - a.views)
        .slice(0, limit);

      return res.status(200).json({
        ok: true,
        type: 'pages',
        period,
        total_pageviews: events.length,
        pages: topPages,
      });
    }

    // Type D: Conversions & Revenue
    if (queryType === 'conversions') {
      let query = supabase
        .from('events')
        .select('name, revenue, properties, timestamp, project_id')
        .gte('timestamp', sinceDate);

      if (targetProjectIds.length > 0) {
        query = query.in('project_id', targetProjectIds);
      } else {
        return res.status(200).json({ ok: true, type: 'conversions', period, total_conversions: 0, total_revenue_usd: 0, goals: [] });
      }

      const { data: events = [] } = await query;
      const conversionEvents = events.filter(
        (e) => (typeof e.revenue === 'number' && e.revenue > 0) || e.name?.includes('conversion') || e.name?.includes('signup') || e.name?.includes('checkout')
      );

      let totalRevenue = 0;
      const goalCounts = {};
      for (const e of conversionEvents) {
        totalRevenue += e.revenue || 0;
        const gName = e.name || 'Goal Conversion';
        goalCounts[gName] = (goalCounts[gName] || 0) + 1;
      }

      return res.status(200).json({
        ok: true,
        type: 'conversions',
        period,
        total_conversions: conversionEvents.length,
        total_revenue_usd: Math.round(totalRevenue * 100) / 100,
        goals: Object.entries(goalCounts).map(([goal, completions]) => ({ goal, completions })),
      });
    }

    // Type E: Uptime Monitoring Status
    if (queryType === 'uptime') {
      const effectiveUserId = await resolveEffectiveUserId(auth.user_email, auth.user_id);
      let mq = supabase
        .from('monitors')
        .select('*')
        .order('created_at', { ascending: false });

      if (effectiveUserId && auth.user_email) {
        mq = mq.or(`owner_email.eq.${auth.user_email},created_by_id.eq.${effectiveUserId}`);
      } else if (auth.user_email) {
        mq = mq.eq('owner_email', auth.user_email);
      } else if (effectiveUserId) {
        mq = mq.eq('created_by_id', effectiveUserId);
      }

      const { data, error } = await mq;
      if (error) {
        console.warn('[Analytics Uptime Query Error]:', error);
      }
      const monitors = data || [];

      return res.status(200).json({
        ok: true,
        type: 'uptime',
        monitors_count: monitors.length,
        monitors: monitors.map((m) => ({
          id: m.id,
          name: m.name,
          url: m.url,
          status: m.status || 'up',
          latency_ms: m.last_response_ms || 0,
          last_status_code: m.last_status_code || 200,
          last_checked_at: m.last_checked_at,
        })),
      });
    }

    // Type F (Default): 100% Real Analytics Overview
    let query = supabase
      .from('events')
      .select('visitor_id, session_id, path, referrer_domain, country, device, revenue, timestamp, project_id')
      .gte('timestamp', sinceDate);

    if (targetProjectIds.length > 0) {
      query = query.in('project_id', targetProjectIds);
    } else {
      return res.status(200).json({
        ok: true,
        type: 'overview',
        period,
        project_id: requestedProjectId || 'All Your Projects',
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
      });
    }

    const { data: events = [] } = await query;

    const uniqueVisitors = new Set(events.map((e) => e.visitor_id).filter(Boolean));
    const uniqueSessions = new Set(events.map((e) => e.session_id).filter(Boolean));

    // Real Bounce Rate Calculation
    const sessionHitCounts = {};
    for (const e of events) {
      if (e.session_id) {
        sessionHitCounts[e.session_id] = (sessionHitCounts[e.session_id] || 0) + 1;
      }
    }
    const totalSessions = uniqueSessions.size || uniqueVisitors.size;
    const bounced = Object.values(sessionHitCounts).filter((c) => c === 1).length;
    const realBounceRate = totalSessions > 0 ? `${((bounced / totalSessions) * 100).toFixed(1)}%` : '0.0%';

    // Real Average Duration Calculation
    const sessionTimeMap = {};
    for (const e of events) {
      if (e.session_id && e.timestamp) {
        const t = new Date(e.timestamp).getTime();
        if (!sessionTimeMap[e.session_id]) {
          sessionTimeMap[e.session_id] = { min: t, max: t };
        } else {
          if (t < sessionTimeMap[e.session_id].min) sessionTimeMap[e.session_id].min = t;
          if (t > sessionTimeMap[e.session_id].max) sessionTimeMap[e.session_id].max = t;
        }
      }
    }
    let totalDurSec = 0;
    let validSessionCount = 0;
    for (const range of Object.values(sessionTimeMap)) {
      const diff = Math.round((range.max - range.min) / 1000);
      if (diff > 0) {
        totalDurSec += diff;
        validSessionCount++;
      }
    }
    const avgSec = validSessionCount > 0 ? Math.round(totalDurSec / validSessionCount) : 0;
    const realAvgDuration = avgSec >= 60 ? `${Math.floor(avgSec / 60)}m ${avgSec % 60}s` : `${avgSec}s`;

    let totalRev = 0;
    const countryMap = {};
    for (const e of events) {
      if (typeof e.revenue === 'number') totalRev += e.revenue;
      if (e.country) countryMap[e.country] = (countryMap[e.country] || 0) + 1;
    }

    const topCountry = Object.entries(countryMap).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    return res.status(200).json({
      ok: true,
      type: 'overview',
      period,
      project_id: requestedProjectId || (targetProjectIds.length === 1 ? targetProjectIds[0] : 'All Your Projects'),
      metrics: {
        unique_visitors: uniqueVisitors.size,
        total_pageviews: events.length,
        sessions: totalSessions,
        bounce_rate: realBounceRate,
        avg_duration: realAvgDuration,
        top_country: topCountry,
        revenue_usd: Math.round(totalRev * 100) / 100,
      },
      summary_text: `In the period "${period}", Data Board recorded ${uniqueVisitors.size.toLocaleString()} unique visitors and ${events.length.toLocaleString()} total pageviews. Real bounce rate is ${realBounceRate} with an average session duration of ${realAvgDuration}.`,
    });
  } catch (err) {
    console.error('[Analytics Query Error]:', err);
    return res.status(500).json({ error: err.message || 'Analytics query failed.' });
  }
}
