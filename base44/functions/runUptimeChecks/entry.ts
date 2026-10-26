import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

/**
 * Uptime checker. Runs two ways:
 *  - on a schedule (no signed-in user) to poll every active monitor;
 *  - from the dashboard for a signed-in user, who only reaches their own
 *    monitors ("Run checks now" / "Send test alert").
 * Down and recovery notifications are emailed to the address saved on the
 * monitor. Writes go through the service role because a scheduled run has no
 * user session.
 */
const REQUEST_TIMEOUT_MS = 8000;
const BATCH_SIZE = 6;
const MAX_MONITORS_PER_RUN = 25;
const MIN_SECONDS_BETWEEN_CHECKS = 30;
const REMINDER_EVERY = 12;

async function probe(url) {
  const started = Date.now();
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'user-agent': 'TrafficLume-Uptime/1.0' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    return { ok: response.status < 400, status: response.status, ms: Date.now() - started, error: null };
  } catch (error) {
    const message = error && error.message ? String(error.message).slice(0, 200) : 'unreachable';
    return { ok: false, status: 0, ms: Date.now() - started, error: message };
  }
}

function alertCopy(kind, monitor, result, origin) {
  const manage = origin ? `\nManage this monitor: ${origin}/uptime` : '';
  const when = new Date().toISOString();
  if (kind === 'down') {
    return {
      subject: `${monitor.name} is down`,
      body: [
        `${monitor.name} stopped responding to our checks.`,
        '',
        `URL: ${monitor.url}`,
        `Reason: ${result.error || `HTTP ${result.status}`}`,
        `Response time: ${result.ms} ms`,
        `Checked at: ${when}`,
        manage,
        '',
        'We will email you again the moment it recovers.',
      ]
        .filter((line) => line !== undefined)
        .join('\n'),
    };
  }
  if (kind === 'recovered') {
    return {
      subject: `${monitor.name} is back up`,
      body: [
        `${monitor.name} is answering normally again.`,
        '',
        `URL: ${monitor.url}`,
        `Status: HTTP ${result.status}`,
        `Response time: ${result.ms} ms`,
        `Checked at: ${when}`,
        manage,
      ].join('\n'),
    };
  }
  return {
    subject: `Test alert for ${monitor.name}`,
    body: [
      `This is a test alert for ${monitor.name}.`,
      '',
      `URL: ${monitor.url}`,
      `Current state: ${result.ok ? `up (HTTP ${result.status})` : `down (${result.error || `HTTP ${result.status}`})`}`,
      `Response time: ${result.ms} ms`,
      '',
      'Real alerts arrive on this address as soon as a check fails.',
      manage,
    ].join('\n'),
  };
}

