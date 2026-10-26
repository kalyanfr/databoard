import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://vhnldpotikynnyaantgt.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_gkrz-FNCgEuMmYW1Yltu6w_edVA0KaO';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const DEFAULT_DRIP_STEPS = [
  {
    id: 'step_1_welcome',
    title: 'Step 1: Welcome from Founder',
    delay_hours: 0,
    delay_label: 'Immediate (Upon Signup)',
    enabled: true,
    subject: 'Welcome to Data Board – a quick note from the founder',
    body: `Hey {{name}},

I'm Guru Kalyan, the founder of Data Board.

I wanted to personally reach out and welcome you! I built Data Board to give founders and indie hackers 100% real-time, privacy-first web analytics without the bloat of legacy analytics tools.

To start tracking your visitors, just paste this single line snippet into the <head> of your website:
<script defer src="https://gurukalyan.vercel.app/t.js" data-site="{{domain}}"></script>

If you need any help installing it or have any questions, just hit reply to this email—it goes straight to my personal inbox.

Best,
Guru Kalyan
Founder, Data Board`,
  },
  {
    id: 'step_2_snippet',
    title: 'Step 2: Tracking Snippet Verification',
    delay_hours: 24,
    delay_label: 'Day 1 (24 hours after signup)',
    enabled: true,
    subject: 'Quick question about your tracking snippet',
    body: `Hey {{name}},

Just checking in—have you had a chance to install the snippet on {{domain}} yet?

Once it's installed, your visitors will start appearing on your live 3D globe and real-time dashboard in seconds.

Tip: You can verify your domain in 1 click right from your projects page:
https://gurukalyan.vercel.app/projects

Need help setting it up on Webflow, Next.js, WordPress, or Shopify? Reply here and I'll send you the exact guide for your stack!

Cheers,
Guru`,
  },
  {
    id: 'step_3_ai_discovery',
    title: 'Step 3: AI Traffic & GEO Telemetry',
    delay_hours: 72,
    delay_label: 'Day 3 (72 hours after signup)',
    enabled: true,
    subject: 'Did you see which AI engines are citing your site?',
    body: `Hey {{name}},

One of my favorite features in Data Board is Generative Engine Optimization (GEO) & AI Traffic tracking.

In your Analytics tab, you can see whenever ChatGPT, Perplexity, Claude, or Gemini crawl your pages or send real visitors through AI citations.

You can also generate a custom robots.txt in 1 click to maximize your AI search citations while blocking scrapers:
https://gurukalyan.vercel.app/analytics?tab=crawlers

Check it out and let me know what you think!

Best,
Guru`,
  },
  {
    id: 'step_4_checkin',
    title: 'Step 4: Founder Check-in & Goals',
    delay_hours: 168,
    delay_label: 'Day 7 (1 week after signup)',
    enabled: true,
    subject: 'How is your first week with Data Board going?',
    body: `Hey {{name}},

It's been a week since you joined Data Board! I wanted to check in and see how everything is feeling so far.

Is there any metric, breakdown, or feature you wish we had? As an early user, your feedback directly shapes what I build next.

Also, if you're tracking conversion goals, remember you can track signups declaratively without writing code:
<button data-goal="signup" data-revenue="49">Sign Up</button>

Thanks for being part of our journey!

Warmly,
Guru Kalyan
Founder, Data Board`,
  },
];

async function getStoredSmtpConfig() {
  try {
    const { data } = await supabase
      .from('events')
      .select('properties')
      .eq('project_id', 'system_admin')
      .eq('name', 'smtp_config')
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.properties) {
      return data.properties;
    }
  } catch {}

  // Default to Hostinger SMTP
  return {
    host: process.env.SMTP_HOST || 'smtp.hostinger.com',
    port: Number(process.env.SMTP_PORT) || 465,
    secure: process.env.SMTP_SECURE === 'false' ? false : true,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from_name: process.env.SMTP_FROM_NAME || 'Guru Kalyan | Data Board',
    from_email: process.env.SMTP_FROM_EMAIL || 'support@databoard.in',
  };
}

async function getStoredDripSteps() {
  try {
    const { data } = await supabase
      .from('events')
      .select('properties')
      .eq('project_id', 'system_admin')
      .eq('name', 'drip_steps_config')
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.properties?.steps) {
      return data.properties.steps;
    }
  } catch {}

  return DEFAULT_DRIP_STEPS;
}

function createTransporter(smtp) {
  if (!smtp?.host || !smtp?.user || !smtp?.pass) {
    throw new Error('SMTP host, username, and password are required.');
  }

  const port = Number(smtp.port) || (smtp.secure ? 465 : 587);
  const secure = smtp.secure !== undefined ? Boolean(smtp.secure) : port === 465;

  return nodemailer.createTransport({
    host: smtp.host.trim(),
    port,
    secure,
    auth: {
      user: smtp.user.trim(),
      pass: smtp.pass.trim(),
    },
    tls: {
      rejectUnauthorized: false, // Helps avoid self-signed or cert mismatch issues on custom domains
    },
  });
}

