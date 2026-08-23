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

# 현장 확인 정정: 105 데과는 회계실이 아니라 사행실을 사용한다.
# 원본 특별실 PDF에 두 실습실이 중복 기재되어 있어 재가져오기 때도 보정한다.
ROOM_ASSIGNMENT_CORRECTIONS = {
    ("105", "데과"): "사행실",
}

# 최신 교사·학급 시간표와 대조해 확인한 특별실 PDF의 잔존 항목.
# 교사시간표를 우선 기준으로 삼아 회계실 정규 사용 현황을 보정한다.
LAB_CELL_CORRECTIONS = {
    ("회계실", "수", 4, "12"): "104 데과 김영주",
    ("회계실", "수", 7, None): "",
}

ROOM_NAME_ALIASES = {
    "사무행정": "사행실",
}


def compact_cell(cell: str | None) -> str:
    return " ".join((cell or "").split())


def compact_lesson_cell(cell: str | None) -> str:
    """Compact a lesson cell and repair a Korean teacher name split by a narrow column."""
    value = compact_cell(cell)
    parts = value.split()
    if (
        len(parts) >= 4
        and re.fullmatch(r"[가-힣]{2,4}", parts[-2])
        and re.fullmatch(r"[가-힣]", parts[-1])
    ):
        parts[-2:] = [parts[-2] + parts[-1]]
    return " ".join(parts)


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
            found_tables = page.find_tables()
            for table in found_tables:
                if not table.rows or len(table.rows[0].cells) < 6:
                    continue
                # 주간시간표 PDF: 한 행이 한 교사이고, 열은 요일별 교시이다.
                if len(table.rows[0].cells) >= 30:
                    extracted_rows = table.extract()
                    day_period_columns: dict[int, tuple[str, int]] = {}
                    current_day = ""
                    header_days = table.rows[0].cells
                    header_periods = table.rows[1].cells
                    for column in range(1, len(header_days)):
                        day_label = cell_text(page, header_days[column])
                        if day_label in DAYS:
                            current_day = day_label
                        period_text = cell_text(page, header_periods[column])
                        if current_day and period_text.isdigit():
                            day_period_columns[column] = (current_day, int(period_text))
                    for row_index, table_row in enumerate(table.rows[2:], 2):
                        extracted_row = extracted_rows[row_index]
                        raw_teacher = compact_cell(extracted_row[0])
                        teacher = re.sub(r"^\(\d+\)", "", raw_teacher)
                        teacher = re.sub(r"\(\d+\)$", "", teacher).strip()
                        teacher = re.sub(r"\s+", "", teacher)
                        if not teacher:
                            continue
                        row = regular.setdefault(teacher, {})
                        for column, (day, period) in day_period_columns.items():
                            cell = table_row.cells[column] if column < len(table_row.cells) else None
                            value = compact_lesson_cell(extracted_row[column] if column < len(extracted_row) else None)
                            if not value:
                                continue
                            slot = f"{day}{period}"
                            fill = cell_fill(page, cell)
                            if fill == "mint":
                                external.setdefault(teacher, {}).setdefault(slot, []).append(value)
                                mint_cells.setdefault(teacher, set()).add(slot)
                            else:
                                row[slot] = value
                                if fill == "yellow":
                                    select_cells.setdefault(teacher, set()).add(slot)
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
                    value = compact_lesson_cell(cells[column] if column < len(cells) else None)
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
            table = tables[0]
            column_days: dict[int, str] = {}
            current_day = ""
            for column in range(1, len(table[0])):
                day_label = compact_cell(table[0][column])
                if day_label in DAYS:
                    current_day = day_label
                if current_day:
                    column_days[column] = current_day
            week: dict[str, dict[int, object]] = {
                day: {period: ({"12": "", "3": ""} if period == 4 else "") for period in range(1, 8)}
                for day in DAYS
            }
            for cells in table[1:]:
                label = compact_cell(cells[0])
                period_match = re.search(r"([1-7])\s*교시", label)
                if not period_match:
                    continue
                period = int(period_match.group(1))
                for column, day in column_days.items():
                    value = compact_lesson_cell(cells[column] if column < len(cells) else None)
                    if not value:
                        continue
                    if period == 4:
                        class_match = re.match(r"([1-3])\d{2}\b", value)
                        grade_group = "3" if class_match and class_match.group(1) == "3" else "12"
                        slot = week[day][period]
                        assert isinstance(slot, dict)
                        if slot[grade_group]:
                            raise ValueError(f"Duplicate room lesson: {room} {day} 4교시 {grade_group}")
                        slot[grade_group] = value
                    else:
                        if week[day][period]:
                            raise ValueError(f"Duplicate room lesson: {room} {day} {period}교시")
                        week[day][period] = value
            result[room] = week
    return result


def normalize_external_room_names(external_lessons: dict[str, dict[str, list[str]]]) -> None:
    """Use the app's canonical special-room names in extracted mint lessons."""
    for row in external_lessons.values():
        for slot, values in row.items():
            normalized: list[str] = []
            for value in values:
                parts = value.split()
                if parts and parts[-1] in ROOM_NAME_ALIASES:
                    parts[-1] = ROOM_NAME_ALIASES[parts[-1]]
                normalized.append(" ".join(parts))
            row[slot] = normalized