export default async function (req) {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'method_not_allowed' }, { status: 405 });

    const base44 = createClientFromRequest(req);
    let user = null;
    try {
      user = await base44.auth.me();
    } catch {
      user = null; // scheduled run — no session
    }

    const payload = await req.json().catch(() => ({}));
    const monitorId = typeof payload?.monitor_id === 'string' ? payload.monitor_id : '';
    const isTest = payload?.test === true;

    const admin = base44.asServiceRole;
    const settingsPage = await admin.entities.AppConfig.list('-created_date', 1).catch(() => null);
    const settings = settingsPage?.items?.[0] ?? settingsPage?.[0] ?? null;
    const alertsEnabled = settings?.uptime_alerts_enabled !== false;
    const fromName = settings?.from_name || 'Traffic Lume';
    const origin = req.headers.get('X-Base44-App-Url') || '';

    let monitors = [];
    if (monitorId) {
      const record = await admin.entities.Monitor.get(monitorId).catch(() => null);
      if (!record) return Response.json({ error: 'monitor_not_found' }, { status: 404 });
      monitors = [record];
    } else {
      const page = await admin.entities.Monitor.filter({ status: { $ne: 'paused' } }, { sort: 'last_checked_at', limit: MAX_MONITORS_PER_RUN });
      monitors = page.items ?? [];
    }

    // Anyone who is not an admin only ever reaches their own monitors.
    if (user && user.role !== 'admin') {
      const allowed = monitors.filter((monitor) => monitor.created_by_id === user.id).slice(0, 10);
      if (!allowed.length) return Response.json({ checked: 0, skipped: 0, alerts: 0, results: [] });
      monitors = allowed;
    } else if (!user && monitorId) {
      // A manual, scoped request must come from a signed-in user.
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = Date.now();
    const due = monitors.filter(
      (monitor) => !monitor.last_checked_at || now - Date.parse(monitor.last_checked_at) > MIN_SECONDS_BETWEEN_CHECKS * 1000,
    );

    if (isTest) {
      const target = monitors[0];
      if (!target) return Response.json({ error: 'monitor_not_found' }, { status: 404 });
      const result = await probe(target.url);
      const to = target.alert_email || target.owner_email || target.created_by;
      if (!to) return Response.json({ error: 'no_alert_address' }, { status: 400 });
      const copy = alertCopy('test', target, result, origin);
      await admin.integrations.Core.SendEmail({ to, subject: copy.subject, body: copy.body, from_name: fromName });
      return Response.json({ test: true, sent_to: to });
    }

    if (!due.length) {
      return Response.json({ checked: 0, skipped: monitors.length, alerts: 0, results: [] });
    }

    const results = [];
    for (let index = 0; index < due.length; index += BATCH_SIZE) {
      const batch = due.slice(index, index + BATCH_SIZE);
      const settled = await Promise.allSettled(batch.map((monitor) => probe(monitor.url)));
      settled.forEach((entry, position) => {
        results.push({
          monitor: batch[position],
          result: entry.status === 'fulfilled' ? entry.value : { ok: false, status: 0, ms: 0, error: 'check_failed' },
        });
      });
    }

    const checkedAt = new Date().toISOString();
    await admin.entities.MonitorCheck.bulkCreate(
      results.map(({ monitor, result }) => ({
        monitor_id: monitor.id,
        owner_id: monitor.created_by_id ?? null,
        project_id: monitor.project_id ?? null,
        checked_at: checkedAt,
        ok: result.ok,
        status_code: result.status,
        response_ms: result.ms,
        error: result.error,
      })),
    );

    const updates = [];
    const alerts = [];
    for (const { monitor, result } of results) {
      const previous = monitor.status === 'paused' ? 'paused' : monitor.status || 'up';
      const failures = result.ok ? 0 : (monitor.consecutive_failures ?? 0) + 1;
      updates.push({
        id: monitor.id,
        status: result.ok ? 'up' : 'down',
        last_checked_at: checkedAt,
        last_status_code: result.status,
        last_response_ms: result.ms,
        consecutive_failures: failures,
      });

      if (!alertsEnabled) continue;
      const to = monitor.alert_email || monitor.owner_email || monitor.created_by;
      if (!to) continue;
      const wentDown = !result.ok && previous !== 'down';
      const recovered = result.ok && previous === 'down';
      const reminder = !result.ok && previous === 'down' && failures % REMINDER_EVERY === 0;
      if (!wentDown && !recovered && !reminder) continue;
      alerts.push({
        to,
        kind: result.ok ? 'recovered' : 'down',
        copy: alertCopy(result.ok ? 'recovered' : 'down', monitor, result, origin),
      });
    }

    if (updates.length) await admin.entities.Monitor.bulkUpdate(updates);

    let sent = 0;
    let failed = 0;
    for (let index = 0; index < alerts.length; index += BATCH_SIZE) {
      const batch = alerts.slice(index, index + BATCH_SIZE);
      const settled = await Promise.allSettled(
        batch.map((alert) =>
          admin.integrations.Core.SendEmail({
            to: alert.to,
            subject: alert.copy.subject,
            body: alert.copy.body,
            from_name: fromName,
          }),
        ),
      );
      settled.forEach((entry) => (entry.status === 'fulfilled' ? (sent += 1) : (failed += 1)));
    }

    return Response.json({
      checked: results.length,
      skipped: monitors.length - results.length,
      alerts: sent,
      alerts_failed: failed,
      results: results.map(({ monitor, result }) => ({
        name: monitor.name,
        url: monitor.url,
        ok: result.ok,
        status: result.status,
        ms: result.ms,
      })),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}