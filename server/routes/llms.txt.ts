import { getTenant } from '../utils/tenant';

/**
 * Serves /llms.txt — a machine-readable description of the site for LLMs.
 * Content is generated per-tenant from branding, SEO, and contact config.
 *
 * See: https://llmstxt.org
 */
export default defineEventHandler(async (event) => {
  const hostname = event.context.tenant?.hostname;
  if (!hostname) {
    setResponseStatus(event, 400);
    return 'Missing tenant context';
  }

  const tenant = await getTenant(hostname, event);
  if (!tenant) {
    setResponseStatus(event, 404);
    return 'Tenant not found';
  }

  const lines: string[] = [];

  // Header
  lines.push(`# ${tenant.branding.name}`);
  lines.push('');

  // Description
  if (tenant.seo?.defaultDescription) {
    lines.push(`> ${tenant.seo.defaultDescription}`);
    lines.push('');
  }

  // Site info
  lines.push('## About');
  lines.push('');
  lines.push(`This is the online store for ${tenant.branding.name}.`);
  lines.push(`URL: https://${tenant.hostname}`);
  lines.push('');

  // Contact
  if (tenant.contact?.email || tenant.contact?.phone) {
    lines.push('## Contact');
    lines.push('');
    if (tenant.contact.email) {
      lines.push(`- Email: ${tenant.contact.email}`);
    }
    if (tenant.contact.phone) {
      lines.push(`- Phone: ${tenant.contact.phone}`);
    }
    lines.push('');
  }

  setResponseHeader(event, 'content-type', 'text/plain; charset=utf-8');
  setResponseHeader(event, 'cache-control', 'public, max-age=3600');
  return lines.join('\n');
});