def apply_lab_cell_corrections(lab_schedule: dict[str, dict[str, dict[int, object]]]) -> None:
    """Apply cross-validated corrections where the room PDF is stale."""
    for (room, day, period, grade_group), value in LAB_CELL_CORRECTIONS.items():
        slot = lab_schedule[room][day][period]
        if grade_group is None:
            lab_schedule[room][day][period] = value
        else:
            if not isinstance(slot, dict):
                raise ValueError(f"Expected split fourth-period room cell: {room} {day}{period}")
            slot[grade_group] = value


def merge_lab_external_lessons(
    teacher_schedule: dict[str, dict[str, str]],
    lab_schedule: dict[str, dict[str, dict[int, object]]],
    external_lessons: dict[str, dict[str, list[str]]],
    mint_cells: dict[str, set[str]],
) -> None:
    """Recover co-taught room lessons that only appear in the special-room PDF."""
    for room, week in lab_schedule.items():
        for day, periods in week.items():
            for period, raw in periods.items():
                entries = [(group, value) for group, value in raw.items() if value] if isinstance(raw, dict) else [(None, raw)] if raw else []
                for group, value in entries:
                    parts = str(value).split()
                    if len(parts) < 3:
                        continue
                    class_num, subject, teacher = parts[0], parts[1], parts[-1]
                    slot = f"{day}{period}"
                    regular = teacher_schedule.get(teacher, {}).get(slot, "")
                    regular_parts = regular.split()
                    regular_class = regular_parts[0] if regular_parts else ""
                    regular_subject = re.sub(r"^[A-Z]_", "", regular_parts[1]) if len(regular_parts) > 1 else ""
                    regular_room = regular_parts[-1] if len(regular_parts) > 2 else ""
                    regular_group = "3" if regular_class.startswith("3") else "12"
                    if regular_room == room and (group is None or group == regular_group):
                        corrected = f"{regular_class} {regular_subject} {teacher}"
                        if isinstance(raw, dict):
                            raw[group] = corrected
                        else:
                            periods[period] = corrected
                        value = corrected
                        class_num, subject = regular_class, regular_subject
                    if regular_class == class_num and regular_subject == subject:
                        continue
                    lesson = f"{class_num} {subject} {room}"
                    target = external_lessons.setdefault(teacher, {}).setdefault(slot, [])
                    if lesson not in target:
                        target.append(lesson)
                    mint_cells.setdefault(teacher, set()).add(slot)


def apply_room_assignment_corrections(
    teacher_schedule: dict[str, dict[str, str]],
    class_schedule: dict[str, dict[str, str]],
    lab_schedule: dict[str, dict[str, dict[int, object]]],
) -> None:
    """Apply confirmed room corrections across all three timetable views."""
    for (class_num, subject), target_room in ROOM_ASSIGNMENT_CORRECTIONS.items():
        target_slots: set[str] = set()

        for day, periods in lab_schedule[target_room].items():
            for period, raw in periods.items():
                entries = raw.values() if isinstance(raw, dict) else [raw]
                if any(str(value).split()[:2] == [class_num, subject] for value in entries if value):
                    target_slots.add(f"{day}{period}")

        for room, week in lab_schedule.items():
            if room == target_room:
                continue
            for day, periods in week.items():
                for period, raw in periods.items():
                    slot = f"{day}{period}"
                    if slot not in target_slots:
                        continue
                    entries = raw.values() if isinstance(raw, dict) else [raw]
                    if not any(str(value).split()[:2] == [class_num, subject] for value in entries if value):
                        continue
                    if isinstance(raw, dict):
                        for group, value in raw.items():
                            if value and str(value).split()[:2] == [class_num, subject]:
                                raw[group] = ""
                    else:
                        periods[period] = ""

        for row in teacher_schedule.values():
            for slot in target_slots:
                value = row.get(slot, "")
                parts = value.split()
                if parts[:2] == [class_num, subject]:
                    row[slot] = " ".join([class_num, subject, target_room])

        class_key = f"{int(class_num[0])}-{int(class_num[1:])}"
        for slot in target_slots:
            value = class_schedule.get(class_key, {}).get(slot, "")
            parts = value.split()
            if parts and parts[0] == subject:
                teacher = parts[1] if len(parts) > 1 else ""
                class_schedule[class_key][slot] = " ".join(part for part in [subject, teacher, target_room] if part)


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
    class_schedule = extract_class_schedule(args.class_pdf)
    lab_schedule = extract_lab_schedule(args.lab)
    normalize_external_room_names(external_lessons)
    apply_lab_cell_corrections(lab_schedule)
    apply_room_assignment_corrections(teacher_schedule, class_schedule, lab_schedule)
    merge_lab_external_lessons(teacher_schedule, lab_schedule, external_lessons, mint_cells)
    source = args.data.read_text(encoding="utf-8")
    source = replace_const(source, "TEACHER_SCHEDULE", teacher_schedule)
    source = replace_const(source, "CLASS_SCHEDULE", class_schedule)
    source = replace_const(source, "LAB_SCHEDULE", lab_schedule)
    source = replace_const_expression(source, "MINT_CELLS", js_set_map_literal(mint_cells))
    source = replace_const_expression(source, "SELECT_CELLS", js_set_map_literal(select_cells))
    source = upsert_external_lessons(source, external_lessons)
    args.data.write_text(source, encoding="utf-8")


if __name__ == "__main__":
    main()
