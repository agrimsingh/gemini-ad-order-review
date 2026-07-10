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
            "Broadcast station or media property the buy is for. Prefer an explicitly labeled Station or Property value. Otherwise prefer the legal station/entity printed beside the postal address over a logo, market label, network affiliation, or call sign. Use a call sign only when no better name is printed. Do not use a national rep-firm letterhead (for example Katz) when a station call sign or Station field is present.",
        },
        tv_address: {
          type: ["string", "null"],
          description:
            "Document postal address only, with line breaks collapsed to spaces. Use the printed street address on the form even when it sits under a rep-firm or agency letterhead rather than beside the station name. Exclude the station or company name, logo text, market label, network affiliation, and call sign. Return null only when no postal address is printed.",
        },
        advertiser: {
          type: ["string", "null"],
          description:
            "Advertiser or organization purchasing the advertising. Organization name only — exclude street address, city/state/ZIP, and phone numbers printed under the name. Keep a code printed with the name, such as a trailing parenthetical number.",
        },
        agency: {
          type: ["string", "null"],
          description:
            "Media buying agency name only. Do not substitute the advertiser. Exclude street address, city/state/ZIP, and phone numbers printed under the agency name. Keep a code printed with the name, such as a trailing parenthetical number.",
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
          channel: {
            type: ["string", "null"],
            description:
              "Station, market, feed, or call-sign style channel for this schedule row when that concept is printed (for example WFRV, Flint (WSMH), or 3). Do not use revision/makegood codes, daypart-only text, program names, rates, or spot counts. Return null when the row has no channel/station column.",
          },
          program_desc: {
            type: ["string", "null"],
            description: "Program or placement description printed on the schedule row.",
          },
          program_start_date: {
            type: ["string", "null"],
            description:
              "Start date printed in an explicit date cell on this schedule row. Do not use overall Flight dates, week-band column headers (for example 5/19 - 5/19), or spot-count cells under those headers.",
          },
          program_end_date: {
            type: ["string", "null"],
            description:
              "End date printed in an explicit date cell on this schedule row. Do not use overall Flight dates, week-band column headers, or spot-count cells under those headers.",
          },
          sub_amount: {
            type: ["string", "null"],
            description: "Row amount or total printed for this schedule row, exactly as shown.",
          },
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
4. For property, prefer an explicitly labeled Station or Property value. Otherwise prefer the legal station or media-property entity printed beside its postal address. Do not use a logo, market label, network affiliation, or call sign when that entity name is present. Do not substitute a national rep-firm letterhead (for example Katz) for the station when a Station field or call sign is present. For tv_address, return the printed postal address on the document even when it appears under a rep-firm or agency letterhead and even when property comes from a separate Station field. Exclude the entity name and branding from tv_address. Do not return null for tv_address merely because the address belongs to the letterhead entity rather than the station. For agency and advertiser, return the organization name only; never append the street address, city/state/ZIP, or phone block printed under that name. Keep a code printed as part of the name itself, such as a trailing parenthetical number like (3373) — that code belongs to the recorded name and must not be dropped.
5. contract_num means the underlying media-buy identifier: use a value explicitly labeled Contract #; otherwise use a value explicitly labeled Order #. When both Order # and Invoice # are present, use Order #. Never populate contract_num from Invoice # alone. Keep the selected value as a string so leading zeros survive.
6. gross_amount means an explicit Gross Amount, Contract Amount, or Grand Total on an order or contract. For a credit memo, use the explicit credit amount. Do not substitute Net Total, Invoice Total, a line-item subtotal, or a calculated sum. Return null when no qualifying amount is printed.
7. Emit one line_items object per visible schedule row in reading order. Do not merge repeated rows. Use null for a missing cell. Return an empty array when no table is present. For channel, use only a station/market/feed/call-sign style value when that column exists; do not fill channel with revision or makegood codes, dayparts, program names, rates, or spot counts.
8. For program_start_date and program_end_date, use only dates printed in explicit date cells on that schedule row. Do not copy overall Flight dates into row dates. Do not treat week-band or calendar column headers (for example 5/19 - 5/19) as row dates, and do not read spot-count integers under those headers as dates. If the row has no explicit date cells, leave both dates null even when Flight or week headers are present.
9. Sparse output is preferable to filling a field with a different business concept.
10. Return only the JSON schema. Do not add confidence scores, warnings, calculations, or extra keys.`;
