#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({
  console,
  setTimeout: () => 0,
  clearTimeout: () => {},
  setInterval: () => 0,
  clearInterval: () => {},
  navigator: { clipboard: { writeText: async () => {} } },
  localStorage: { getItem: () => null, setItem: () => {} },
  document: {
    addEventListener: () => {},
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => ({ classList:{ add:()=>{}, remove:()=>{}, toggle:()=>{} } }),
  },
  window: { addEventListener: () => {} },
});

for (const file of ['docs/js/data.js', 'docs/js/app.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename:file });
}

function read(expression) { return vm.runInContext(expression, context); }
function assert(condition, message) { if (!condition) throw new Error(message); }

const subjectRules = read(`(() => {
  const groups = getSubjectGroups();
  return {
    korean: groups['국어'] || [], design: groups['디자인'] || [], commerce: groups['상업'] || [], pe: groups['체육'] || [],
    video: groups['영상'] || [], art: groups['미술'] || [],
    hasKorean2: !!groups['국어2'], hasPe2: !!groups['체육2']
  };
})()`);
assert(!subjectRules.korean.includes('홍민영'), '국어에 홍민영이 남아 있음');
assert(!subjectRules.design.includes('송준한') && subjectRules.design.includes('김제령'), '디자인 교사 수정 불일치');
assert(!subjectRules.commerce.includes('고대홍'), '상업에 고대홍이 남아 있음');
assert(subjectRules.pe.includes('김지윤'), '체육에 김지윤이 없음');
assert(JSON.stringify(subjectRules.video) === JSON.stringify(['송준한']), '영상 교과에 송준한 배치 오류');
assert(subjectRules.art.includes('백경민'), '미술 교과에 백경민이 없음');
assert(!subjectRules.hasKorean2 && !subjectRules.hasPe2, '국어2/체육2 버튼이 남아 있음');

const externalChecks = read(`({
  gangRegularMon1: TEACHER_SCHEDULE['강승표']['월1'] || null,
  gangExternalMon1: EXTERNAL_LESSONS['강승표']['월1'],
  gangRegularFri2: TEACHER_SCHEDULE['강승표']['금2'],
  gangExternalFri2: EXTERNAL_LESSONS['강승표']['금2'],
  ohRegularFri1: TEACHER_SCHEDULE['오재영']['금1'],
  ohExternalWed1: EXTERNAL_LESSONS['오재영']['수1'],
})`);
assert(externalChecks.gangRegularMon1 === null && externalChecks.gangExternalMon1.includes('201 독서'), '강승표 월1 민트 수업 오류');
assert(externalChecks.gangRegularFri2 === '201 독서' && externalChecks.gangExternalFri2.includes('204 독서'), '강승표 금2 혼합 셀 오류');
assert(externalChecks.ohRegularFri1 === '303 확통' && externalChecks.ohExternalWed1.includes('301 E_확통'), '오재영 시간표 오류');
const targetMintCounts = read(`({
  kimYoungju: Object.values(EXTERNAL_LESSONS['김영주']).flat().length,
  ohSoyeon: Object.values(EXTERNAL_LESSONS['오소연']).flat().length
})`);
assert(targetMintCounts.kimYoungju === 6 && targetMintCounts.ohSoyeon === 6, '김영주/오소연 민트 수업 수 오류');

const periodRules = read(`({
  grade12: getPeriodTime(4, '1'), grade3: getPeriodTime(4, '3'),
  separated: !intervalsOverlap(getLessonInterval(4, '1'), getLessonInterval(4, '3'))
})`);
assert(periodRules.grade12 === '11:40~12:30' && periodRules.grade3 === '12:40~13:30' && periodRules.separated, '4교시 학년별 시간 판정 오류');

const labRules = read(`({
  computerMon: LAB_SCHEDULE['컴그실']['월'][4],
  computerTue: LAB_SCHEDULE['컴그실']['화'][4],
  businessMon: LAB_SCHEDULE['사행실']['월'][4]
})`);
assert(labRules.computerMon['3'] === '309 출판 박정민' && labRules.computerMon['12'] === '', '컴그실 월요일 4교시 오류');
assert(labRules.computerTue['12'] === '107 사무 이상분' && labRules.computerTue['3'] === '', '컴그실 화요일 4교시 오류');
assert(labRules.businessMon['3'] === '307 기자 임홍재', '사행실 3학년 4교시 오류');

const bottom = read(`ALL_TEACHERS.slice(-7)`);
assert(JSON.stringify(bottom) === JSON.stringify(['김지윤','송혜리','중국어특성화','중어온라인','지과온라인','화학온라인','물리온라인']), '교사 맨 아래 순서 오류');

const candidateAudit = read(`(() => {
  const groups = getSubjectGroups();
  let badSubstitutes = 0, placeholderSubstitutes = 0, selectionSwaps = 0, externalSwaps = 0, swapCount = 0;
  const auditLesson = (teacher, slot, value, external = false) => {
    const match = slot.match(/^(.+?)([1-7])$/); if (!match) return;
    const day = match[1], period = Number(match[2]);
    const info = parseCellValue(value, teacher, slot, external);
    const swaps = external ? [] : findSwapCandidates(teacher, day, period, value);
    swapCount += swaps.length;
    if (info.isSelect) selectionSwaps += swaps.length;
    if (external) externalSwaps += swaps.length;
    const sourceGroup = Object.entries(groups).find(([, names]) => names.includes(teacher));
    for (const candidate of findSubstituteCandidates(teacher, day, period, value)) {
      if (!sourceGroup || !sourceGroup[1].includes(candidate.teacher)) badSubstitutes++;
      if (candidate.teacher.includes('온라인') || candidate.teacher === '중국어특성화') placeholderSubstitutes++;
    }
  };
  for (const [teacher, row] of Object.entries(TEACHER_SCHEDULE)) for (const [slot, value] of Object.entries(row)) auditLesson(teacher, slot, value);
  for (const [teacher, row] of Object.entries(EXTERNAL_LESSONS)) for (const [slot, values] of Object.entries(row)) for (const value of values) auditLesson(teacher, slot, value, true);
  return { badSubstitutes, placeholderSubstitutes, selectionSwaps, externalSwaps, swapCount };
})()`);
assert(candidateAudit.badSubstitutes === 0, '다른 교과 대체 후보 발생');
assert(candidateAudit.placeholderSubstitutes === 0, '온라인/특성화 표시 항목이 대체 교사로 나옴');
assert(candidateAudit.selectionSwaps === 0, '선택과목 교체 후보 발생');
assert(candidateAudit.externalSwaps === 0, '외부강사 교체 후보 발생');

console.log(JSON.stringify({
  teacherCount: read(`Object.keys(TEACHER_SCHEDULE).length`),
  classCount: read(`Object.keys(CLASS_SCHEDULE).length`),
  roomCount: read(`Object.keys(LAB_SCHEDULE).length`),
  badSubstitutes: candidateAudit.badSubstitutes,
  placeholderSubstitutes: candidateAudit.placeholderSubstitutes,
  selectionSwaps: candidateAudit.selectionSwaps,
  externalSwaps: candidateAudit.externalSwaps,
  swapCandidatesChecked: candidateAudit.swapCount,
  subjectRules,
  periodRules,
  bottom,
}, null, 2));
