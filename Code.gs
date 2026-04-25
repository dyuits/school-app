function doGet() {
  return HtmlService.createTemplateFromFile("index")
    .evaluate()
    .setTitle("스마트 시간표 교체/대체 시스템")
    .addMetaTag("viewport", "width=device-width, initial-scale=1")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

function getAppData() {
  const schedule = getFullScheduleTable();
  const teacherGroups = calculateTeacherGroups(schedule);
  return {
    schedule: schedule,
    teacherGroups: teacherGroups,
    homeroomTeachers: HOMEROOM_TEACHERS,
    subjectRules: SUBJECT_RULES,
    contactRows: CONTACT_ROWS,
    academicEvents: ACADEMIC_EVENTS
  };
}

function getFullScheduleTable() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("시트1") || ss.getSheets()[0];
  const values = sheet.getDataRange().getValues();
  if (values.length < 5) throw new Error("시트 데이터가 부족합니다.");

  const headerDays = values[2] || [];
  const headerPeriods = values[3] || [];
  let lastCol = 2;
  for (let c = 2; c < headerPeriods.length; c++) {
    const n = parseInt(headerPeriods[c], 10);
    if (!isNaN(n)) lastCol = c + 1;
  }

  const validDays = ["월", "화", "수", "목", "금"];
  const teachers = [];
  const tableData = [];
  const maxPeriodByDay = {};

  for (let r = 4; r < values.length; r++) {
    const rawName = values[r][1];
    if (!rawName) continue;
    if (String(rawName).indexOf("교사성명") !== -1) continue;
    const teacher = extractName(rawName);
    if (!teacher) continue;
    teachers.push(teacher);

    const rowObj = { teacher: teacher };
    let currentDay = "";
    for (let c = 2; c < lastCol; c++) {
      if (headerDays[c] && String(headerDays[c]).trim()) currentDay = String(headerDays[c]).trim();
      if (validDays.indexOf(currentDay) === -1) continue;
      const period = parseInt(headerPeriods[c], 10);
      if (isNaN(period)) continue;
      const key = currentDay + period;
      const cell = values[r][c] ? String(values[r][c]).trim() : "";
      rowObj[key] = cell;
      if (!maxPeriodByDay[currentDay] || period > maxPeriodByDay[currentDay]) maxPeriodByDay[currentDay] = period;
    }
    tableData.push(rowObj);
  }

  let maxPeriod = 0;
  validDays.forEach(function (d) {
    maxPeriod = Math.max(maxPeriod, maxPeriodByDay[d] || 0);
  });
  if (!maxPeriod) maxPeriod = 7;

  return {
    teachers: uniqueSorted(teachers),
    days: validDays,
    periods: Array.from({ length: maxPeriod }, function (_, i) { return i + 1; }),
    tableData: tableData
  };
}

function calculateTeacherGroups(schedule) {
  const map = {};
  schedule.teachers.forEach(function (name) {
    const row = schedule.tableData.find(function (r) { return r.teacher === name; });
    if (!row) {
      map[name] = "12";
      return;
    }
    let g12 = 0;
    let g3 = 0;
    schedule.days.forEach(function (d) {
      schedule.periods.forEach(function (p) {
        const v = row[d + p];
        if (!v) return;
        const info = extractClassInfo(v);
        if (info.grade === "3") g3++;
        if (info.grade === "1" || info.grade === "2") g12++;
      });
    });
    map[name] = g3 > g12 ? "3" : "12";
  });
  return map;
}

function extractName(fullName) {
  if (!fullName) return "";
  const s = String(fullName);
  const m = s.match(/\(([^)]+)\)/);
  return m ? m[1].trim() : s.trim();
}

function extractClassInfo(value) {
  if (!value) return { grade: null, classNo: null };
  let s = String(value);
  const room = s.match(/(?:^|\D)([1-3])(0[1-9]|[1-9]\d)(?=\D|$)/);
  if (room) {
    const classNum = parseInt(room[2], 10);
    return { grade: room[1], classNo: classNum > 10 ? "선택" : String(classNum) };
  }
  const dash = s.match(/(?:^|\D)([1-3])-(\d+)(?=\D|$)/);
  if (dash) {
    const c = parseInt(dash[2], 10);
    return { grade: dash[1], classNo: c > 10 ? "선택" : String(c) };
  }
  const g = s.match(/([1-3])학년/);
  const c2 = s.match(/(\d+)반/);
  return {
    grade: g ? g[1] : null,
    classNo: c2 ? c2[1] : null
  };
}

