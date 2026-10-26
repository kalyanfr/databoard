import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

/**
 * Sends one email-marketing campaign to the app's registered users.
 * Admin only: the campaign, its audience and every recipient address come from
 * stored records, never from the request body.
 */
const BATCH_SIZE = 6;
const MAX_RECIPIENTS = 100;

export default async function (req) {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'method_not_allowed' }, { status: 405 });

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const payload = await req.json().catch(() => ({}));
    const campaignId = typeof payload?.campaign_id === 'string' ? payload.campaign_id : '';
    if (!campaignId) return Response.json({ error: 'campaign_id_required' }, { status: 400 });

    const admin = base44.asServiceRole;
    const campaign = await admin.entities.EmailCampaign.get(campaignId).catch(() => null);
    if (!campaign) return Response.json({ error: 'campaign_not_found' }, { status: 404 });
    if (campaign.status === 'sent') return Response.json({ error: 'already_sent' }, { status: 409 });

    const subject = String(campaign.subject || '').trim().slice(0, 160);
    const body = String(campaign.body || '').trim().slice(0, 8000);
    if (!subject || !body) return Response.json({ error: 'subject_and_body_required' }, { status: 400 });

    const settingsPage = await admin.entities.AppConfig.list('-created_date', 1).catch(() => null);
    const settings = settingsPage?.items?.[0] ?? settingsPage?.[0] ?? null;
    const fromName = settings?.from_name || 'Traffic Lume';

    const users = await admin.entities.User.list();
    const audience = users.filter((record) =>
      campaign.audience === 'admins' ? record.role === 'admin' : record.product_updates !== false,
    );
    const recipients = audience.filter((record) => typeof record.email === 'string' && record.email).slice(0, MAX_RECIPIENTS);

    if (!recipients.length) {
      await admin.entities.EmailCampaign.update(campaignId, {
        status: 'sent',
        recipient_count: 0,
        sent_at: new Date().toISOString(),
        error: 'No matching recipients.',
      });
      return Response.json({ sent: 0, failed: 0, total: 0 });
    }

    let sent = 0;
    let failed = 0;
    for (let index = 0; index < recipients.length; index += BATCH_SIZE) {
      const batch = recipients.slice(index, index + BATCH_SIZE);
      const settled = await Promise.allSettled(
        batch.map((record) =>
          admin.integrations.Core.SendEmail({ to: record.email, subject, body, from_name: fromName }),
        ),
      );
      settled.forEach((entry) => (entry.status === 'fulfilled' ? (sent += 1) : (failed += 1)));
    }

    await admin.entities.EmailCampaign.update(campaignId, {
      status: 'sent',
      recipient_count: sent,
      sent_at: new Date().toISOString(),
      error: failed ? `${failed} of ${recipients.length} recipients could not be reached.` : null,
    });

    return Response.json({ sent, failed, total: recipients.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}