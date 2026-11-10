/**
 * Firms list several web addresses on Form ADV, often social media pages or
 * client-login portals. Only a firm's own site counts as its website.
 */

/** Social networks, link-in-bio pages and video sites. */
const SOCIAL = [
  "linkedin.com", "lnkd.in", "facebook.com", "fb.com", "fb.me", "twitter.com", "x.com", "instagram.com", "youtube.com", "youtu.be",
  "tiktok.com", "threads.net", "pinterest.com", "vimeo.com", "medium.com", "substack.com", "yelp.com", "linktr.ee", "bsky.app",
  "spotify.com", "podcasts.apple.com", "google.com", "goo.gl", "g.page",
];
/** Client portals and directories that belong to vendors, not the firm. */
const NOT_THE_FIRM = [
  "tamaracinc.com", "orionadvisor.com", "orionportal.com", "blackdiamond.com", "advent.com", "wealthbox.com", "redtailtechnology.com",
  "emoneyadvisor.com", "rightcapital.com", "moneyguidepro.com", "riskalyze.com", "nitrogenwealth.com", "schwab.com", "fidelity.com",
  "pershing.com", "adviserinfo.sec.gov", "brokercheck.finra.org", "napfa.org", "letsmakeaplan.org", "calendly.com", "bit.ly",
];

const matches = (host: string, domains: string[]) => domains.some((d) => host === d || host.endsWith(`.${d}`));

export function hostOf(url: string): string | null {
  try {
    return new URL(/^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** True for a social media page or a vendor's site (a portal, a directory, a scheduler). */
export function isNotFirmWebsite(url: string): boolean {
  const host = hostOf(url);
  return !host || !host.includes(".") || matches(host, SOCIAL) || matches(host, NOT_THE_FIRM);
}

/** The first address that is the firm's own site, or null. */
export function pickFirmWebsite(urls: (string | null)[]): string | null {
  return urls.find((u): u is string => !!u && !isNotFirmWebsite(u)) ?? null;
}
