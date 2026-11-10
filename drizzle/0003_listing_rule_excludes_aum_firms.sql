-- Listing rule (Matt, 2026-11-10): firms that check the percentage-of-assets
-- fee box get an automatic listing only if they report no assets under
-- management. Same rule as isFlatFeeCandidate() in src/adv/parse.ts.
-- Their unclaimed listings stay in the table but stop showing; claimed
-- profiles are unaffected.
UPDATE "firms"
SET "flat_fee_candidate" = (
      (("fee_flags"->>'fixed')::boolean OR ("fee_flags"->>'hourly')::boolean OR ("fee_flags"->>'subscription')::boolean)
      AND (NOT ("fee_flags"->>'pctAum')::boolean OR coalesce("assets_under_management", 0) = 0)
    ),
    "updated_at" = now();
