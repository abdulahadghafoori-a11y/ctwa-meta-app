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
 * Derives display formatting and country from normalized digits (no + prefix).
 */
export function getPhonePresentation(digits: string): PhonePresentation {
  if (!digits) {
    return {
      formattedInternational: "",
      countryCode: null,
      countryName: null,
    };
  }

  const parsed = parsePhoneNumberFromString(`+${digits}`);
  if (!parsed) {
    return {
      formattedInternational: digits,
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
