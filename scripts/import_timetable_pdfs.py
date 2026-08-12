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
MINT = (0.8039216, 0.9490196, 0.8941176)
YELLOW = (0.9960784, 0.9960784, 0.8823529)


def compact_cell(cell: str | None) -> str:
    return " ".join((cell or "").split())


def color_matches(actual: object, expected: tuple[float, float, float]) -> bool:
    if not isinstance(actual, (list, tuple)) or len(actual) != 3:
        return False
    return all(abs(float(a) - b) < 0.01 for a, b in zip(actual, expected))


def cell_fill(page: pdfplumber.page.Page, cell: tuple[float, float, float, float]) -> str | None:
    """Return the dominant timetable fill for a geometric table cell."""
    x0, top, x1, bottom = cell
    cell_area = max((x1 - x0) * (bottom - top), 1)
    best: tuple[float, str | None] = (0, None)
    for rect in page.rects:
        color = rect.get("non_stroking_color")
        kind = "mint" if color_matches(color, MINT) else "yellow" if color_matches(color, YELLOW) else None
        if not kind:
            continue
        overlap_x = max(0, min(x1, rect["x1"]) - max(x0, rect["x0"]))
        overlap_y = max(0, min(bottom, rect["bottom"]) - max(top, rect["top"]))
        ratio = overlap_x * overlap_y / cell_area
        if ratio > best[0]:
            best = (ratio, kind)
    return best[1] if best[0] >= 0.45 else None


def cell_text(page: pdfplumber.page.Page, cell: tuple[float, float, float, float] | None) -> str:
    if cell is None:
        return ""
    return compact_cell(page.within_bbox(cell).extract_text(x_tolerance=2, y_tolerance=2))


def extract_teacher_schedule(path: Path) -> tuple[
    dict[str, dict[str, str]],
    dict[str, dict[str, list[str]]],
    dict[str, set[str]],
    dict[str, set[str]],
]:
    regular: dict[str, dict[str, str]] = {}
    external: dict[str, dict[str, list[str]]] = {}
    mint_cells: dict[str, set[str]] = {}
    select_cells: dict[str, set[str]] = {}
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            for table in page.find_tables():
                if not table.rows or len(table.rows[0].cells) < 6:
                    continue
                teacher = cell_text(page, table.rows[0].cells[0])
                if not teacher:
                    continue
                row = regular.setdefault(teacher, {})
                current_period: int | None = None
                for table_row in table.rows[1:]:
                    period_match = re.match(r"(\d)", cell_text(page, table_row.cells[0]))
                    if period_match:
                        current_period = int(period_match.group(1))
                    if current_period is None:
                        continue
                    for day_index, cell in enumerate(table_row.cells[1:6]):
                        value = cell_text(page, cell)
                        if not value:
                            continue
                        slot = f"{DAYS[day_index]}{current_period}"
                        fill = cell_fill(page, cell)
                        if fill == "mint":
                            external.setdefault(teacher, {}).setdefault(slot, []).append(value)
                            mint_cells.setdefault(teacher, set()).add(slot)
                        else:
                            if slot in row:
                                raise ValueError(f"Duplicate regular lesson: {teacher} {slot}")
                            row[slot] = value
                            if fill == "yellow":
                                select_cells.setdefault(teacher, set()).add(slot)
    return regular, external, mint_cells, select_cells


def extract_class_schedule(path: Path) -> dict[str, dict[str, str]]:
    result: dict[str, dict[str, str]] = {}
    with pdfplumber.open(path) as pdf:
        # 전체시간표 PDF: 30개 학급이 한 페이지의 가로형 표에 들어 있다.
        if len(pdf.pages) == 1:
            tables = pdf.pages[0].extract_tables()
            tables = [table for table in tables if len(table) >= 32 and len(table[0]) >= 30]
            if len(tables) != 1:
                raise ValueError("Expected one whole-school timetable")
            table = tables[0]
            day_columns: dict[int, tuple[str, int]] = {}
            current_day = ""
            for column in range(2, len(table[0])):
                day_label = compact_cell(table[0][column])
                if day_label:
                    current_day = day_label
                period_text = compact_cell(table[1][column])
                if current_day in DAYS and period_text.isdigit():
                    day_columns[column] = (current_day, int(period_text))

            current_grade = ""
            for cells in table[2:]:
                grade_value = compact_cell(cells[0])
                if grade_value:
                    current_grade = grade_value
                class_num = compact_cell(cells[1])
                if current_grade not in {"1", "2", "3"} or not class_num.isdigit() or int(class_num) > 10:
                    continue
                class_name = f"{current_grade}-{int(class_num)}"
                row: dict[str, str] = {}
                for column, (day, period) in day_columns.items():
                    value = compact_cell(cells[column] if column < len(cells) else None)
                    if value:
                        row[f"{day}{period}"] = value
                for day, period in (("월", 7), ("금", 5), ("금", 6)):
                    row.setdefault(f"{day}{period}", "창체")
                result[class_name] = row
            if len(result) != 30:
                raise ValueError(f"Expected 30 class rows, got {len(result)}")
            return result

        # 학급별 PDF: 페이지당 한 학급 표
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


