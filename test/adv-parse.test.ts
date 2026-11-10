import { createReadStream } from "node:fs";
import { describe, expect, it } from "vitest";
import { isFlatFeeCandidate, parseAdvFeed, type AdvFirm } from "@/adv/parse";
import { slugFor } from "@/adv/import";

async function parseFixture() {
  const firms: AdvFirm[] = [];
  const errors: string[] = [];
  const { seen } = await parseAdvFeed(createReadStream("test/fixtures/adv-sample.xml"), (f) => void firms.push(f), (e) => errors.push(e));
  return { firms, errors, seen };
}

describe("parseAdvFeed", () => {
  it("reads every firm and reports bad ones without stopping", async () => {
    const { firms, errors, seen } = await parseFixture();
    expect(seen).toBe(4);
    expect(firms.map((f) => f.crd)).toEqual([100001, 100002, 100003]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/missing FirmCrdNb/);
  });

  it("maps an SEC-registered firm", async () => {
    const f = (await parseFixture()).firms[0];
    expect(f).toMatchObject({
      name: "Example Planning LLC",
      secNumber: "801-00001",
      website: "https://example-planning.test",
      city: "Austin",
      state: "TX",
      postalCode: "78701",
      registrationType: "sec",
      noticeFiledStates: ["CA", "TX"],
      assetsUnderManagement: 185_000_000,
      clientCount: 120,
      employeeCount: 4,
      hasDisclosures: false,
      advFilingDate: "2026-03-28",
    });
    expect(f.feeFlags).toMatchObject({ pctAum: true, fixed: true, hourly: false });
    // Checks the percentage-of-assets box and manages real assets: no automatic listing.
    expect(f.flatFeeCandidate).toBe(false);
  });

  it("maps a state-registered firm and normalizes state codes", async () => {
    const f = (await parseFixture()).firms[1];
    expect(f.registrationType).toBe("state");
    expect(f.registeredStates).toEqual(["CO", "WY"]);
    expect(f.state).toBe("CO");
    expect(f.feeFlags.otherDescription).toBe("Project-based plans");
    expect(f.flatFeeCandidate).toBe(true);
    expect(f.hasDisclosures).toBe(true);
  });

  it("does not treat an AUM-only firm as flat fee", async () => {
    const f = (await parseFixture()).firms[2];
    expect(f.flatFeeCandidate).toBe(false);
  });
});

describe("isFlatFeeCandidate", () => {
  const none = { pctAum: false, hourly: false, subscription: false, fixed: false, commissions: false, performance: false, other: false };
  it("lists flat-fee firms that don't charge on assets, or that check the box but manage nothing", () => {
    expect(isFlatFeeCandidate({ ...none, fixed: true }, 5_000_000)).toBe(true);
    expect(isFlatFeeCandidate({ ...none, hourly: true, pctAum: true }, 0)).toBe(true);
    expect(isFlatFeeCandidate({ ...none, subscription: true, pctAum: true }, null)).toBe(true);
  });
  it("leaves out firms with real assets under management that charge on assets, and firms with no flat fee", () => {
    expect(isFlatFeeCandidate({ ...none, fixed: true, pctAum: true }, 185_000_000)).toBe(false);
    expect(isFlatFeeCandidate({ ...none, other: true }, 0)).toBe(false);
  });
});

describe("slugFor", () => {
  it("makes a stable, URL-safe slug", () => {
    expect(slugFor({ name: "Smith & Jones Financial, LLC", crd: 42 })).toBe("smith-jones-financial-llc-42");
  });
});

describe("feed encoding", () => {
  it("reads an ISO-8859-1, gzipped feed like the SEC publishes", async () => {
    const { openFeed } = await import("@/adv/import");
    const firms: AdvFirm[] = [];
    const { seen } = await parseAdvFeed(await openFeed("test/fixtures/adv-latin1.xml.gz"), (f) => void firms.push(f));
    expect(seen).toBe(1);
    expect(firms[0].name).toBe("Café Français Planning");
    expect(firms[0].city).toBe("San José");
  });

  it("reads the encoding from the XML declaration", async () => {
    const { declaredEncoding } = await import("@/adv/decode");
    expect(declaredEncoding('<?xml version="1.0" encoding="ISO-8859-1"?><a/>')).toBe("ISO-8859-1");
    expect(declaredEncoding("<?xml version='1.0'?><a/>")).toBeNull();
    expect(declaredEncoding("<a/>")).toBeNull();
  });

  it("treats an absurd count as unknown but keeps large asset totals", async () => {
    const firms: AdvFirm[] = [];
    await parseAdvFeed(createReadStream("test/fixtures/adv-bad-values.xml"), (f) => void firms.push(f));
    expect(firms[0]).toMatchObject({ crd: 200001, clientCount: null, employeeCount: 12, assetsUnderManagement: 2356471235 });
  });
});
