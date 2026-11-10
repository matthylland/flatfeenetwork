import { createReadStream } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseAdvFeed, type AdvFirm } from "@/adv/parse";
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
    expect(f.flatFeeCandidate).toBe(true);
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

describe("slugFor", () => {
  it("makes a stable, URL-safe slug", () => {
    expect(slugFor({ name: "Smith & Jones Financial, LLC", crd: 42 })).toBe("smith-jones-financial-llc-42");
  });
});
