import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { createOrGetApiKeyForUser } from './apiKey.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://vhnldpotikynnyaantgt.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_gkrz-FNCgEuMmYW1Yltu6w_edVA0KaO';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const DODO_API_KEY = process.env.DODO_PAYMENTS_API_KEY || '';
const DODO_PRODUCT_ID = process.env.DODO_PAYMENTS_PRODUCT_ID || '';

async function getSmtpTransporter() {
  try {
    const { data } = await supabase
      .from('events')
      .select('properties')
      .eq('project_id', 'system_admin')
      .eq('name', 'smtp_config')
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle();

    const config = data?.properties || {
      host: process.env.SMTP_HOST || 'smtp.hostinger.com',
      port: Number(process.env.SMTP_PORT) || 465,
      secure: process.env.SMTP_SECURE === 'false' ? false : true,
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
      from_name: process.env.SMTP_FROM_NAME || 'Guru Kalyan | Data Board',
      from_email: process.env.SMTP_FROM_EMAIL || 'support@databoard.in',
    };

    if (config.user && config.pass) {
      return {
        transporter: nodemailer.createTransport({
          host: config.host,
          port: config.port,
          secure: config.secure,
          auth: { user: config.user, pass: config.pass },
        }),
        from: `"${config.from_name}" <${config.from_email}>`,
      };
    }
  } catch (err) {
    console.warn('[Webhook SMTP Config Error]:', err.message);
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }

  const url = req.url || '';
  const isWebhook = url.includes('webhook') || req.headers['webhook-id'] || body.type === 'payment.succeeded';

  // ==========================================
  // PATH A: DODO WEBHOOK HANDLER
  // ==========================================
  if (isWebhook) {
    try {
      const eventType = body.type;
      const paymentData = body.data || {};

      console.log(`[Dodo Webhook Received]: type=${eventType}, payment_id=${paymentData.payment_id}`);

      if (eventType === 'payment.succeeded') {
        const customerEmail = (paymentData.customer?.email || '').trim().toLowerCase();
        const customerName = paymentData.customer?.name || 'Fellow Founder';

        if (!customerEmail) {
          return res.status(400).json({ error: 'Missing customer email in webhook payload.' });
        }

        let userId = null;
        let isNewUser = false;
        const tempPassword = `DataBoard_${crypto.randomBytes(4).toString('hex')}!`;

        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id, email, role')
          .eq('email', customerEmail)
          .maybeSingle();

        if (existingProfile?.id) {
          userId = existingProfile.id;
        } else {
          if (supabase.auth?.admin?.createUser) {
            const { data: created, error } = await supabase.auth.admin.createUser({
              email: customerEmail,
              password: tempPassword,
              email_confirm: true,
              user_metadata: { full_name: customerName, plan: 'lifetime_pro' },
            });
            if (!error && created?.user?.id) {
              userId = created.user.id;
              isNewUser = true;
            }
          }

          if (!userId) {
            try {
              const { data: signUpData, error } = await supabase.auth.signUp({
                email: customerEmail,
                password: tempPassword,
                options: { data: { full_name: customerName, plan: 'lifetime_pro' } },
              });
              if (!error && signUpData?.user?.id) {
                userId = signUpData.user.id;
                isNewUser = true;
              }
            } catch (signUpErr) {
              console.warn('[Dodo Webhook SignUp Warning]:', signUpErr.message);
            }
          }

          if (!userId) {
            userId = crypto.randomUUID();
            isNewUser = true;
          }
        }

        // Upsert profile with lifetime_pro role
        if (userId) {
          await supabase.from('profiles').upsert({
            id: userId,
            email: customerEmail,
            role: 'lifetime_pro',
            full_name: customerName,
            updated_at: new Date().toISOString(),
          });
        }

        // Auto-generate personal Lifetime Pro MCP API key
        let mcpKey = '';
        try {
          mcpKey = await createOrGetApiKeyForUser(customerEmail, userId, 'Lifetime Pro AI & MCP Key');
        } catch (err) {
          console.warn('[Auto MCP Key Generation Warning]:', err.message);
        }

        // Log permanent transaction in events table
        await supabase.from('events').insert({
          project_id: 'system_databoard',
          type: 'event',
          name: 'lifetime_sale',
          properties: {
            email: customerEmail,
            full_name: customerName,
            payment_id: paymentData.payment_id,
            amount_usd: 5,
            mcp_key: mcpKey,
            is_new_user: isNewUser,
            provider: 'dodopayments',
          },
        });

        // Send Welcome & Onboarding Email
        try {
          const mailer = await getSmtpTransporter();
          if (mailer) {
            const loginUrl = 'https://gurukalyan.vercel.app/login';
            const mcpServerUrl = `https://gurukalyan.vercel.app/mcp?key=${mcpKey}`;

            await mailer.transporter.sendMail({
              from: mailer.from,
              to: customerEmail,
              subject: '🎉 Your Data Board Lifetime Pro Account is Ready!',
              html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; line-height: 1.6;">
                  <h1 style="color: #2563eb; font-size: 24px; margin-bottom: 16px;">Welcome to Data Board Lifetime Pro!</h1>
                  <p>Hey ${customerName},</p>
                  <p>Thank you for claiming your <strong>$5 Lifetime Access Deal</strong>. Your account has been permanently upgraded to <strong>Lifetime Pro</strong> with full access to real-time analytics, uptime monitors, and AI MCP integration.</p>
                  
                  <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin: 20px 0;">
                    <h3 style="margin-top: 0; font-size: 15px; color: #0f172a;">Your Account Details:</h3>
                    <p style="margin: 6px 0; font-size: 14px;"><strong>Email:</strong> ${customerEmail}</p>
                    ${isNewUser ? `<p style="margin: 6px 0; font-size: 14px;"><strong>Temporary Password:</strong> <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${tempPassword}</code></p>` : ''}
                    <div style="margin-top: 14px;">
                      <a href="${loginUrl}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-weight: 600; font-size: 14px;">Log In to Dashboard &rarr;</a>
                    </div>
                  </div>

                  <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 18px; margin: 20px 0;">
                    <h3 style="margin-top: 0; font-size: 15px; color: #1e40af;">🤖 Your Claude & Cursor MCP Server URL:</h3>
                    <code style="display: block; background: #ffffff; border: 1px solid #93c5fd; padding: 10px; border-radius: 6px; font-size: 12px; word-break: break-all; color: #1e3a8a;">${mcpServerUrl}</code>
                    <p style="font-size: 12px; color: #3b82f6; margin-top: 8px; margin-bottom: 0;">You can query live visitors, top sources, and uptime directly inside Claude Desktop, Cursor, and ChatGPT using this URL.</p>
                  </div>

                  <p>If you have any questions or need help setting up your tracking script, simply reply to this email.</p>
                  <p style="margin-bottom: 0;">Cheers,<br/><strong>Guru Kalyan</strong><br/>Founder, Data Board</p>
                </div>
              `,
            });
            console.log(`[Dodo Webhook]: Welcome email sent to ${customerEmail}`);
          }
        } catch (mailErr) {
          console.warn('[Dodo Webhook Mail Error]:', mailErr.message);
        }

        return res.status(200).json({ ok: true, provisioned: true, userId });
      }

      return res.status(200).json({ ok: true, ignored: true });
    } catch (err) {
      console.error('[Dodo Webhook Critical Error]:', err);
      return res.status(500).json({ error: err.message || 'Webhook failed.' });
    }
  }

  // ==========================================
  // PATH B: DODO CHECKOUT INITIALIZER
  // ==========================================
  try {
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'gurukalyan.vercel.app';
    const proto = req.headers['x-forwarded-proto'] || (host.includes('localhost') ? 'http' : 'https');
    const origin = req.headers.origin || `${proto}://${host}`;

    const isTest = DODO_API_KEY.startsWith('dodo_test_');
    const dodoApiBase = isTest ? 'https://test.dodopayments.com' : 'https://live.dodopayments.com';

    const customerEmail = body.email ? String(body.email).trim().toLowerCase() : null;
    const customerName = body.name ? String(body.name).trim() : null;

    const checkoutPayload = {
      product_cart: [
        {
          product_id: DODO_PRODUCT_ID,
          quantity: 1,
        },
      ],
      return_url: `${origin}/payment-success`,
    };

    if (customerEmail) {
      checkoutPayload.customer = {
        email: customerEmail,
        ...(customerName ? { name: customerName } : {}),
      };
    }

    const response = await fetch(`${dodoApiBase}/checkouts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${DODO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(checkoutPayload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Dodo Checkout Error]:', data);
      return res.status(response.status).json({
        error: data.message || 'Failed to initialize Dodo checkout session.',
      });
    }

    return res.status(200).json({
      ok: true,
      session_id: data.session_id,
      checkout_url: data.checkout_url,
    });
  } catch (err) {
    console.error('[Dodo Checkout Handler Error]:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
