/**
 * Subdomain Router for Wake Up & Produce
 * 
 * Routes subdomain requests to the correct path within the
 * same Cloudflare Pages project.
 * 
 * sports.wakeupandproduce.com  → /sports/
 * tools.wakeupandproduce.com   → /tools/
 * recovery.wakeupandproduce.com → /recovery/
 * merch.wakeupandproduce.com   → /merch/  (which redirects to elegantfutures.com)
 */

const SUBDOMAIN_MAP = {
  'sports': '/sports',
  'tools': '/tools',
  'recovery': '/recovery',
  'merch': '/merch',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const hostname = url.hostname;

    // Extract subdomain (e.g. "sports" from "sports.wakeupandproduce.com")
    const parts = hostname.split('.');
    const subdomain = parts.length > 2 ? parts[0] : null;

    // If it's a known subdomain, rewrite the path
    if (subdomain && SUBDOMAIN_MAP[subdomain]) {
      const prefix = SUBDOMAIN_MAP[subdomain];
      // Avoid double-prefixing if path already starts with the prefix
      if (!url.pathname.startsWith(prefix + '/') && url.pathname !== prefix) {
        url.pathname = prefix + url.pathname;
      }
      // Rewrite to the main domain so Pages serves it
      url.hostname = 'wakeupandproduce.com';
      return fetch(url.toString(), request);
    }

    // Not a mapped subdomain — pass through
    return fetch(request);
  }
};