function uniqueSorted(arr) {
  return Array.from(new Set(arr)).sort();
}

const HOMEROOM_TEACHERS = [
  "김도연", "박종찬", "강부열", "강혜민", "양찬호", "황혜인", "백은정", "장진혁",
  "이상희", "고지은", "강창규", "현은심", "오소연", "김지선", "김민권", "김현정",
  "송진호", "김지연", "안미진", "고지수", "김보민", "양정원", "김민지", "오재영",
  "오재원", "김민정", "임홍재", "강향아", "송준한", "김윤주", "김제령", "임수진"
];

const SUBJECT_RULES = {
  "국어": ["황혜인", "강승표", "김연아", "홍민영", "김보민", "오재원", "홍원정"],
  "일본어": ["김수정"],
  "사회": ["강창규", "안미진", "양찬호", "김민권", "양정원", "현은심", "이상희", "김대현", "강부열", "김민정"],
  "과학": ["박종찬", "오승철", "현창식", "장진혁", "김현정"],
  "체육": ["고세권", "김재현", "김형우"],
  "음악": ["강진석"],
  "정보": ["김영주", "문원호", "임수진", "박정민", "오소연", "김태환", "고대홍", "백은정", "이상분", "송주연", "임홍재", "김영조"],
  "상업": ["고대홍", "백은정", "김지연", "송주연", "임홍재", "김영조", "강향아", "김태환"],
  "미술": ["고지은", "김윤주", "김제령", "백경민"],
  "디자인": ["김윤주", "송준한", "김제령", "박정민", "김영주", "문원호", "임수진", "오소연", "고대홍", "이상분"],
  "영어": ["조설아", "김희경", "김민지", "김도연", "김지선", "송진호"],
  "수학": ["공은표", "김한주", "오소영", "오재영", "강혜민", "고지수"]
};

const CONTACT_ROWS = [
  { role: "교감", name: "고대홍", phone: "010-2696-8552", ext: "802" },
  { role: "교무부장", name: "조설아", phone: "010-4691-8281", ext: "811" },
  { role: "교육과정부장", name: "김희경", phone: "010-4652-5402", ext: "812" },
  { role: "1학년부장", name: "김재현", phone: "010-7394-8555", ext: "822" },
  { role: "2학년부장", name: "강창규", phone: "010-9371-3828", ext: "825" },
  { role: "3학년부장", name: "양정원", phone: "010-9636-6963", ext: "828" },
  { role: "교육정보부장", name: "문원호", phone: "010-2074-9972", ext: "836" },
  { role: "행정실장", name: "강영석", phone: "010-3694-2659", ext: "803" },
  { role: "행정팀장", name: "김정미", phone: "010-2793-6405", ext: "804" },
  { role: "1-1 담임", name: "김도연", phone: "010-5146-6425", ext: "823" },
  { role: "2-1 담임", name: "현은심", phone: "010-2480-0471", ext: "853" },
  { role: "3-1 담임", name: "김민지", phone: "010-7963-0567", ext: "830" }
];

const ACADEMIC_EVENTS = [
  { date: "2026-03-03", title: "개학식/입학식" },
  { date: "2026-03-06", title: "기초학력진단평가(1,2)" },
  { date: "2026-03-24", title: "학력평가(1,2,3)" },
  { date: "2026-04-28", title: "1차고사 시작" },
  { date: "2026-05-14", title: "체육한마당" },
  { date: "2026-06-09", title: "수학여행(1학년)" },
  { date: "2026-07-01", title: "2차고사 시작" },
  { date: "2026-07-17", title: "방학선언" },
  { date: "2026-08-13", title: "개학" },
  { date: "2026-10-13", title: "1차고사(2학기) 시작" },
  { date: "2026-11-19", title: "대학수학능력시험/재량휴업일" },
  { date: "2026-12-29", title: "교내축제" },
  { date: "2027-01-07", title: "졸업식/수료식" }
];
