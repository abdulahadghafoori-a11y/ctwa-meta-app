import { parsePhoneNumberFromString } from "libphonenumber-js";

export type PhonePresentation = {
  /** E.g. international format with spaces */
  formattedInternational: string;
  /** ISO 3166-1 alpha-2, if known */
  countryCode: string | null;
  /** English region name, if known */
  countryName: string | null;
};

/**
 * Derives display formatting and country from an E.164 value (e.g. +937…).
 */
export function getPhonePresentation(e164: string): PhonePresentation {
  if (!e164?.trim()) {
    return {
      formattedInternational: "",
      countryCode: null,
      countryName: null,
    };
  }

  const parsed = parsePhoneNumberFromString(e164.trim());
  if (!parsed) {
    return {
      formattedInternational: e164,
      countryCode: null,
      countryName: null,
    };
  }

  const cc = parsed.country ?? null;
  let countryName: string | null = null;
  if (cc) {
    try {
      countryName =
        new Intl.DisplayNames(["en"], { type: "region" }).of(cc) ?? cc;
    } catch {
      countryName = cc;
    }
  }

  return {
    formattedInternational: parsed.formatInternational(),
    countryCode: cc,
    countryName,
  };
}
