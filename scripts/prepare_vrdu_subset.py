#!/usr/bin/env python3
"""Build the fixed VRDU mini holdout used by the evaluation harness."""

from __future__ import annotations

import argparse
import gzip
import json
import re
import shutil
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any


HEADER_FIELDS = [
    "property",
    "tv_address",
    "advertiser",
    "agency",
    "product",
    "contract_num",
    "flight_from",
    "flight_to",
    "gross_amount",
]

LINE_ITEM_FIELDS = [
    "channel",
    "program_desc",
    "program_start_date",
    "program_end_date",
    "sub_amount",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "source",
        type=Path,
        help="Path to a checkout of google-research-datasets/vrdu.",
    )
    parser.add_argument(
        "--selection",
        type=Path,
        default=Path("config/vrdu-selection.json"),
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("data/vrdu-mini"),
    )
    parser.add_argument(
        "--adjudications",
        type=Path,
        default=Path("config/vrdu-adjudications.json"),
    )
    return parser.parse_args()


def clean_text(value: Any) -> str | None:
    if not value or not isinstance(value, list) or not value[0]:
        return None
    cleaned = " ".join(str(value[0]).split())
    return cleaned or None


def parse_money(value: str | None) -> Decimal | None:
    if value is None:
        return None
    compact = re.sub(r"[^0-9.()-]", "", value)
    negative = compact.startswith("(") and compact.endswith(")")
    compact = compact.strip("()")
    try:
        amount = Decimal(compact)
    except InvalidOperation:
        return None
    return -amount if negative else amount


def choose_canonical(field: str, values: list[str]) -> str | None:
    if not values:
        return None
    if field == "gross_amount":
        parseable = [value for value in values if parse_money(value) is not None]
        if parseable:
            return max(parseable, key=len)
    if field in {"flight_from", "flight_to"}:
        complete_dates = [
            value
            for value in values
            if re.search(r"\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b", value)
        ]
        if complete_dates:
            return max(complete_dates, key=len)
    return max(values, key=len)


def transform_record(record: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    header_candidates: dict[str, list[str]] = {field: [] for field in HEADER_FIELDS}
    line_items: list[dict[str, str | None]] = []

    for keys, annotation_rows in record["annotations"]:
        if isinstance(keys, str):
            if keys not in header_candidates:
                continue
            for annotation in annotation_rows:
                value = clean_text(annotation)
                if value and value not in header_candidates[keys]:
                    header_candidates[keys].append(value)
            continue

        for row in annotation_rows:
            item = {field: None for field in LINE_ITEM_FIELDS}
            for field, annotation in zip(keys, row):
                if field in item:
                    item[field] = clean_text(annotation)
            line_items.append(item)

    document = {
        field: choose_canonical(field, values)
        for field, values in header_candidates.items()
    }
    ambiguous = {
        field: values
        for field, values in header_candidates.items()
        if len(values) > 1
    }

    line_amounts = [parse_money(item["sub_amount"]) for item in line_items]
    gross_amount = parse_money(document["gross_amount"])
    if not line_items or gross_amount is None:
        amount_sum_status = "not_applicable"
    elif not all(amount is not None for amount in line_amounts):
        amount_sum_status = "partial_line_amounts"
    elif sum(line_amounts, Decimal("0")) == gross_amount:
        amount_sum_status = "matches_gross"
    else:
        amount_sum_status = "differs_from_gross"

    gold = {"document": document, "line_items": line_items}
    metadata = {
        "page_count": len(record["ocr"]["pages"]),
        "line_item_count": len(line_items),
        "present_header_fields": [
            field for field, value in document.items() if value is not None
        ],
        "missing_header_fields": [
            field for field, value in document.items() if value is None
        ],
        "ambiguous_header_fields": ambiguous,
        "score_excluded_fields": sorted(ambiguous),
        "parseable_gross_amount": gross_amount is not None,
        "line_items_with_amount": sum(amount is not None for amount in line_amounts),
        "amount_sum_status": amount_sum_status,
    }
    return gold, metadata


def main() -> None:
    args = parse_args()
    corpus_root = args.source / "ad-buy-form" / "main"
    dataset_path = corpus_root / "dataset.jsonl.gz"
    pdf_root = corpus_root / "pdfs"
    split_path = (
        args.source
        / "ad-buy-form"
        / "few_shot-splits"
        / "DeepForm-unk_template-train_10-test_294-valid_100-SD_0.json"
    )

    selection = json.loads(args.selection.read_text())
    adjudications = (
        json.loads(args.adjudications.read_text())
        if args.adjudications.exists()
        else {}
    )
    selected_by_name = {entry["filename"]: entry for entry in selection}
    split = json.loads(split_path.read_text())
    test_names = set(split["test"])
    missing_from_test = sorted(set(selected_by_name) - test_names)
    if missing_from_test:
        raise ValueError(f"Selection is not in the UTL test split: {missing_from_test}")

    records: dict[str, dict[str, Any]] = {}
    with gzip.open(dataset_path, "rt", encoding="utf-8") as handle:
        for line in handle:
            record = json.loads(line)
            if record["filename"] in selected_by_name:
                records[record["filename"]] = record

    missing_records = sorted(set(selected_by_name) - set(records))
    if missing_records:
        raise ValueError(f"Selected records missing from dataset.jsonl.gz: {missing_records}")

    pdf_output = args.output / "pdfs"
    gold_output = args.output / "gold"
    pdf_output.mkdir(parents=True, exist_ok=True)
    gold_output.mkdir(parents=True, exist_ok=True)

    manifest_rows = []
    gold_rows = []
    for selection_entry in sorted(selection, key=lambda item: item["demo_rank"]):
        filename = selection_entry["filename"]
        source_pdf = pdf_root / filename
        if not source_pdf.exists():
            raise FileNotFoundError(source_pdf)
        shutil.copy2(source_pdf, pdf_output / filename)

        document_id = Path(filename).stem
        gold, derived = transform_record(records[filename])
        adjudication = adjudications.get(document_id, {})
        gold["document"].update(adjudication.get("document_overrides", {}))
        derived["score_line_items"] = adjudication.get("score_line_items", True)
        derived["line_item_score_exclusion_reason"] = adjudication.get(
            "line_item_score_exclusion_reason"
        )
        derived["gold_adjudication_note"] = adjudication.get("source_evidence")
        (gold_output / f"{document_id}.json").write_text(
            json.dumps(gold, indent=2, ensure_ascii=True) + "\n"
        )
        manifest_rows.append(
            {
                "document_id": document_id,
                **selection_entry,
                "split": "unseen_template_test",
                **derived,
            }
        )
        gold_rows.append(
            {
                "document_id": document_id,
                "filename": filename,
                "expected": gold,
            }
        )

    (args.output / "manifest.jsonl").write_text(
        "".join(json.dumps(row, ensure_ascii=True) + "\n" for row in manifest_rows)
    )
    (args.output / "gold.jsonl").write_text(
        "".join(json.dumps(row, ensure_ascii=True) + "\n" for row in gold_rows)
    )
    shutil.copy2(args.source / "ad-buy-form" / "main" / "meta.json", args.output)
    shutil.copy2(split_path, args.output / "source-split.json")

    print(f"Prepared {len(manifest_rows)} documents in {args.output}")


if __name__ == "__main__":
    main()
