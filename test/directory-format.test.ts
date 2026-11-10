import { describe, expect, it } from "vitest";
import { displayFacts, formatFact } from "@/directory/format";
import { advFeeTypes } from "@/directory/profiles";

describe("profile fact display", () => {
  it("formats ranges, dollars, vocab lists and booleans", () => {
    expect(formatFact("annual_fee_range", { min: 4000, max: 6000 })).toEqual({ label: "Annual fee range", text: "$4,000–$6,000 per year" });
    expect(formatFact("asset_minimum", 250000)?.text).toBe("$250,000");
    expect(formatFact("offering_models", ["advice_only"])?.text).toMatch(/advice/i);
    expect(formatFact("prepares_returns", true)?.text).toBe("Yes");
  });

  it("never shows location, excluded states or unknown fields", () => {
    expect(formatFact("office_location", { lat: 1, lng: 2, zip: "78701" })).toBeNull();
    expect(formatFact("excluded_states", ["TX"])).toBeNull();
    expect(formatFact("not_a_field", "x")).toBeNull();
  });

  it("orders facts by the field registry", () => {
    const shown = displayFacts({ tax_depth: 3, annual_fee_range: { min: 1, max: 1 } });
    expect(shown.map((f) => f.label)).toEqual(["Annual fee range", "Tax planning depth (1–4)"]);
  });

  it("describes ADV fee types in plain words", () => {
    expect(advFeeTypes({ fixed: true, hourly: false, subscription: true, pctAum: true })).toEqual(["Fixed fees", "Subscription fees", "Also charges a percentage of assets"]);
  });
});