function renderTemplate(template = '', vars = {}) {
  let res = String(template || '');
  for (const [k, v] of Object.entries(vars)) {
    const regex = new RegExp(`\\{\\{${k}\\}\\}`, 'gi');
    res = res.replace(regex, v || '');
  }
  return res;
}

function createHtmlEmail(bodyText, fromName) {
  const formattedText = bodyText
    .split('\n')
    .map((line) => {
      if (!line.trim()) return '<br/>';
      // Auto-link URLs
      const linked = line.replace(
        /(https?:\/\/[^\s]+)/g,
        '<a href="$1" style="color: #6366f1; text-decoration: underline;" target="_blank">$1</a>'
      );
      return `<p style="margin: 0 0 12px 0; line-height: 1.6; color: #1e293b;">${linked}</p>`;
    })
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 24px 16px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <!-- Header -->
          <tr>
            <td style="padding: 24px 28px 16px 28px; border-bottom: 1px solid #f1f5f9;">
              <span style="font-weight: 700; font-size: 16px; color: #0f172a; letter-spacing: -0.02em;">Data Board</span>
              <span style="font-size: 12px; color: #64748b; margin-left: 6px;">· Analytics</span>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 28px; font-size: 14px;">
              ${formattedText}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 16px 28px 24px 28px; border-top: 1px solid #f1f5f9; font-size: 11px; color: #94a3b8; line-height: 1.5;">
              Sent by ${fromName || 'Data Board'}. You received this as a registered member of Data Board.<br/>
              Hit reply anytime to talk directly with the founder.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export default async function handler(req, res) {
  // CORS headers
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

    const action = payload.action || req.query.action || 'get_settings';

    // 1. Get Settings (SMTP credentials masked & Drip steps)
    if (action === 'get_settings') {
      const smtp = await getStoredSmtpConfig();
      const steps = await getStoredDripSteps();
      return res.status(200).json({
        ok: true,
        smtp: {
          host: smtp.host || '',
          port: smtp.port || 587,
          secure: Boolean(smtp.secure),
          user: smtp.user || '',
          pass_masked: smtp.pass ? '••••••••' : '',
          has_pass: Boolean(smtp.pass),
          from_name: smtp.from_name || 'Guru Kalyan | Data Board',
          from_email: smtp.from_email || 'support@databoard.in',
        },
        steps,
      });
    }

    // 2. Save SMTP & Drip Settings
    if (action === 'save_settings') {
      const currentSmtp = await getStoredSmtpConfig();
      const newSmtp = payload.smtp || {};

      const updatedSmtp = {
        host: newSmtp.host !== undefined ? newSmtp.host.trim() : currentSmtp.host,
        port: newSmtp.port !== undefined ? Number(newSmtp.port) : currentSmtp.port,
        secure: newSmtp.secure !== undefined ? Boolean(newSmtp.secure) : currentSmtp.secure,
        user: newSmtp.user !== undefined ? newSmtp.user.trim() : currentSmtp.user,
        pass: (newSmtp.pass && newSmtp.pass !== '••••••••') ? newSmtp.pass.trim() : currentSmtp.pass,
        from_name: newSmtp.from_name !== undefined ? newSmtp.from_name.trim() : currentSmtp.from_name,
        from_email: newSmtp.from_email !== undefined ? newSmtp.from_email.trim() : currentSmtp.from_email,
      };

      await supabase.from('events').insert({
        project_id: 'system_admin',
        type: 'event',
        name: 'smtp_config',
        properties: updatedSmtp,
        timestamp: new Date().toISOString(),
      });

      if (payload.steps && Array.isArray(payload.steps)) {
        await supabase.from('events').insert({
          project_id: 'system_admin',
          type: 'event',
          name: 'drip_steps_config',
          properties: { steps: payload.steps },
          timestamp: new Date().toISOString(),
        });
      }

      return res.status(200).json({ ok: true, message: 'Settings saved successfully!' });
    }

    // 3. Test SMTP Connection
    if (action === 'test_smtp') {
      const currentSmtp = await getStoredSmtpConfig();
      const testConfig = payload.smtp ? {
        host: payload.smtp.host || currentSmtp.host,
        port: payload.smtp.port || currentSmtp.port,
        secure: payload.smtp.secure !== undefined ? payload.smtp.secure : currentSmtp.secure,
        user: payload.smtp.user || currentSmtp.user,
        pass: (payload.smtp.pass && payload.smtp.pass !== '••••••••') ? payload.smtp.pass : currentSmtp.pass,
        from_name: payload.smtp.from_name || currentSmtp.from_name,
        from_email: payload.smtp.from_email || currentSmtp.from_email,
      } : currentSmtp;

      const recipient = payload.to_email || testConfig.user || 'gurukalyanreddyd@gmail.com';
      const transporter = createTransporter(testConfig);

      // Verify connection
      await transporter.verify();

      // Send verification email
      const fromHeader = `"${testConfig.from_name || 'Data Board'}" <${testConfig.from_email || testConfig.user}>`;
      const info = await transporter.sendMail({
        from: fromHeader,
        to: recipient,
        subject: 'Data Board SMTP Test – Connection Verified! 🚀',
        text: `Success! Your custom SMTP configuration in Data Board is working properly.\n\nHost: ${testConfig.host}\nPort: ${testConfig.port}\nSender: ${fromHeader}\nTime: ${new Date().toISOString()}`,
        html: createHtmlEmail(
          `Success! Your custom SMTP configuration in Data Board is verified and working properly.<br/><br/><strong>Host:</strong> ${testConfig.host}<br/><strong>Port:</strong> ${testConfig.port}<br/><strong>Sender:</strong> ${fromHeader}<br/><br/>You are all set to deliver automated founder onboarding drips and broadcast campaigns to your users!`,
          testConfig.from_name
        ),
      });

      // Log test send
      await supabase.from('events').insert({
        project_id: 'system_admin',
        type: 'event',
        name: 'email_delivery_log',
        properties: {
          type: 'test_smtp',
          recipient,
          subject: 'Data Board SMTP Test',
          message_id: info.messageId,
          status: 'delivered',
          timestamp: new Date().toISOString(),
        },
      });

      return res.status(200).json({
        ok: true,
        message: `Test email sent successfully to ${recipient}!`,
        message_id: info.messageId,
      });
    }

    // 4. Send Test Drip Step to Founder Inbox
    if (action === 'send_test_drip') {
      const stepId = payload.step_id || 'step_1_welcome';
      const recipient = payload.to_email || 'gurukalyanreddyd@gmail.com';
      const steps = await getStoredDripSteps();
      const step = steps.find((s) => s.id === stepId) || steps[0];
      const smtp = await getStoredSmtpConfig();
      const transporter = createTransporter(smtp);

      const vars = {
        name: 'Kalyan',
        email: recipient,
        domain: 'adstracker.in',
        app_name: 'Data Board',
      };

      const renderedSubject = renderTemplate(`[TEST PREVIEW] ${step.subject}`, vars);
      const renderedBody = renderTemplate(step.body, vars);
      const fromHeader = `"${smtp.from_name || 'Guru Kalyan | Data Board'}" <${smtp.from_email || smtp.user}>`;

      const info = await transporter.sendMail({
        from: fromHeader,
        to: recipient,
        subject: renderedSubject,
        text: renderedBody,
        html: createHtmlEmail(renderedBody, smtp.from_name),
      });

      return res.status(200).json({
        ok: true,
        message: `Preview sent to ${recipient}!`,
        message_id: info.messageId,
      });
    }

    // 5. Send One-Off Broadcast Campaign
    if (action === 'send_broadcast') {
      const subject = payload.subject?.trim();
      const body = payload.body?.trim();
      const audience = payload.audience || 'all';

      if (!subject || !body) {
        return res.status(400).json({ error: 'Subject and message body are required.' });
      }

      const smtp = await getStoredSmtpConfig();
      const transporter = createTransporter(smtp);

      // Fetch target recipients
      let q = supabase.from('profiles').select('id, email, full_name, role');
      if (audience === 'admins') {
        q = q.eq('role', 'admin');
      }
      const { data: users, error: userErr } = await q;

      if (userErr || !users?.length) {
        return res.status(400).json({ error: 'No recipients found for this audience.' });
      }

      const fromHeader = `"${smtp.from_name || 'Guru Kalyan | Data Board'}" <${smtp.from_email || smtp.user}>`;
      let sentCount = 0;
      let failedCount = 0;

      for (const u of users) {
        if (!u.email || !u.email.includes('@')) continue;
        try {
          const vars = {
            name: u.full_name || u.email.split('@')[0],
            email: u.email,
            domain: 'your website',
            app_name: 'Data Board',
          };
          const renderedSub = renderTemplate(subject, vars);
          const renderedMsg = renderTemplate(body, vars);

          await transporter.sendMail({
            from: fromHeader,
            to: u.email,
            subject: renderedSub,
            text: renderedMsg,
            html: createHtmlEmail(renderedMsg, smtp.from_name),
          });
          sentCount++;
        } catch (err) {
          failedCount++;
          console.warn(`[Broadcast fail ${u.email}]:`, err.message);
        }
      }

      // Record campaign in events
      await supabase.from('events').insert({
        project_id: 'system_admin',
        type: 'event',
        name: 'email_campaign_broadcast',
        properties: {
          subject,
          body,
          audience,
          sent_count: sentCount,
          failed_count: failedCount,
          sent_at: new Date().toISOString(),
        },
      });

      return res.status(200).json({
        ok: true,
        sent: sentCount,
        failed: failedCount,
        message: `Campaign successfully delivered to ${sentCount} user${sentCount === 1 ? '' : 's'}!`,
      });
    }

    // 6. Run Automated Founder Drip Cycle
    if (action === 'run_automation') {
      const smtp = await getStoredSmtpConfig();
      const steps = await getStoredDripSteps();
      const transporter = createTransporter(smtp);

      // Fetch all users
      const { data: users = [] } = await supabase
        .from('profiles')
        .select('id, email, full_name, created_at, role');

      // Fetch existing sent drip logs to prevent duplicate sends
      const { data: logs = [] } = await supabase
        .from('events')
        .select('properties')
        .eq('project_id', 'system_admin')
        .eq('name', 'email_drip_log');

      const sentLogSet = new Set(
        logs.map((l) => `${l.properties?.user_id || l.properties?.email}_${l.properties?.step_id}`)
      );

      const now = Date.now();
      let sentDripsCount = 0;
      const sentDetails = [];

      for (const u of users) {
        if (!u.email || !u.email.includes('@')) continue;
        const userCreated = u.created_at ? new Date(u.created_at).getTime() : now;
        const ageHours = (now - userCreated) / (1000 * 60 * 60);

        for (const step of steps) {
          if (!step.enabled) continue;

          const key = `${u.id || u.email}_${step.id}`;
          if (sentLogSet.has(key)) continue;

          // Check if user is old enough for this step
          if (ageHours >= step.delay_hours) {
            try {
              const vars = {
                name: u.full_name || u.email.split('@')[0],
                email: u.email,
                domain: 'your website',
                app_name: 'Data Board',
              };

              const renderedSub = renderTemplate(step.subject, vars);
              const renderedBody = renderTemplate(step.body, vars);
              const fromHeader = `"${smtp.from_name || 'Guru Kalyan | Data Board'}" <${smtp.from_email || smtp.user}>`;

              const info = await transporter.sendMail({
                from: fromHeader,
                to: u.email,
                subject: renderedSub,
                text: renderedBody,
                html: createHtmlEmail(renderedBody, smtp.from_name),
              });

              // Mark as sent in DB
              sentLogSet.add(key);
              await supabase.from('events').insert({
                project_id: 'system_admin',
                type: 'event',
                name: 'email_drip_log',
                properties: {
                  user_id: u.id,
                  email: u.email,
                  step_id: step.id,
                  step_title: step.title,
                  subject: renderedSub,
                  message_id: info.messageId,
                  sent_at: new Date().toISOString(),
                },
              });

              sentDripsCount++;
              sentDetails.push({
                email: u.email,
                step: step.title,
                sent_at: new Date().toISOString(),
              });
            } catch (dripErr) {
              console.warn(`[Drip send fail ${u.email} on ${step.id}]:`, dripErr.message);
            }
          }
        }
      }

      return res.status(200).json({
        ok: true,
        sent: sentDripsCount,
        details: sentDetails,
        message: sentDripsCount > 0
          ? `Sent ${sentDripsCount} automated founder onboarding emails!`
          : 'All users are completely up to date. No pending follow-ups due.',
      });
    }

    // 7. Get Delivery Logs
    if (action === 'get_logs') {
      const { data: logs = [] } = await supabase
        .from('events')
        .select('*')
        .eq('project_id', 'system_admin')
        .in('name', ['email_drip_log', 'email_campaign_broadcast', 'email_delivery_log'])
        .order('timestamp', { ascending: false })
        .limit(100);

      const items = logs.map((l) => ({
        id: l.id,
        type: l.name === 'email_drip_log' ? 'Automated Drip' : (l.name === 'email_campaign_broadcast' ? 'Broadcast' : 'Test'),
        recipient: l.properties?.email || l.properties?.recipient || `${l.properties?.sent_count || 0} users`,
        subject: l.properties?.subject || l.properties?.step_title || 'Email',
        sent_at: l.properties?.sent_at || l.properties?.timestamp || l.timestamp,
        status: 'delivered',
      }));

      return res.status(200).json({ ok: true, logs: items });
    }

    return res.status(400).json({ error: `Unknown action "${action}"` });
  } catch (error) {
    console.error('[Email Function Error]:', error);
    return res.status(500).json({ error: error.message || 'Internal Email Error' });
  }
}
