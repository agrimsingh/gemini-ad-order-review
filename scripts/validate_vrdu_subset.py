#!/usr/bin/env python3
"""Validate the generated VRDU mini pack without external dependencies."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "vrdu-mini"
SCHEMA = ROOT / "schemas" / "ad_buy_extraction.schema.json"


def json_lines(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text().splitlines() if line]


def main() -> None:
    schema = json.loads(SCHEMA.read_text())
    manifest = json_lines(DATA / "manifest.jsonl")
    combined_gold = json_lines(DATA / "gold.jsonl")
    adjudications = json.loads(
        (ROOT / "config" / "vrdu-adjudications.json").read_text()
    )

    assert len(manifest) == 12, len(manifest)
    assert len(combined_gold) == 12, len(combined_gold)
    assert len({row["document_id"] for row in manifest}) == len(manifest)
    assert {row["document_id"] for row in manifest} == {
        row["document_id"] for row in combined_gold
    }

    required_top = set(schema["required"])
    required_document = set(schema["properties"]["document"]["required"])
    required_line_item = set(
        schema["properties"]["line_items"]["items"]["required"]
    )

    pages = 0
    line_items = 0
    exclusions = 0
    scored_line_items = 0
    for row in manifest:
        document_id = row["document_id"]
        assert (DATA / "pdfs" / row["filename"]).is_file()
        gold = json.loads((DATA / "gold" / f"{document_id}.json").read_text())
        assert set(gold) == required_top
        assert set(gold["document"]) == required_document
        assert all(set(item) == required_line_item for item in gold["line_items"])
        assert len(gold["line_items"]) == row["line_item_count"]
        assert set(row["score_excluded_fields"]) == set(
            row["ambiguous_header_fields"]
        )
        pages += row["page_count"]
        line_items += row["line_item_count"]
        exclusions += len(row["score_excluded_fields"])
        if row.get("score_line_items", True):
            scored_line_items += row["line_item_count"]
        else:
            assert row.get("line_item_score_exclusion_reason")

        adjudication = adjudications.get(document_id)
        if adjudication:
            for field, value in adjudication.get("document_overrides", {}).items():
                assert gold["document"][field] == value
            assert row.get("score_line_items", True) == adjudication.get(
                "score_line_items", True
            )

    assert pages == 32, pages
    assert line_items == 171, line_items
    assert exclusions == 5, exclusions
    assert scored_line_items == 107, scored_line_items
    print(
        f"Validated {len(manifest)} documents, {pages} pages, "
        f"{line_items} line items ({scored_line_items} row-scored), "
        f"and {exclusions} header score exclusions."
    )


if __name__ == "__main__":
    main()
