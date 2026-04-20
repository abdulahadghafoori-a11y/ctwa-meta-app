-- WhatsApp Business Account id from YCloud inbound (wabaId); used for Meta CAPI user_data.
ALTER TABLE "ctwa_sessions" ADD COLUMN IF NOT EXISTS "waba_id" text;
