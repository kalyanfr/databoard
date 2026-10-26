import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import {
  MAX_BODY_BYTES,
  MAX_EVENTS_PER_REQUEST,
  allowRequest,
  classifyChannel,
  clientIp,
  corsHeaders,
  geoOf,
  jsonWithCors,
  normalizeDomain,
  normalizePath,
  parseUserAgent,
  referrerDomainOf,
  safeTimestamp,
  truncate,
} from '../../shared/tracking.ts';

/**
 * Public event-ingestion endpoint. Customer websites post here, so there is no
 * session: the tracking key identifies the tenant, every field is validated and
 * length-capped, and writes go through the service role because visitors are
 * anonymous by design. CORS is open on purpose.
 */
const HitSchema = {
  t: (v) => v === 'pageview' || v === 'event',
};

function validateHit(hit) {
  if (!hit || typeof hit !== 'object') return null;
  if (!HitSchema.t(hit.t)) return null;
  if (typeof hit.sid !== 'string' || !hit.sid || hit.sid.length > 64) return null;
  if (typeof hit.vid !== 'string' || !hit.vid || hit.vid.length > 64) return null;
  return {
    t: hit.t,
    u: truncate(hit.u, 900),
    p: truncate(hit.p, 500),
    r: truncate(hit.r, 500),
    ti: hit.ti,
    sid: hit.sid,
    vid: hit.vid,
    n: truncate(hit.n, 80),
    rev: typeof hit.rev === 'number' && hit.rev >= 0 && hit.rev < 100000000 ? hit.rev : null,
    tg: truncate(hit.tg, 500),
    sd: typeof hit.sd === 'number' && hit.sd >= 0 && hit.sd <= 100 ? Math.round(hit.sd) : null,
    eg: typeof hit.eg === 'number' && hit.eg >= 0 && hit.eg < 86400 ? Math.round(hit.eg) : null,
    props: hit.props && typeof hit.props === 'object' ? hit.props : null,
    utm: hit.utm && typeof hit.utm === 'object' ? hit.utm : {},
    sw: typeof hit.sw === 'number' ? Math.round(hit.sw) : null,
  };
}

const maxIso = (a, b) => (Date.parse(a) > Date.parse(b) ? a : b);

