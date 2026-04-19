import {
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";

function envDefaultCountry(): CountryCode | undefined {
  const c = (
    process.env.PHONE_DEFAULT_COUNTRY ??
    process.env.NEXT_PUBLIC_PHONE_DEFAULT_COUNTRY
  )
    ?.trim()
    .toUpperCase();
  if (!c || c.length !== 2) return undefined;
  return c as CountryCode;
}

function asCountryCode(v: string | null | undefined): CountryCode | undefined {
  if (!v || v.length !== 2) return undefined;
  return v.toUpperCase() as CountryCode;
}

/**
 * Canonical E.164 with leading `+` for storage and unique keys.
 * Uses `contact.created`-style `countryCode` when provided; else `PHONE_DEFAULT_COUNTRY`; else tries `+{digits}`.
 */
export function parseToE164(
  raw: string,
  hintCountry?: string | null,
): string | null {
  const trimmed = raw.trim().replace(/\s/g, "");
  if (!trimmed) return null;

  let parsed = parsePhoneNumberFromString(trimmed);
  if (parsed?.isValid()) return parsed.format("E.164");

  const hint = asCountryCode(hintCountry ?? undefined);
  if (hint) {
    parsed = parsePhoneNumberFromString(trimmed, hint);
    if (parsed?.isValid()) return parsed.format("E.164");
  }

  const dc = envDefaultCountry();
  if (dc) {
    parsed = parsePhoneNumberFromString(trimmed, dc);
    if (parsed?.isValid()) return parsed.format("E.164");
  }

  const digits = trimmed.replace(/\D/g, "");
  if (digits) {
    parsed = parsePhoneNumberFromString(`+${digits}`);
    if (parsed?.isValid()) return parsed.format("E.164");
  }

  return null;
}

/** Digits only (no +), for Meta `ph` hashing and loose checks. */
export function e164ToDigits(e164: string): string {
  return e164.replace(/\D/g, "");
}

export function isValidE164Input(raw: string): boolean {
  return parseToE164(raw) !== null;
}
