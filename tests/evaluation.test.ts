import { describe, expect, it } from "vitest";
import { compareToGold, parseMoneyToCents, validateExtraction } from "../shared/evaluation";
import { EXTRACTION_PROMPT, EXTRACTION_SCHEMA } from "../shared/schema";
import { normalizeExtraction, normalizePostalAddress } from "../shared/normalization";
import type { Extraction } from "../shared/types";

const fixture: Extraction = {
  document: {
    property: "WSIL-TV",
    tv_address: null,
    advertiser: "Committee to Elect Mike Carr",
    agency: "Committee to Elect Mike Carr",
    product: "Mike Carr for Jackson Co States Atty",
    contract_num: "14086",
    flight_from: "03/03/20",
    flight_to: "03/03/20",
    gross_amount: "$600.00",
  },
  line_items: [
    {
      channel: "3",
      program_desc: "Tuesday Prime Other Your Voice Your Vote",
      program_start_date: "03/03/20",
      program_end_date: "03/03/20",
      sub_amount: "$600.00",
    },
  ],
};

describe("deterministic evaluation", () => {
  it("keeps contact fields out of the station postal address", () => {
    expect(
      normalizePostalAddress(
        "505 Rutherford Street Greenville, SC 29609 Main: (864)242-4404 Billing: (407)389-7661",
      ),
    ).toBe("505 Rutherford Street Greenville, SC 29609");
    expect(normalizePostalAddress("14 Main Street Greenville, SC 29609")).toBe(
      "14 Main Street Greenville, SC 29609",
    );

    const normalized = normalizeExtraction({
      ...fixture,
      document: {
        ...fixture.document,
        tv_address: "505 Rutherford Street Greenville, SC 29609 Fax: (864)242-4404",
      },
    });
    expect(normalized.document.tv_address).toBe(
      "505 Rutherford Street Greenville, SC 29609",
    );
  });

  it("parses signed and parenthesized money", () => {
    expect(parseMoneyToCents("$600.00")).toBe(60000);
    expect(parseMoneyToCents("($12.50)")).toBe(-1250);
    expect(parseMoneyToCents("$19.845.00")).toBeNull();
  });

  it("accepts the complete baseline fixture", () => {
    expect(validateExtraction(fixture)).toMatchObject({
      schemaValid: true,
      route: "accept",
      reconciliation: "match",
    });
  });

  it("routes missing critical fields to review", () => {
    const sparse = structuredClone(fixture);
    sparse.document.contract_num = null;
    expect(validateExtraction(sparse)).toMatchObject({
      route: "review",
      missingCritical: ["contract_num"],
    });
  });

  it("keeps the order-ingestion field contract explicit", () => {
    expect(
      EXTRACTION_SCHEMA.properties.document.properties.property.description,
    ).toContain("Prefer that entity name over a logo");
    expect(
      EXTRACTION_SCHEMA.properties.document.properties.tv_address.description,
    ).toContain("postal address only");
    expect(EXTRACTION_PROMPT).toContain(
      "Do not use a logo, market label, network affiliation, or call sign when that entity name is present",
    );
    expect(EXTRACTION_SCHEMA.properties.document.properties.contract_num.description).toContain(
      "Do not use an Invoice #",
    );
    expect(
      EXTRACTION_SCHEMA.properties.document.properties.gross_amount.description.toLowerCase(),
    ).toContain("do not substitute net total");
    expect(EXTRACTION_PROMPT).toContain(
      "When both Order # and Invoice # are present, use Order #",
    );
  });

  it("reviews a net-only invoice without inferring gross", () => {
    const invoice = structuredClone(fixture);
    invoice.document.contract_num = "1390338";
    invoice.document.gross_amount = null;
    invoice.line_items[0].sub_amount = "$500.00";

    expect(validateExtraction(invoice)).toMatchObject({
      route: "review",
      missingCritical: ["gross_amount"],
      reconciliation: "not_applicable",
    });
  });

  it("keeps sparse rows in row review without blocking header auto-accept", () => {
    const sparseRows = structuredClone(fixture);
    sparseRows.line_items[0].program_desc = null;
    sparseRows.line_items[0].sub_amount = null;

    expect(validateExtraction(sparseRows)).toMatchObject({
      route: "accept",
      rowShapeValid: false,
      reasons: [],
    });
  });

  it("scores normalized exact output and respects exclusions", () => {
    const predicted = structuredClone(fixture);
    predicted.document.property = "  WSIL-TV ";
    const score = compareToGold(predicted, fixture, ["tv_address"]);
    expect(score.fieldPassRate).toBe(1);
    expect(score.lineItemF1).toBe(1);
    expect(score.matchedRowLeafAccuracy).toBe(1);
    expect(score.scoredHeaderFields).toBe(8);
  });

  it("keeps source-conflicted row labels out of aggregate scoring", () => {
    const score = compareToGold(
      fixture,
      fixture,
      [],
      false,
      "Source labels conflict with the visible table.",
    );
    expect(score.lineItemsScored).toBe(false);
    expect(score.lineItemScoreExclusionReason).toBe(
      "Source labels conflict with the visible table.",
    );
    expect(score.fieldPassRate).toBe(1);
  });

  it("uses VRDU type-specific field comparators", () => {
    const predicted = structuredClone(fixture);
    predicted.document.property = "WSIL TV";
    predicted.document.contract_num = "Order 14-086";
    predicted.document.gross_amount = "600";
    const score = compareToGold(predicted, fixture);
    expect(score.fieldRows.find((row) => row.field === "property")?.passed).toBe(true);
    expect(score.fieldRows.find((row) => row.field === "contract_num")?.passed).toBe(true);
    expect(score.fieldRows.find((row) => row.field === "gross_amount")?.passed).toBe(true);
  });

  it("treats an invoice suffix as a different identifier", () => {
    const gold = structuredClone(fixture);
    gold.document.contract_num = "1390338";
    const predicted = structuredClone(gold);
    predicted.document.contract_num = "1390338-4";

    const score = compareToGold(predicted, gold);
    expect(score.fieldRows.find((row) => row.field === "contract_num")?.passed).toBe(false);
  });
});
