#!/usr/bin/env python3
"""Import the official teacher, class, and special-room timetable PDFs.

The PDFs exported by Hancom contain real table geometry, so extracting their
tables is substantially safer than copying the visually interleaved text.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import pdfplumber


DAYS = ["월", "화", "수", "목", "금"]


def compact_cell(cell: str | None) -> str:
    return " ".join((cell or "").split())


def extract_teacher_schedule(path: Path) -> dict[str, dict[str, str]]:
    result: dict[str, dict[str, str]] = {}
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            for table in page.extract_tables():
                if not table or len(table[0]) < 6:
                    continue
                teacher = compact_cell(table[0][0])
                if not teacher:
                    continue
                row: dict[str, str] = {}
                for cells in table[1:]:
                    period_match = re.match(r"(\d)", compact_cell(cells[0]))
                    if not period_match:
                        continue
                    period = int(period_match.group(1))
                    for day_index, cell in enumerate(cells[1:6]):
                        value = compact_cell(cell)
                        if value:
                            row[f"{DAYS[day_index]}{period}"] = value
                result[teacher] = row
    return result


def extract_class_schedule(path: Path) -> dict[str, dict[str, str]]:
    result: dict[str, dict[str, str]] = {}
    with pdfplumber.open(path) as pdf:
        for page_index, page in enumerate(pdf.pages):
            grade, class_num = divmod(page_index, 10)
            class_name = f"{grade + 1}-{class_num + 1}"
            tables = [table for table in page.extract_tables() if len(table) == 8 and len(table[0]) == 6]
            if len(tables) != 1:
                raise ValueError(f"Expected one 8x6 class table on page {page_index + 1}")
            row: dict[str, str] = {}
            for period, cells in enumerate(tables[0][1:8], 1):
                for day_index, cell in enumerate(cells[1:6]):
                    value = compact_cell(cell)
                    if value:
                        row[f"{DAYS[day_index]}{period}"] = value
            for day, period in (("월", 7), ("금", 5), ("금", 6)):
                row.setdefault(f"{day}{period}", "창체")
            result[class_name] = row
    return result


def extract_lab_schedule(path: Path) -> dict[str, dict[str, dict[int, str]]]:
    result: dict[str, dict[str, dict[int, str]]] = {}
    with pdfplumber.open(path) as pdf:
        for page_index, page in enumerate(pdf.pages):
            first_line = (page.extract_text() or "").splitlines()[0]
            match = re.match(r"(.+?)\s*\(\d+\)$", first_line.strip())
            room = match.group(1).strip() if match else first_line.strip()
            tables = page.extract_tables()
            if len(tables) != 1:
                raise ValueError(f"Expected one room table on page {page_index + 1}")
            week = {day: {period: "" for period in range(1, 8)} for day in DAYS}
            for period, cells in enumerate(tables[0][1:8], 1):
                for day_index, cell in enumerate(cells[1:6]):
                    week[DAYS[day_index]][period] = compact_cell(cell)
            result[room] = week
    return result


def js_literal(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2)


def replace_const(source: str, name: str, value: object) -> str:
    pattern = re.compile(rf"const {re.escape(name)} = \{{.*?^\}};", re.MULTILINE | re.DOTALL)
    replacement = f"const {name} = {js_literal(value)};"
    updated, count = pattern.subn(replacement, source, count=1)
    if count != 1:
        raise ValueError(f"Could not uniquely replace {name}")
    return updated


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--teacher", type=Path, required=True)
    parser.add_argument("--class", dest="class_pdf", type=Path, required=True)
    parser.add_argument("--lab", type=Path, required=True)
    parser.add_argument("--data", type=Path, default=Path("js/data.js"))
    args = parser.parse_args()

    source = args.data.read_text(encoding="utf-8")
    source = replace_const(source, "TEACHER_SCHEDULE", extract_teacher_schedule(args.teacher))
    source = replace_const(source, "CLASS_SCHEDULE", extract_class_schedule(args.class_pdf))
    source = replace_const(source, "LAB_SCHEDULE", extract_lab_schedule(args.lab))
    args.data.write_text(source, encoding="utf-8")


if __name__ == "__main__":
    main()
