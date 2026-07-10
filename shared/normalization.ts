import type { Extraction, NullableText } from "./types";

export const NORMALIZATION_VERSION = "org-name-address-v2" as const;

const ADDRESS_CONTACT_SUFFIX =
  /\s+(?:main|billing|office|phone|telephone|tel|fax|facsimile|email|e-mail)\s*(?:#|number)?\s*:/i;

/** Trailing street block glued onto an org name (common on Katz agency stacks). */
const ORG_ADDRESS_TAIL =
  /\s+\d{1,6}\s+[A-Za-z0-9.'\-]+(?:\s+[A-Za-z0-9.'\-]+){0,8}\s+(?:Avenue|Ave\.?|Street|St\.?|Road|Rd\.?|Boulevard|Blvd\.?|Drive|Dr\.?|Lane|Ln\.?|Way|Court|Ct\.?|Place|Pl\.?|Highway|Hwy\.?|Parkway|Pkwy\.?)\b[\s\S]*$/i;

/** Extra evidence required before treating a street-like tail as an address. */
const ADDRESS_TAIL_EVIDENCE =
  /\b\d{5}(?:-\d{4})?\b|\b(?:[Ss]uite|[Ss]te|[Ff]loor|[Ff]l)\b\.?\s*#?\s*\w|,\s*[A-Z]{2}\b/;

export function normalizePostalAddress(value: NullableText): NullableText {
  if (value === null) return null;
  const contactSuffix = value.match(ADDRESS_CONTACT_SUFFIX);
  if (!contactSuffix || contactSuffix.index === undefined) return value;
  const address = value.slice(0, contactSuffix.index).trim().replace(/[;,]+$/, "").trim();
  return address || value;
}

export function stripTrailingOrgAddress(value: NullableText): NullableText {
  if (value === null) return null;
  const match = value.match(ORG_ADDRESS_TAIL);
  if (!match || match.index === undefined) return value;
  // A street-shaped phrase alone is not enough: names like "Route 66 Media" or
  // "600 Block Street Films" must survive. Require a zip, suite, or state token.
  if (!ADDRESS_TAIL_EVIDENCE.test(match[0])) return value;
  const name = value.slice(0, match.index).trim().replace(/[;,]+$/, "").trim();
  return name || value;
}

export function normalizeExtraction(value: Extraction): Extraction {
  return {
    document: {
      ...value.document,
      tv_address: normalizePostalAddress(value.document.tv_address),
      agency: stripTrailingOrgAddress(value.document.agency),
      advertiser: stripTrailingOrgAddress(value.document.advertiser),
    },
    line_items: value.line_items.map((row) => ({ ...row })),
  };
}