export default async function (req) {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
    if (req.method !== 'POST') return jsonWithCors({ error: 'method_not_allowed' }, 405);

    const length = Number(req.headers.get('content-length') || 0);
    if (length > MAX_BODY_BYTES) return jsonWithCors({ error: 'payload_too_large' }, 413);

    const ip = clientIp(req.headers);
    if (ip && !allowRequest(`ip:${ip}`, 240, 60000)) return jsonWithCors({ error: 'rate_limited' }, 429);

    const text = await req.text();
    if (!text || text.length > MAX_BODY_BYTES) return jsonWithCors({ error: 'payload_too_large' }, 413);

    let body;
    try {
      body = JSON.parse(text);
    } catch {
      return jsonWithCors({ error: 'invalid_json' }, 400);
    }

    const pid = typeof body?.pid === 'string' ? body.pid.slice(0, 64) : '';
    const incoming = Array.isArray(body?.events) ? body.events.slice(0, MAX_EVENTS_PER_REQUEST) : [];
    if (!pid || !incoming.length) return jsonWithCors({ error: 'invalid_payload' }, 400);
    if (!allowRequest(`project:${pid}`, 1200, 60000)) return jsonWithCors({ error: 'rate_limited' }, 429);

    const hits = incoming.map(validateHit).filter(Boolean);
    if (!hits.length) return jsonWithCors({ error: 'invalid_payload' }, 400);

    const admin = createClientFromRequest(req).asServiceRole;

    // The tracking key is the tenant handle; the domain is accepted as a lookup
    // fallback so a snippet copied before a key was issued still resolves.
    let page = await admin.entities.Project.filter({ project_id: pid }, { limit: 1 });
    let project = page.items?.[0] ?? null;
    if (!project) {
      const cleanDomain = normalizeDomain(pid);
      if (!cleanDomain) return jsonWithCors({ error: 'unknown_project' }, 404);
      page = await admin.entities.Project.filter({ domain: cleanDomain }, { limit: 1 });
      project = page.items?.[0] ?? null;
    }
    if (!project) return jsonWithCors({ error: 'unknown_project' }, 404);

    const agent = parseUserAgent(req.headers.get('user-agent') || '');
    const geo = geoOf(req);
    const siteDomain = normalizeDomain(project.domain);
    const canonicalProjectId = project.project_id || pid;

    const records = hits.map((hit) => {
      const referrer = truncate(hit.r, 500) || null;
      const referrerDomain = referrerDomainOf(referrer);
      const utm = hit.utm || {};
      return {
        project_id: canonicalProjectId,
        type: hit.t,
        name: hit.t === 'event' ? truncate(hit.n, 80) || 'event' : null,
        url: hit.u,
        path: truncate(normalizePath(hit.p, hit.u), 500),
        referrer,
        referrer_domain: referrerDomain,
        channel: classifyChannel({
          referrerDomain,
          utmMedium: utm.utm_medium,
          utmSource: utm.utm_source,
          siteDomain,
        }),
        visitor_id: hit.vid,
        session_id: hit.sid,
        timestamp: safeTimestamp(hit.ti),
        device: agent.device,
        browser: agent.browser,
        os: agent.os,
        country: geo.country,
        region: geo.region,
        utm_source: truncate(utm.utm_source, 120),
        utm_medium: truncate(utm.utm_medium, 120),
        utm_campaign: truncate(utm.utm_campaign, 160),
        screen_width: hit.sw,
        properties: hit.props,
        revenue: hit.rev,
        target: hit.tg || null,
        scroll_depth: hit.sd,
        engaged_seconds: hit.eg,
      };
    });

    // Sessions and daily unique visitors are maintained at ingest time so bounce
    // rate, duration and unique-visitor counts stay cheap to read later.
    const bySession = new Map();
    for (const record of records) {
      if (!bySession.has(record.session_id)) bySession.set(record.session_id, []);
      bySession.get(record.session_id).push(record);
    }

    const sessionIds = [...bySession.keys()].slice(0, 10);
    const knownSessions = sessionIds.length
      ? ((await admin.entities.Session.filter({ project_id: canonicalProjectId, session_id: { $in: sessionIds } }, { limit: 50 })).items ?? [])
      : [];
    const knownBySession = new Map(knownSessions.map((record) => [record.session_id, record]));
    const sessionCreates = [];
    const sessionUpdates = [];

    for (const sessionId of sessionIds) {
      const hitsForSession = bySession.get(sessionId);
      const first = hitsForSession[0];
      const last = hitsForSession[hitsForSession.length - 1];
      const pageviews = hitsForSession.filter((hit) => hit.type === 'pageview').length;
      const existing = knownBySession.get(sessionId);

      if (existing) {
        const startedAt = existing.started_at ?? first.timestamp;
        const lastSeen = maxIso(existing.last_seen_at ?? first.timestamp, last.timestamp);
        const pageviewCount = (existing.pageview_count ?? 0) + pageviews;
        sessionUpdates.push({
          id: existing.id,
          last_seen_at: lastSeen,
          duration_seconds: Math.max(0, Math.round((Date.parse(lastSeen) - Date.parse(startedAt)) / 1000)),
          pageview_count: pageviewCount,
          event_count: (existing.event_count ?? 0) + (hitsForSession.length - pageviews),
          is_bounce: pageviewCount <= 1,
          exit_path: last.path ?? existing.exit_path,
        });
      } else {
        sessionCreates.push({
          project_id: canonicalProjectId,
          session_id: sessionId,
          visitor_id: first.visitor_id,
          started_at: first.timestamp,
          last_seen_at: last.timestamp,
          duration_seconds: Math.max(0, Math.round((Date.parse(last.timestamp) - Date.parse(first.timestamp)) / 1000)),
          pageview_count: pageviews,
          event_count: hitsForSession.length - pageviews,
          is_bounce: pageviews <= 1,
          entry_path: first.path,
          exit_path: last.path,
          referrer_domain: first.referrer_domain,
          channel: first.channel,
          device: first.device,
          browser: first.browser,
          os: first.os,
          country: first.country,
          region: first.region,
          utm_campaign: first.utm_campaign,
        });
      }
    }

    if (sessionCreates.length) await admin.entities.Session.bulkCreate(sessionCreates);
    if (sessionUpdates.length) await admin.entities.Session.bulkUpdate(sessionUpdates);

    // One record per visitor per UTC day, so unique visitors are a plain count.
    const visitorDays = new Map();
    for (const record of records) {
      const day = record.timestamp.slice(0, 10);
      const key = `${record.visitor_id}|${day}`;
      if (!visitorDays.has(key)) {
        visitorDays.set(key, {
          project_id: canonicalProjectId,
          visitor_id: record.visitor_id,
          date: day,
          first_seen_at: record.timestamp,
        });
      }
    }
    const visitorDayRecords = [...visitorDays.values()];
    const visitorIds = [...new Set(visitorDayRecords.map((row) => row.visitor_id))].slice(0, 50);
    const dateKeys = [...new Set(visitorDayRecords.map((row) => row.date))];
    const existingVisitorDays = visitorIds.length
      ? ((await admin.entities.VisitorDay.filter(
          { project_id: canonicalProjectId, visitor_id: { $in: visitorIds }, date: { $in: dateKeys } },
          { limit: 200 },
        )).items ?? [])
      : [];
    const seen = new Set(existingVisitorDays.map((row) => `${row.visitor_id}|${row.date}`));
    const freshVisitorDays = visitorDayRecords.filter((row) => !seen.has(`${row.visitor_id}|${row.date}`));
    if (freshVisitorDays.length) await admin.entities.VisitorDay.bulkCreate(freshVisitorDays);

    await admin.entities.Event.bulkCreate(records);

    return jsonWithCors({ ok: true, accepted: records.length }, 202);
  } catch (error) {
    return jsonWithCors({ error: error.message }, 500);
  }
}