import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { normalizeDomain } from '../../shared/tracking.ts';

/**
 * Ownership check for a project's domain: fetch the site and look for the
 * Traffic Lume snippet carrying this project's key. Runs server-side because
 * the browser cannot read another origin's HTML.
 */
const escapeRe = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export default async function (req) {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'method_not_allowed' }, { status: 405 });

    let body = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const id = String(body?.id ?? '').slice(0, 80);
    if (!id) return Response.json({ error: 'A project id is required.' }, { status: 400 });

    const base44 = createClientFromRequest(req);
    const admin = base44.asServiceRole;

    let project = null;
    try {
      project = await base44.entities.Project.get(id);
    } catch {
      project = null;
    }
    if (!project) return Response.json({ error: 'Project not found.' }, { status: 404 });

    const domain = normalizeDomain(project.domain);
    if (!domain) return Response.json({ error: 'This project has no valid domain.' }, { status: 400 });

    const naked = domain.startsWith('www.') ? domain.slice(4) : domain;
    const probeUrls = [...new Set([`https://${domain}`, `https://www.${naked}`, `http://${domain}`])];

    const siteTarget = escapeRe(domain) + (project.project_id ? `|${escapeRe(project.project_id)}` : '');
    const snippetA = new RegExp(
      `<script[^>]+src=["'][^"']*(?:t\\.js|/functions/track)[^"']*["'][^>]*data-(?:site|key)=["'](?:${siteTarget})["']`,
      'i',
    );
    const snippetB = new RegExp(
      `<script[^>]+data-(?:site|key)=["'](?:${siteTarget})["'][^>]*src=["'][^"']*(?:t\\.js|/functions/track)[^"']*["']`,
      'i',
    );

    let detail = '';
    for (const url of probeUrls) {
      try {
        const res = await fetch(url, {
          redirect: 'follow',
          signal: AbortSignal.timeout(9000),
          headers: {
            'User-Agent': 'TrafficLume-Verifier/1.0',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        });
        if (!res.ok) {
          detail = `HTTP ${res.status} from ${url}`;
          continue;
        }
        const html = (await res.text()).slice(0, 400000);
        if (snippetA.test(html) || snippetB.test(html)) {
          await base44.entities.Project.update(project.id, {
            status: 'verified',
            verified_at: new Date().toISOString(),
          });
          return Response.json({
            verified: true,
            status: 'verified',
            message: `Domain ${domain} verified. Analytics are now live.`,
          });
        }
        detail = html.includes('t.js')
          ? `A tracking script was found, but its data-site attribute does not match ${domain}.`
          : `No Traffic Lume snippet found on ${url}.`;
      } catch (error) {
        detail = error?.message || `Could not reach ${url}.`;
      }
    }

    return Response.json({
      verified: false,
      status: 'pending',
      error: `Snippet not detected on ${domain}.${detail ? ` (${detail})` : ''}`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}