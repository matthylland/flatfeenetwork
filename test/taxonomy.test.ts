import { describe, expect, it } from "vitest";
import { VOCABULARIES } from "@/taxonomy/vocab";
import { FIELDS, FIELD_BY_KEY, validateFactValue } from "@/taxonomy/fields";
import { PAID_QUESTIONS, PROSPECT_QUESTIONS } from "@/questions";

describe("taxonomy", () => {
  it("has unique keys in every vocabulary", () => {
    for (const [name, list] of Object.entries(VOCABULARIES)) {
      const keys = list.map((o) => o.key);
      expect(new Set(keys).size, name).toBe(keys.length);
    }
  });

  it("has about 40 niches", () => {
    expect(VOCABULARIES.niches.length).toBeGreaterThanOrEqual(38);
  });

  it("has unique field keys", () => {
    expect(FIELD_BY_KEY.size).toBe(FIELDS.length);
  });

  it("lets an advisor offer advice only, investment management, or both", () => {
    expect(validateFactValue("offering_models", ["advice_only"]).success).toBe(true);
    expect(validateFactValue("offering_models", ["advice_only", "investment_management"]).success).toBe(true);
    expect(validateFactValue("offering_models", []).success).toBe(false);
    expect(validateFactValue("offering_models", ["commission_sales"]).success).toBe(false);
  });

  it("rejects values outside the vocabulary and unknown fields", () => {
    expect(validateFactValue("top_niches", ["physicians", "dentists", "pilots", "teachers"]).success).toBe(false);
    expect(validateFactValue("tax_depth", 5).success).toBe(false);
    expect(validateFactValue("not_a_field", 1).success).toBe(false);
    expect(validateFactValue("annual_fee_range", { min: 6000, max: 4000 }).success).toBe(false);
  });

  it("never uses the advisor's state as a filter", () => {
    expect(FIELD_BY_KEY.get("office_states")?.use).toBe("display");
  });
});

describe("questions", () => {
  const all = [...PROSPECT_QUESTIONS, ...PAID_QUESTIONS];

  it("has unique question keys", () => {
    const keys = all.map((q) => q.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("only targets fields that exist", () => {
    for (const q of PAID_QUESTIONS) for (const f of q.targetFields) expect(FIELD_BY_KEY.has(f), `${q.key} -> ${f}`).toBe(true);
  });

  it("only branches on earlier prospect questions", () => {
    PROSPECT_QUESTIONS.forEach((q, i) => {
      if (!q.showIf) return;
      const parent = PROSPECT_QUESTIONS.findIndex((p) => p.key === q.showIf!.questionKey);
      expect(parent).toBeGreaterThanOrEqual(0);
      expect(parent).toBeLessThan(i);
    });
  });
});
