import type { Extraction, NullableText } from "./types";

export const NORMALIZATION_VERSION = "address-contact-v1" as const;

const ADDRESS_CONTACT_SUFFIX =
  /\s+(?:main|billing|office|phone|telephone|tel|fax|facsimile|email|e-mail)\s*(?:#|number)?\s*:/i;

export function normalizePostalAddress(value: NullableText): NullableText {
  if (value === null) return null;
  const contactSuffix = value.match(ADDRESS_CONTACT_SUFFIX);
  if (!contactSuffix || contactSuffix.index === undefined) return value;
  const address = value.slice(0, contactSuffix.index).trim().replace(/[;,]+$/, "").trim();
  return address || value;
}

export function normalizeExtraction(value: Extraction): Extraction {
  return {
    document: {
      ...value.document,
      tv_address: normalizePostalAddress(value.document.tv_address),
    },
    line_items: value.line_items.map((row) => ({ ...row })),
  };
}
