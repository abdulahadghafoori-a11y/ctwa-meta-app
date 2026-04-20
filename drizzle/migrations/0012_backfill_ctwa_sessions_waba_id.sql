-- One-time backfill: sessions created before waba_id was populated (or missing in webhook).
-- Forks with a different WABA should edit or skip this migration.
UPDATE "ctwa_sessions"
SET "waba_id" = '1413787536842677'
WHERE "waba_id" IS NULL OR trim("waba_id") = '';
