import { FIELDS, FIELD_BY_KEY } from "@/taxonomy/fields";
import { VOCABULARIES } from "@/taxonomy/vocab";

export const money = (n: number) => `$${n.toLocaleString("en-US")}`;

/** Facts that never appear on a public profile. */
const HIDDEN = new Set(["office_location", "office_states", "excluded_states", "client_count", "assets_under_advice", "has_disclosures"]);
const isDollars = (key: string) => /(_fee|_minimum)$/.test(key);

/** Turn one confirmed fact into a label and display text, or null if it isn't shown. */
export function formatFact(key: string, value: unknown): { label: string; text: string } | null {
  const field = FIELD_BY_KEY.get(key);
  if (!field || HIDDEN.has(key) || value === null || value === undefined) return null;
  const vocab = field.vocab ? new Map<string, string>(VOCABULARIES[field.vocab].map((o) => [o.key, o.label])) : null;
  let text: string;
  if (Array.isArray(value)) {
    if (!value.length) return null;
    text = value.map((v) => (vocab?.get(String(v)) ?? String(v))).join(", ");
  } else if (typeof value === "object" && value && "min" in value && "max" in value) {
    const r = value as { min: number; max: number };
    text = r.min === r.max ? `${money(r.min)} per year` : `${money(r.min)}–${money(r.max)} per year`;
  } else if (typeof value === "number") {
    text = isDollars(key) ? money(value) : String(value);
  } else if (typeof value === "boolean") {
    text = value ? "Yes" : "No";
  } else {
    text = String(value);
  }
  return { label: field.label, text };
}

/** Confirmed facts in the registry's order, ready to show. */
export function displayFacts(facts: Record<string, unknown>) {
  return FIELDS.map((f) => (f.key in facts ? formatFact(f.key, facts[f.key]) : null)).filter((x): x is { label: string; text: string } => !!x);
}
