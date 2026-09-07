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
  'learn': '/learn',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const hostname = url.hostname;

    // Serve the standalone calculator Worker from the main site's tool path.
    // The calculator app expects to run from `/`, so remove the public prefix
    // before proxying it to the Worker.
    const calculatorPrefix = hostname === 'tools.wakeupandproduce.com'
      ? '/consultant-calculator'
      : '/tools/calculator';
    if (
      (hostname === 'wakeupandproduce.com' || hostname === 'tools.wakeupandproduce.com') &&
      (url.pathname === calculatorPrefix || url.pathname.startsWith(`${calculatorPrefix}/`))
    ) {
      url.pathname = url.pathname.slice(calculatorPrefix.length) || '/';
      url.hostname = 'consultant-calculator.media-930.workers.dev';
      return fetch(url.toString(), request);
    }

    // Keep Segment Timer at its Tools subdomain path while serving its static
    // assets from the dedicated Pages project.
    const segmentTimerPrefix = '/segment-timer';
    if (
      hostname === 'tools.wakeupandproduce.com' &&
      (url.pathname === segmentTimerPrefix || url.pathname.startsWith(`${segmentTimerPrefix}/`))
    ) {
      url.pathname = url.pathname.slice(segmentTimerPrefix.length) || '/';
      url.hostname = 'segment-timer.pages.dev';
      return fetch(url.toString(), request);
    }

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
