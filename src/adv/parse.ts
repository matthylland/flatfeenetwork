/**
 * Streaming parser for the SEC's Form ADV firm compilation feeds
 * (IA_FIRM_SEC_Feed / IA_FIRM_STATE_Feed XML from reports.adviserinfo.sec.gov).
 *
 * The feed is large, so each <Firm> element is collected into a small tree and
 * handed to `mapFirm`, then discarded. Element and attribute names follow the
 * feed's published layout; `mapFirm` is the only place that knows them, so a
 * format change is a one-function fix.
 */
import sax from "sax";
import type { Readable } from "node:stream";
import type { AdvFeeFlags } from "@/db/schema";
import { xmlTextDecoder } from "./decode";

export type XmlNode = { name: string; attrs: Record<string, string>; children: XmlNode[]; text: string };

export type AdvFirm = {
  crd: number;
  secNumber: string | null;
  name: string;
  legalName: string | null;
  website: string | null;
  phone: string | null;
  street1: string | null;
  street2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  registrationType: "sec" | "state" | "unknown";
  registeredStates: string[];
  noticeFiledStates: string[];
  feeFlags: AdvFeeFlags;
  flatFeeCandidate: boolean;
  assetsUnderManagement: number | null;
  clientCount: number | null;
  employeeCount: number | null;
  hasDisclosures: boolean | null;
  advFilingDate: string | null;
};

/** Stream firms out of a feed. Calls `onFirm` for each; errors in one firm don't stop the rest. */
export function parseAdvFeed(
  input: Readable,
  onFirm: (firm: AdvFirm) => void | Promise<void>,
  onError: (message: string) => void = () => {},
): Promise<{ seen: number }> {
  return new Promise((resolve, reject) => {
    const parser = sax.createStream(true, { trim: true });
    const stack: XmlNode[] = [];
    let seen = 0;
    let pending: Promise<void> = Promise.resolve();

    parser.on("opentag", (tag) => {
      const attrs: Record<string, string> = {};
      for (const [k, v] of Object.entries(tag.attributes)) attrs[k] = String(v);
      const node: XmlNode = { name: tag.name, attrs, children: [], text: "" };
      if (stack.length) stack[stack.length - 1].children.push(node);
      if (tag.name === "Firm" || stack.length) stack.push(node);
    });
    parser.on("text", (t) => {
      if (stack.length) stack[stack.length - 1].text += t;
    });
    parser.on("cdata", (t) => {
      if (stack.length) stack[stack.length - 1].text += t;
    });
    parser.on("closetag", (name) => {
      if (!stack.length) return;
      const node = stack.pop()!;
      if (name === "Firm" && stack.length === 0) {
        seen++;
        try {
          const firm = mapFirm(node);
          pending = pending.then(() => onFirm(firm));
        } catch (err) {
          onError(`firm #${seen}: ${(err as Error).message}`);
        }
      }
    });
    parser.on("error", reject);
    parser.on("end", () => pending.then(() => resolve({ seen }), reject));
    // Decode bytes ourselves (the SEC feeds are ISO-8859-1) and hand sax text.
    const text = input.pipe(xmlTextDecoder());
    text.setEncoding("utf8");
    text.on("error", reject);
    input.on("error", reject);
    text.on("data", (chunk: string) => parser.write(chunk));
    text.on("end", () => parser.end());
  });
}

const find = (n: XmlNode, name: string): XmlNode | undefined => {
  for (const c of n.children) {
    if (c.name === name) return c;
    const deep = find(c, name);
    if (deep) return deep;
  }
  return undefined;
};
const findAll = (n: XmlNode, name: string, out: XmlNode[] = []): XmlNode[] => {
  for (const c of n.children) {
    if (c.name === name) out.push(c);
    findAll(c, name, out);
  }
  return out;
};
const str = (v: string | undefined) => (v && v.trim() ? v.trim() : null);
const yes = (v: string | undefined) => v?.trim().toUpperCase() === "Y";
const int = (v: string | undefined) => {
  if (!v) return null;
  const n = Number(v.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && v.trim() !== "" ? Math.round(n) : null;
};
/** Firms sometimes type a dollar amount into a count box; treat absurd counts as unknown. */
const MAX_COUNT = 10_000_000;
const count = (v: string | undefined) => {
  const n = int(v);
  return n !== null && n >= 0 && n <= MAX_COUNT ? n : null;
};
const dollars = (v: string | undefined) => {
  const n = int(v);
  return n !== null && n >= 0 && Number.isSafeInteger(n) ? n : null;
};
const stateCode = (v: string | undefined) => {
  const s = str(v)?.toUpperCase();
  return s && /^[A-Z]{2}$/.test(s) ? s : null;
};
const uniq = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x))].sort();