def extract_lab_schedule(path: Path) -> dict[str, dict[str, dict[int, object]]]:
    result: dict[str, dict[str, dict[int, object]]] = {}
    with pdfplumber.open(path) as pdf:
        for page_index, page in enumerate(pdf.pages):
            first_line = (page.extract_text() or "").splitlines()[0]
            match = re.match(r"(.+?)\s*\(\d+\)$", first_line.strip())
            room = match.group(1).strip() if match else first_line.strip()
            tables = page.extract_tables()
            if len(tables) != 1:
                raise ValueError(f"Expected one room table on page {page_index + 1}")
            week: dict[str, dict[int, object]] = {
                day: {period: ({"12": "", "3": ""} if period == 4 else "") for period in range(1, 8)}
                for day in DAYS
            }
            for cells in tables[0][1:]:
                label = compact_cell(cells[0])
                period_match = re.search(r"([1-7])\s*교시", label)
                if not period_match:
                    continue
                period = int(period_match.group(1))
                for day_index, cell in enumerate(cells[1:6]):
                    value = compact_cell(cell)
                    if period == 4:
                        grade_group = "3" if "3학년" in label else "12"
                        slot = week[DAYS[day_index]][period]
                        assert isinstance(slot, dict)
                        slot[grade_group] = value
                    else:
                        week[DAYS[day_index]][period] = value
            result[room] = week
    return result


def js_literal(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2)


def js_set_map_literal(value: dict[str, set[str]]) -> str:
    lines = ["{"]
    items = sorted(value.items())
    for index, (name, slots) in enumerate(items):
        suffix = "," if index < len(items) - 1 else ""
        lines.append(f"  {json.dumps(name, ensure_ascii=False)}: new Set({json.dumps(sorted(slots), ensure_ascii=False)}){suffix}")
    lines.append("}")
    return "\n".join(lines)


def replace_const_expression(source: str, name: str, expression: str) -> str:
    pattern = re.compile(rf"const {re.escape(name)} = \{{.*?^\}};", re.MULTILINE | re.DOTALL)
    replacement = f"const {name} = {expression};"
    updated, count = pattern.subn(replacement, source, count=1)
    if count != 1:
        raise ValueError(f"Could not uniquely replace {name}")
    return updated


def replace_const(source: str, name: str, value: object) -> str:
    return replace_const_expression(source, name, js_literal(value))


def upsert_external_lessons(source: str, value: dict[str, dict[str, list[str]]]) -> str:
    expression = js_literal(value)
    if "const EXTERNAL_LESSONS =" in source:
        return replace_const_expression(source, "EXTERNAL_LESSONS", expression)
    marker = "const EXTERNAL_INSTRUCTOR_CELLS = MINT_CELLS;"
    addition = (
        f"{marker}\n\n"
        "// PDF 민트색 분할 셀에서 분리한 실제 외부강사 수업\n"
        f"const EXTERNAL_LESSONS = {expression};"
    )
    if marker not in source:
        mint_pattern = re.compile(r"(const MINT_CELLS = \{.*?^\};)", re.MULTILINE | re.DOTALL)
        updated, count = mint_pattern.subn(rf"\1\n\nconst EXTERNAL_INSTRUCTOR_CELLS = MINT_CELLS;\n\n// PDF 민트색 분할 셀에서 분리한 실제 외부강사 수업\nconst EXTERNAL_LESSONS = {expression};", source, count=1)
        if count != 1:
            raise ValueError("Could not insert EXTERNAL_LESSONS")
        return updated
    return source.replace(marker, addition, 1)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--teacher", type=Path, required=True)
    parser.add_argument("--class", dest="class_pdf", type=Path, required=True)
    parser.add_argument("--lab", type=Path, required=True)
    parser.add_argument("--data", type=Path, default=Path("js/data.js"))
    args = parser.parse_args()

    teacher_schedule, external_lessons, mint_cells, select_cells = extract_teacher_schedule(args.teacher)
    source = args.data.read_text(encoding="utf-8")
    source = replace_const(source, "TEACHER_SCHEDULE", teacher_schedule)
    source = replace_const(source, "CLASS_SCHEDULE", extract_class_schedule(args.class_pdf))
    source = replace_const(source, "LAB_SCHEDULE", extract_lab_schedule(args.lab))
    source = replace_const_expression(source, "MINT_CELLS", js_set_map_literal(mint_cells))
    source = replace_const_expression(source, "SELECT_CELLS", js_set_map_literal(select_cells))
    source = upsert_external_lessons(source, external_lessons)
    args.data.write_text(source, encoding="utf-8")


if __name__ == "__main__":
    main()
