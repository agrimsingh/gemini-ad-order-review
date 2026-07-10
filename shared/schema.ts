export const EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    document: {
      type: "object",
      additionalProperties: false,
      properties: {
        property: {
          type: ["string", "null"],
          description:
            "Legal station or media-property name printed with the station address. Prefer that entity name over a logo, market label, network affiliation, or call sign. Use a call sign only when no entity name is printed.",
        },
        tv_address: {
          type: ["string", "null"],
          description:
            "Station postal address only, with line breaks collapsed to spaces. Exclude the station or company name, logo text, market label, network affiliation, and call sign.",
        },
        advertiser: {
          type: ["string", "null"],
          description: "Advertiser or organization purchasing the advertising.",
        },
        agency: {
          type: ["string", "null"],
          description: "Media buying agency. Do not substitute the advertiser.",
        },
        product: {
          type: ["string", "null"],
          description: "Product, campaign, issue, or advertised subject.",
        },
        contract_num: {
          type: ["string", "null"],
          description:
            "Underlying media-buy identifier. Use an explicit Contract #; otherwise use an explicit Order #. Do not use an Invoice #, even when it is the only identifier shown.",
        },
        flight_from: {
          type: ["string", "null"],
          description: "Overall campaign start date exactly as shown.",
        },
        flight_to: {
          type: ["string", "null"],
          description: "Overall campaign end date exactly as shown.",
        },
        gross_amount: {
          type: ["string", "null"],
          description:
            "Explicit Gross Amount, Contract Amount, or Grand Total on an order or contract, exactly as printed. For a credit memo, use the explicit credit amount. Do not substitute Net Total, Invoice Total, or a calculated sum.",
        },
      },
      required: [
        "property",
        "tv_address",
        "advertiser",
        "agency",
        "product",
        "contract_num",
        "flight_from",
        "flight_to",
        "gross_amount",
      ],
    },
    line_items: {
      type: "array",
      description: "Visible schedule rows in document reading order.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          channel: { type: ["string", "null"] },
          program_desc: { type: ["string", "null"] },
          program_start_date: { type: ["string", "null"] },
          program_end_date: { type: ["string", "null"] },
          sub_amount: { type: ["string", "null"] },
        },
        required: [
          "channel",
          "program_desc",
          "program_start_date",
          "program_end_date",
          "sub_amount",
        ],
      },
    },
  },
  required: ["document", "line_items"],
} as const;

export const EXTRACTION_PROMPT = `You extract structured fields from visually rich broadcast advertising documents.

Rules:
1. Extract only values visibly present in the supplied PDF.
2. Return null for an absent, illegible, or genuinely ambiguous value. Never infer from context, arithmetic, nearby documents, or common industry patterns.
3. Preserve source wording and formatting for identifiers, dates, and money. Collapse repeated whitespace and line breaks to a single space, but do not convert date formats, remove currency symbols, calculate totals, or rewrite negative amounts.
4. For property, prefer the legal station or media-property entity printed beside its postal address. Do not use a logo, market label, network affiliation, or call sign when that entity name is present. For tv_address, return only the postal address and exclude the entity name and branding.
5. contract_num means the underlying media-buy identifier: use a value explicitly labeled Contract #; otherwise use a value explicitly labeled Order #. When both Order # and Invoice # are present, use Order #. Never populate contract_num from Invoice # alone. Keep the selected value as a string so leading zeros survive.
6. gross_amount means an explicit Gross Amount, Contract Amount, or Grand Total on an order or contract. For a credit memo, use the explicit credit amount. Do not substitute Net Total, Invoice Total, a line-item subtotal, or a calculated sum. Return null when no qualifying amount is printed.
7. Emit one line_items object per visible schedule row in reading order. Do not merge repeated rows. Use null for a missing cell. Return an empty array when no table is present.
8. Do not copy overall flight dates into row dates unless printed in that row.
9. Sparse output is preferable to filling a field with a different business concept.
10. Return only the JSON schema. Do not add confidence scores, warnings, calculations, or extra keys.`;