export function mapFirm(firm: XmlNode): AdvFirm {
  const info = find(firm, "Info");
  const crd = int(info?.attrs.FirmCrdNb);
  if (!crd) throw new Error("missing FirmCrdNb");
  const name = str(info?.attrs.BusNm) ?? str(info?.attrs.LegalNm);
  if (!name) throw new Error(`CRD ${crd}: missing business name`);

  const addr = find(firm, "MainAddr");
  const filing = find(firm, "Filing");

  // SEC feed: a single <Rgstn FirmType="Registered" .../>. State feed: one
  // registration per regulator, each carrying a RgltrCd state code.
  const rgstns = findAll(firm, "Rgstn");
  const stateRgstns = [...rgstns, ...findAll(firm, "StateRgstn")].filter((r) => r.attrs.RgltrCd);
  const noticeFiled = findAll(find(firm, "NoticeFiled") ?? { name: "", attrs: {}, children: [], text: "" }, "States");
  const secRegistered = rgstns.some((r) => !r.attrs.RgltrCd && /registered/i.test(r.attrs.FirmType ?? ""));
  const secRgnCode = str(info?.attrs.SECRgnCD);

  const e = find(firm, "Item5E")?.attrs ?? {};
  const feeFlags: AdvFeeFlags = {
    pctAum: yes(e.Q5E1),
    hourly: yes(e.Q5E2),
    subscription: yes(e.Q5E3),
    fixed: yes(e.Q5E4),
    commissions: yes(e.Q5E5),
    performance: yes(e.Q5E6),
    other: yes(e.Q5E7),
    ...(str(e.Q5E7Oth) ? { otherDescription: str(e.Q5E7Oth)! } : {}),
  };

  const assetsUnderManagement = dollars(find(firm, "Item5F")?.attrs.Q5F2C);

  const item11 = find(firm, "Item11");
  const hasDisclosures = item11 ? Object.values(item11.attrs).some((v) => yes(v)) || item11.children.some((c) => Object.values(c.attrs).some((v) => yes(v))) : null;

  const website = findAll(firm, "WebAddr").map((w) => str(w.text)).find(Boolean) ?? null;

  return {
    crd,
    secNumber: str(info?.attrs.SECNb),
    name,
    legalName: str(info?.attrs.LegalNm),
    website,
    phone: str(addr?.attrs.PhNb),
    street1: str(addr?.attrs.Strt1),
    street2: str(addr?.attrs.Strt2),
    city: str(addr?.attrs.City),
    state: stateCode(addr?.attrs.State),
    postalCode: str(addr?.attrs.PostlCd),
    country: str(addr?.attrs.Cntry),
    registrationType: secRegistered || secRgnCode ? "sec" : stateRgstns.length ? "state" : "unknown",
    registeredStates: uniq(stateRgstns.map((r) => stateCode(r.attrs.RgltrCd))),
    noticeFiledStates: uniq(noticeFiled.map((s) => stateCode(s.attrs.RgltrCd))),
    feeFlags,
    flatFeeCandidate: isFlatFeeCandidate(feeFlags, assetsUnderManagement),
    assetsUnderManagement,
    clientCount: count(find(firm, "Item5C")?.attrs.Q5C1),
    employeeCount: count(find(firm, "Item5A")?.attrs.TtlEmp),
    hasDisclosures,
    advFilingDate: str(filing?.attrs.Dt),
  };
}

/**
 * Who gets an automatic (unclaimed) listing. Flat fee = any fee that is not a
 * percentage of assets, so the firm must file fixed, hourly or subscription
 * fees. Matt decided (2026-11-10) that firms which also check the
 * percentage-of-assets box are listed only if they report no assets under
 * management: most firms with real AUM charge mainly on assets. Those firms
 * can still claim a profile and be listed after review.
 */
export function isFlatFeeCandidate(f: AdvFeeFlags, assetsUnderManagement: number | null = null): boolean {
  const flatFee = f.fixed || f.hourly || f.subscription;
  return flatFee && (!f.pctAum || !assetsUnderManagement);
}
