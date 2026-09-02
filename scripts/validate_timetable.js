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
    video: groups['영상'] || [], art: groups['미술'] || [], religion: groups['종교'] || [], career: groups['진로'] || [],
    hasKorean2: !!groups['국어2'], hasPe2: !!groups['체육2']
  };
})()`);
assert(!subjectRules.korean.includes('홍민영'), '국어에 홍민영이 남아 있음');
assert(!subjectRules.design.includes('송준한') && subjectRules.design.includes('김제령'), '디자인 교사 수정 불일치');
assert(!subjectRules.commerce.includes('고대홍'), '상업에 고대홍이 남아 있음');
assert(subjectRules.pe.includes('김지윤'), '체육에 김지윤이 없음');
assert(JSON.stringify(subjectRules.video) === JSON.stringify(['송준한']), '영상 교과에 송준한 배치 오류');
assert(subjectRules.art.includes('백경민'), '미술 교과에 백경민이 없음');
assert(subjectRules.religion.includes('이순규'), '종교 교과에 이순규가 없음');
const leeSoonkyuSubjects = read(`Object.entries(getSubjectGroups()).filter(([,teachers]) => teachers.includes('이순규')).map(([subject]) => subject)`);
assert(subjectRules.career.includes('이순규') && leeSoonkyuSubjects.includes('종교') && leeSoonkyuSubjects.includes('진로'), '이순규 종교/진로 교과 배치 오류');
assert(!subjectRules.hasKorean2 && !subjectRules.hasPe2, '국어2/체육2 버튼이 남아 있음');
const onlineSubjectTeachers = read(`Object.values(getSubjectGroups()).flat().filter(name => name.includes('온라인'))`);
assert(onlineSubjectTeachers.length === 0, '교과별 수업 탭에 온라인 교사가 남아 있음');
const songJunhanLessonCount = read(`Object.keys(TEACHER_SCHEDULE['송준한'] || {}).length`);
assert(songJunhanLessonCount === 15, '영상 송준한 시간표 수업 수 오류');

const refreshedTeacherChecks = read(`({
  gangMonday3: TEACHER_SCHEDULE['강승표']['월3'],
  gangFriday4: TEACHER_SCHEDULE['강승표']['금4'],
  kimYoungjuMonday1: TEACHER_SCHEDULE['김영주']['월1'],
  ohSoyeonThursday5: TEACHER_SCHEDULE['오소연']['목5'],
  externalLessonCount: Object.values(EXTERNAL_LESSONS).flatMap(row => Object.values(row)).flat().length
})`);
assert(refreshedTeacherChecks.gangMonday3 === '204 독서' && refreshedTeacherChecks.gangFriday4 === '201 독서', '강승표 갱신 시간표 오류');
assert(refreshedTeacherChecks.kimYoungjuMonday1 === '206 데과 창구실', '김영주 갱신 시간표 오류');
assert(refreshedTeacherChecks.ohSoyeonThursday5 === '202 데과 사행실', '오소연 갱신 시간표 오류');
assert(refreshedTeacherChecks.externalLessonCount === 45, '교사시간표 PDF 민트 수업 수 오류');

const pdfColorCounts = read(`({
  regular: Object.values(TEACHER_SCHEDULE).reduce((sum, row) => sum + Object.keys(row).length, 0),
  mint: Object.values(EXTERNAL_LESSONS).reduce((sum, row) => sum + Object.values(row).flat().length, 0),
  mintSlots: Object.values(MINT_CELLS).reduce((sum, slots) => sum + slots.size, 0),
  yellow: Object.values(SELECT_CELLS).reduce((sum, slots) => sum + slots.size, 0),
})`);
assert(pdfColorCounts.regular === 884, '교사시간표 PDF 일반수업 수 불일치');
assert(pdfColorCounts.mint === 45 && pdfColorCounts.mintSlots === 45, '교사시간표 PDF 민트 수업 수 불일치');
assert(pdfColorCounts.yellow === 223, '교사시간표 PDF 노란색 이동수업 수 불일치');

const kimYoungjuPdfAudit = read(`({
  regular: TEACHER_SCHEDULE['김영주'],
  mintSlots: [...MINT_CELLS['김영주']].sort(),
  external: EXTERNAL_LESSONS['김영주'],
})`);
assert(Object.keys(kimYoungjuPdfAudit.regular).length === 12, '김영주 일반수업 수 오류');
assert(kimYoungjuPdfAudit.regular['화2'] === '104 데과 회계실' && kimYoungjuPdfAudit.regular['금4'] === '105 데과 사행실', '김영주 일반수업 PDF 대조 오류');
assert(JSON.stringify(kimYoungjuPdfAudit.mintSlots) === JSON.stringify(['금1','수1','수2','수3','수4','수5']), '김영주 민트 셀 위치 오류');
assert(kimYoungjuPdfAudit.external['수2'].includes('105 데과 사행실'), '김영주 수2 외부강사 수업 오류');

const periodRules = read(`({
  grade12: getPeriodTime(4, '1'), grade3: getPeriodTime(4, '3'),
  separated: !intervalsOverlap(getLessonInterval(4, '1'), getLessonInterval(4, '3'))
})`);
assert(periodRules.grade12 === '11:40~12:30' && periodRules.grade3 === '12:40~13:30' && periodRules.separated, '4교시 학년별 시간 판정 오류');

const labRules = read(`({
  computerMon: LAB_SCHEDULE['컴그실']['월'][4],
  computerTue: LAB_SCHEDULE['컴그실']['화'][4],
  businessMon: LAB_SCHEDULE['사행실']['월'][4],
  accountingTue: LAB_SCHEDULE['회계실']['화'][4],
  accountingFri: LAB_SCHEDULE['회계실']['금'][4],
  businessTue: LAB_SCHEDULE['사행실']['화'][4],
  businessFri: LAB_SCHEDULE['사행실']['금'][4],
  teacherTue: TEACHER_SCHEDULE['김영주']['화4'],
  teacherWed: EXTERNAL_LESSONS['김영주']['수2'][0],
  teacherFri: TEACHER_SCHEDULE['김영주']['금4'],
  classTue: CLASS_SCHEDULE['1-5']['화4'],
  classWed: CLASS_SCHEDULE['1-5']['수2'],
  classFri: CLASS_SCHEDULE['1-5']['금4'],
  accountingWed4: LAB_SCHEDULE['회계실']['수'][4],
  accountingWed7: LAB_SCHEDULE['회계실']['수'][7]
})`);
assert(labRules.computerMon['3'] === '309 출판 박정민' && labRules.computerMon['12'] === '', '컴그실 월요일 4교시 오류');
assert(labRules.computerTue['12'] === '107 사무 이상분' && labRules.computerTue['3'] === '', '컴그실 화요일 4교시 오류');
assert(labRules.businessMon['3'] === '307 기자 임홍재', '사행실 3학년 4교시 오류');
assert(labRules.accountingTue['12'] === '' && labRules.accountingFri['12'] === '', '회계실에 105 데과가 남아 있음');
assert(labRules.businessTue['12'] === '105 데과 김영주' && labRules.businessFri['12'] === '105 데과 김영주', '105 데과 사행실 배치 오류');
assert([labRules.teacherTue, labRules.teacherWed, labRules.teacherFri].every(value => value === '105 데과 사행실'), '김영주 105 데과 장소 불일치');
assert([labRules.classTue, labRules.classWed, labRules.classFri].every(value => value === '데과 김영 사행실'), '1-5 데과 장소 불일치');
assert(labRules.accountingWed4['12'] === '104 데과 김영주' && labRules.accountingWed4['3'] === '306 기자 강향아', '회계실 수요일 4교시 학년별 표시 오류');
assert(labRules.accountingWed7 === '', '회계실 수요일 7교시 잔존 데이터 오류');

const bottom = read(`ALL_TEACHERS.slice(-8)`);
assert(JSON.stringify(bottom) === JSON.stringify(['김지윤','송혜리','중국어특성화','중어온라인','지과온라인','화학온라인','물리온라인','경제온라인']), '교사 맨 아래 순서 오류');

const contactMoves = read(`({
  kimYuri: STAFF_CONTACTS.find(c => c.name === '김유리'),
  hongWonjeong: STAFF_CONTACTS.find(c => c.name === '홍원정')
})`);
assert(contactMoves.kimYuri?.dept === '본교무실' && !contactMoves.kimYuri.role.includes('휴직'), '김유리 본교무실 연락처 이동 오류');
assert(contactMoves.hongWonjeong?.dept === '학생생활안전부' && !contactMoves.hongWonjeong.role.includes('휴직'), '홍원정 학생부 연락처 이동 오류');

const contactDirectoryAudit = read(`(() => {
  const find = (dept, name) => STAFF_CONTACTS.find(c => c.dept === dept && c.name === name);
  return {
    count: STAFF_CONTACTS.length,
    byDept: Object.fromEntries([...new Set(STAFF_CONTACTS.map(c => c.dept))].map(dept => [dept, STAFF_CONTACTS.filter(c => c.dept === dept).length])),
    exactDuplicates: STAFF_CONTACTS.filter((c, index, all) => all.findIndex(other => other.dept === c.dept && other.name === c.name) !== index).length,
    invalidPhones: STAFF_CONTACTS.filter(c => !/^(010-\\d{4}-\\d{4}|\\d{3}-\\d{4})$/.test(c.phone || '')).length,
    kimYuri: find('본교무실', '김유리'),
    jeongGicheol: find('행정실', '정기철'),
    kangJinseokInfo: find('교육정보부', '강진석'),
    hongMinyoung: find('학생생활안전부', '홍민영'),
    hongWonjeong: find('학생생활안전부', '홍원정'),
    kimJeryeongBroadcast: find('방송실', '김제령'),
    kimJeryeongHomeroom: find('3학년부', '김제령'),
    officeMain: find('행정실', '학교 대표전화'),
    officeFax: find('행정실', '행정실 팩스'),
    cafeteriaFax: find('급식소', '급식소 팩스'),
    addedPeople: ['오금선','김창희','고영숙','김경양','이승경','장혜순','장경아','강정숙','정진옥','이수정','강영철','신종영'].map(name => STAFF_CONTACTS.find(c => c.name === name)),
    staleJeongPhone: STAFF_CONTACTS.some(c => c.phone === '010-6563-0628'),
    kimYuriLeave: find('휴직', '김유리'),
    musicRoom: find('음악실(체육관)', '강진석'),
    corporateOffice: find('법인사무국', '김하석')
  };
})()`);
assert(contactDirectoryAudit.count === 95, '최신 교직원 연락망 항목 수 오류');
assert(JSON.stringify(contactDirectoryAudit.byDept) === JSON.stringify({
  '교장실':1, '본교무실':14, '행정실':10, '교육정보부':4, '취업부':1, '학생생활안전부':4,
  '예술건강부':2, '보건실':1, '방송실':1, '교목실':1, '상담실':1, '급식소':13,
  '1학년부':11, '2학년부':11, '3학년부':11, '음악실(체육관)':1, '도서관':1,
  '법인사무국':1, '환경미화실':1, '배움터지킴이':1, '축구부':3, '휴직':1
}), '최신 교직원 연락망 부서별 인원 수 오류');
assert(contactDirectoryAudit.exactDuplicates === 0 && contactDirectoryAudit.invalidPhones === 0, '연락처 중복 또는 전화번호 형식 오류');
assert(contactDirectoryAudit.kimYuri?.role === '특성화교육' && contactDirectoryAudit.kimYuri.ext === '815' && !contactDirectoryAudit.kimYuriLeave, '김유리 연락처 배치 오류');
assert(contactDirectoryAudit.jeongGicheol?.phone === '010-8182-8306' && !contactDirectoryAudit.staleJeongPhone, '정기철 변경 전화번호 오류');
assert(contactDirectoryAudit.kangJinseokInfo?.ext === '819', '교육정보부 강진석 내선 오류');
assert(contactDirectoryAudit.hongMinyoung?.ext === '821' && contactDirectoryAudit.hongWonjeong?.role === '상담지원' && contactDirectoryAudit.hongWonjeong.ext === '821', '학생생활안전부 상담지원 연락처 오류');
assert(contactDirectoryAudit.kimJeryeongBroadcast?.ext === '833' && contactDirectoryAudit.kimJeryeongHomeroom?.ext === '856', '김제령 위치별 내선 오류');
assert(contactDirectoryAudit.officeMain?.phone === '721-1152' && contactDirectoryAudit.officeFax?.phone === '750-3888' && contactDirectoryAudit.cafeteriaFax?.phone === '750-3889', '대표전화 또는 팩스 연락처 오류');
assert(contactDirectoryAudit.addedPeople.every(Boolean), '급식소·배움터지킴이·축구부 신규 연락처 누락');
assert(contactDirectoryAudit.musicRoom?.ext === '846' && contactDirectoryAudit.corporateOffice?.role === '사무국장', '음악실 또는 법인사무국 연락처 오류');

const externalBlock = read(`buildSwapLessonBlock('201 독서', '강승표', '월', 1, true, 0)`);
assert(externalBlock.includes('var(--cell-mint-bg)') && !externalBlock.includes('[강사]'), '교체·대체 민트 수업에 [강사] 표시가 남아 있음');

const teacherPopupAudit = read(`({
  link: teacherScheduleLink('김영주', '김영주 선생님', 'result-card-name'),
  unknown: teacherScheduleLink('없는교사', '없는교사', 'result-card-name'),
  openHandler: typeof openTeacherSchedulePopup,
  closeHandler: typeof closeTeacherSchedulePopup,
})`);
assert(teacherPopupAudit.link.includes("openTeacherSchedulePopup('김영주')") && teacherPopupAudit.link.includes('시간표 보기'), '매칭 결과 교사 이름에 시간표 팝업 연결 누락');
assert(!teacherPopupAudit.unknown.includes('openTeacherSchedulePopup'), '시간표가 없는 이름에 팝업 링크가 생성됨');
assert(teacherPopupAudit.openHandler === 'function' && teacherPopupAudit.closeHandler === 'function', '교사 시간표 팝업 함수 누락');
assert(fs.readFileSync(path.join(root, 'docs/js/app.js'), 'utf8').includes('buildTeacherDetailCard(teacher, false, true)'), '교사 팝업 전용 시간표 렌더링 누락');
const teacherPopupMarkup = fs.readFileSync(path.join(root, 'docs/index.html'), 'utf8');
assert(teacherPopupMarkup.includes('id="teacherScheduleModal"') && teacherPopupMarkup.includes('id="teacherScheduleModalBody"'), '교사 시간표 팝업 마크업 누락');

const industryCoTeachingAudit = read(`(() => {
  let substituteCount = 0;
  for (const teacher of INDUSTRY_CO_TEACHING_TEACHERS) {
    for (const [slot, values] of Object.entries(EXTERNAL_LESSONS[teacher] || {})) {
      const match = slot.match(/^(.+?)([1-7])$/);
      if (!match) continue;
      for (const value of values) {
        substituteCount += findSubstituteCandidates(teacher, match[1], Number(match[2]), value).length;
      }
    }
  }
  return { substituteCount, teachers:[...INDUSTRY_CO_TEACHING_TEACHERS] };
})()`);
assert(industryCoTeachingAudit.substituteCount === 0, '임장 필수 산학교사 수업에 대체 후보 발생');
assert(JSON.stringify(industryCoTeachingAudit.teachers) === JSON.stringify(['김영조','김영주','오소연','이상분']), '임장 필수 교사 명단 오류');

const industryMeetingAudit = read(`(() => {
  const missed = [];
  for (const teacher of INDUSTRY_CO_TEACHING_TEACHERS) {
    for (const [slot, values] of Object.entries(EXTERNAL_LESSONS[teacher] || {})) {
      const match = slot.match(/^(.+?)([1-7])$/);
      if (!match) continue;
      for (const value of values) {
        const info = parseCellValue(value, teacher, slot, true);
        if (!isTeacherBusyAt(teacher, match[1], Number(match[2]), info)) missed.push(teacher + ':' + slot);
      }
    }
  }
  return missed;
})()`);
assert(industryMeetingAudit.length === 0, '산학교사 임장 수업이 협의시간에서 공강으로 판정됨');

const reportedSwapRegression = read(`(() => {
  const source = createLessonRecord('김영주', '금', 4, TEACHER_SCHEDULE['김영주']['금4']);
  const candidate = createLessonRecord('김재현', '화', 2, TEACHER_SCHEDULE['김재현']['화2']);
  const evaluation = evaluateVirtualSwap(source, candidate);
  const shown = findSwapCandidates('김영주', '금', 4, TEACHER_SCHEDULE['김영주']['금4'])
    .some(item => item.teacher === '김재현' && item.day === '화' && item.period === 2);
  return {
    shown,
    valid: evaluation.valid,
    teacherConflicts: evaluation.teacherConflicts.map(item => item.teacher),
    classConflictCount: evaluation.classConflicts.length,
  };
})()`);
assert(!reportedSwapRegression.shown, '김영주 금4 ↔ 김재현 화2 오류 후보가 다시 표시됨');
assert(!reportedSwapRegression.valid && reportedSwapRegression.teacherConflicts.includes('김영주'), '김영주 화2 기존 수업 충돌을 가상 맞교환 검증이 찾지 못함');

const ohSeungcheolRegression = read(`(() => {
  const sourceValue = TEACHER_SCHEDULE['김영주']['금4'];
  const candidates = findSwapCandidates('김영주', '금', 4, sourceValue);
  const wrongCandidates = candidates.filter(item => item.teacher === '오승철');
  const selectedLesson = createLessonRecord('오승철', '금', 4, TEACHER_SCHEDULE['오승철']['금4']);
  return {
    wrongCandidates,
    fridayFourthIsSelection: parseCellValue(selectedLesson.value, '오승철', '금4').isSelect,
    busyAtSamePeriod: isTeacherBusyAt('오승철', '금', 4, parseCellValue(sourceValue, '김영주', '금4')),
  };
})()`);
assert(ohSeungcheolRegression.fridayFourthIsSelection, '오승철 금4 선택과목 표시 누락');
assert(ohSeungcheolRegression.busyAtSamePeriod, '학년별 시각 차이 때문에 오승철 금4 수업을 공강으로 판정함');
assert(ohSeungcheolRegression.wrongCandidates.length === 0, '김영주 금4 교체 후보에 오승철이 표시됨');

const baseCollisionAudit = read(`(() => {
  let teacherConflicts = 0;
  let classConflicts = 0;
  const snapshot = createScheduleSnapshot();
  for (const teacher of Object.keys(TEACHER_SCHEDULE)) {
    teacherConflicts += findScheduleRecordConflicts(getTeacherLessonRecords(teacher, snapshot)).length;
  }
  for (const classKey of Object.keys(CLASS_SCHEDULE)) {
    classConflicts += findScheduleRecordConflicts(getClassLessonRecords(classKey, snapshot)).length;
  }
  return { teacherConflicts, classConflicts };
})()`);
assert(baseCollisionAudit.teacherConflicts === 0, '현재 교사시간표에 중복 수업이 있음');
assert(baseCollisionAudit.classConflicts === 0, '현재 학급시간표에 중복 수업이 있음');

const specialRoomPolicyAudit = read(`(() => {
  const source = createLessonRecord('가상교사A', '월', 1, '101 테스트 회계실');
  const candidate = createLessonRecord('가상교사B', '화', 2, '102 테스트');
  const snapshot = createScheduleSnapshot();
  snapshot.teacherRecords.set(source.teacher, [source]);
  snapshot.teacherRecords.set(candidate.teacher, [candidate]);
  snapshot.classRecords.set(source.classKey, [{ ...source }]);
  snapshot.classRecords.set(candidate.classKey, [{ ...candidate }]);
  return {
    roomAlreadyUsed: !!LAB_SCHEDULE['회계실']['화'][2],
    swapAllowed: evaluateVirtualSwap(source, candidate, snapshot).valid,
  };
})()`);
assert(specialRoomPolicyAudit.roomAlreadyUsed && specialRoomPolicyAudit.swapAllowed, '특별실 충돌 때문에 교체 후보가 차단됨');

const specialRoomDataAudit = read(`(() => {
  let fourthPeriodObjects = 0, gradeMisplacements = 0, unmatchedLessons = 0;
  for (const [room, week] of Object.entries(LAB_SCHEDULE)) {
    for (const [day, periods] of Object.entries(week)) {
      for (const [periodText, raw] of Object.entries(periods)) {
        const period = Number(periodText), entries = raw && typeof raw === 'object' ? Object.entries(raw) : raw ? [[null, raw]] : [];
        if (period === 4 && raw && typeof raw === 'object') fourthPeriodObjects++;
        for (const [group, value] of entries) {
          if (!value) continue;
          const parts = String(value).split(/\\s+/), classNum = parts[0], subject = parts[1], teacher = parts.at(-1), slot = day + period;
          if (group && (classNum.startsWith('3') ? '3' : '12') !== group) gradeMisplacements++;
          const candidates = [(TEACHER_SCHEDULE[teacher] || {})[slot] || '', ...((EXTERNAL_LESSONS[teacher] || {})[slot] || [])];
          const matched = candidates.some(candidate => {
            const candidateParts = String(candidate).split(/\\s+/);
            return candidateParts[0] === classNum && String(candidateParts[1] || '').replace(/^[A-Z]_/, '') === subject;
          });
          if (!matched) unmatchedLessons++;
        }
      }
    }
  }
  return { fourthPeriodObjects, gradeMisplacements, unmatchedLessons, popupHandler: typeof openLabLessonMatching === 'function' };
})()`);
assert(specialRoomDataAudit.fourthPeriodObjects === 35, '특별실 4교시가 1·2학년/3학년 구조로 분리되지 않음');
assert(specialRoomDataAudit.gradeMisplacements === 0, '특별실 4교시 학년 그룹 배치 오류');
assert(specialRoomDataAudit.unmatchedLessons === 0, '특별실 시간표가 교사 시간표와 일치하지 않음');
assert(specialRoomDataAudit.popupHandler, '실습실 교체·대체 팝업 연결 누락');

const labDisplayAudit = read(`Object.fromEntries(Object.keys(LAB_SCHEDULE).map(name => [name, getLabDisplayName(name)]))`);
assert(labDisplayAudit['만콘실'] === '만화콘텐츠 제작실', '만콘실 정식 명칭 오류');
assert(labDisplayAudit['영상실'] === '영상제작실', '영상실 정식 명칭 오류');
assert(labDisplayAudit['컴그실'] === '컴퓨터그래픽실', '컴그실 정식 명칭 오류');
assert(labDisplayAudit['회계실'] === '회계실무실', '회계실 정식 명칭 오류');
assert(labDisplayAudit['사행실'] === '사무행정실', '사행실 정식 명칭 오류');
assert(labDisplayAudit['창구실'] === '창구사무실', '창구실 정식 명칭 오류');
assert(labDisplayAudit['전상실'] === '전자상거래실', '전상실 정식 명칭 오류');
const labMarkup = fs.readFileSync(path.join(root, 'docs/index.html'), 'utf8');
const labStyles = fs.readFileSync(path.join(root, 'docs/css/style.css'), 'utf8');
const dashboardSource = fs.readFileSync(path.join(root, 'docs/js/dashboard.js'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'docs/js/app.js'), 'utf8');
assert(labMarkup.includes('lab-browser-layout') && labMarkup.includes('lab-selector-header'), '실습실 고급형 레이아웃 마크업 누락');
assert(labStyles.includes('.lab-detail-header') && labStyles.includes('.lab-room-button.active'), '실습실 고급형 디자인 CSS 누락');
assert(dashboardSource.includes('displayRoom(room)') && dashboardSource.includes('value="${esc(room)}"'), '예약 화면 정식 명칭 표시 또는 내부 키 보존 누락');
assert(appSource.includes('href="tel:${phoneDigits}"') && appSource.includes('copyContactPhone'), '연락처 전화/복사 동작 누락');
assert(labStyles.includes('.contact-phone-actions') && labStyles.includes('min-height: 44px'), '연락처 모바일 터치 영역 CSS 누락');
assert(appSource.includes('class="teacher-period-number">${p}교시</strong>') && appSource.includes('class="teacher-period-time">${getPeriodTime(p, gradeGroup === \'3\' ? \'3\' : \'1\')'), '교사 시간표 교시/시간 두 줄 표시 누락');
assert(labStyles.includes('.teacher-period-number') && labStyles.includes('white-space: nowrap'), '교시명이 한 줄로 고정되지 않음');
assert(labStyles.includes('.teacher-schedule-popup-body .teacher-period-number') && labStyles.includes('width: 92px !important'), '교사 팝업의 교시/시간 두 줄 고정 CSS 누락');
const septemberPlanAudit = read(`(() => {
  const plan = ACADEMIC_CALENDAR.filter(event => event.source === '2026-09-education-plan');
  const merged = mergeAcademicCalendarWithBaseline([
    { date:'2026-09-05', day:'토', event:'수능모의평가 (3학년)', type:'exam' },
    { date:'2026-08-13', day:'목', event:'2학기 개학', type:'important' }
  ]);
  return {
    count: plan.length,
    mockExamDate: plan.find(event => event.event === '수능모의평가 (3학년)')?.date,
    hasLegacyMockExam: merged.some(event => event.date === '2026-09-05' && event.event === '수능모의평가 (3학년)'),
    hasSeptember26Holiday: plan.some(event => event.date === '2026-09-26' && event.event === '추석 연휴')
  };
})()`);
assert(septemberPlanAudit.count === 34, '9월 교육활동계획 일정 수 누락');
assert(septemberPlanAudit.mockExamDate === '2026-09-02' && !septemberPlanAudit.hasLegacyMockExam, '3학년 수능모의평가 날짜 보정 오류');
assert(septemberPlanAudit.hasSeptember26Holiday, '9월 26일 추석 연휴 누락');
const requiredClubDates = ['2026-08-28','2026-09-11','2026-10-23','2026-11-13','2026-11-27','2026-12-11'];
assert(requiredClubDates.every(date => read(`ACADEMIC_CALENDAR`).some(event => event.date === date && event.event === '동아리')), '지정일 동아리 학사일정 누락');
assert(dashboardSource.includes('parseBusDutyWorkbook') && dashboardSource.includes("shared/dashboard/busDuty") && dashboardSource.includes('dashboardOpenBusDutySwap'), '승차지도 엑셀/날짜 교환 기능 누락');
assert(dashboardSource.includes('wideGrades') && dashboardSource.includes('teacherColumn'), '승차지도 가로형/세로형 엑셀 인식 누락');
assert(dashboardSource.includes('dashboardOpenBusDutyCalendar') && dashboardSource.includes('dashboardMoveBusDutyCalendar') && dashboardSource.includes('dashboard-bus-cal-grid'), '월별 승차지도 달력 팝업 누락');
const dashboardStyles = fs.readFileSync(path.join(root, 'docs/css/dashboard.css'), 'utf8');
assert(dashboardStyles.includes('.dashboard-bus-cal-weekdays') && dashboardStyles.includes('grid-template-columns:repeat(7'), '월별 승차지도 7열 달력 CSS 누락');
assert(dashboardSource.includes('dashboardFilterBusDutyCalendar') && dashboardSource.includes('data-teacher=') && dashboardSource.includes('dashboardBusDutySearchStatus'), '월별 승차지도 교사 검색 기능 누락');
assert(dashboardStyles.includes('.is-search-match') && dashboardStyles.includes('@keyframes bus-duty-search-sparkle'), '승차지도 검색 결과 반짝임 CSS 누락');
assert(dashboardSource.includes("id==='schedule'||id==='major'") && dashboardSource.includes("dashboardOpenAcademicCalendar('${id}')"), '학사일정/주요 일정 월별 달력 버튼 누락');
assert(dashboardSource.includes('dashboardMoveAcademicCalendar') && dashboardSource.includes('dashboardSetAcademicCalendarMonth') && dashboardSource.includes('dashboard-academic-cal-grid'), '월별 학사일정 달력 팝업 누락');
assert(dashboardStyles.includes('.dashboard-academic-cal-weekdays') && dashboardStyles.includes('.dashboard-academic-cal-event.type-important'), '월별 학사일정 달력 CSS 누락');
assert(dashboardSource.includes('dashboardOpenMajorHwpxUpload') && dashboardSource.includes('parseMajorHwpx') && dashboardSource.includes('dashboardSaveMajorHwpx'), '주요 일정 HWPX 업로드 기능 누락');
assert(dashboardSource.includes("source:'hwpx'") && dashboardSource.includes('shared/dashboard/majorEvents'), 'HWPX 주요 일정 저장 연동 누락');
assert(dashboardSource.includes('renderCalendarMemo') && dashboardSource.includes('오늘은 동아리 활동이 예정되어 있습니다.'), '오늘의 알림장 동아리 일정 연동 누락');
assert(dashboardSource.includes('schoolAppAnonymousVisitorId') && dashboardSource.includes('shared/dashboard/anonymousVisitors') && dashboardSource.includes('.transaction('), 'IP 없는 익명 방문자 중복 방지 집계 누락');
assert(dashboardSource.includes('dashboardVisitorCount') && dashboardStyles.includes('.dashboard-visitor-counter'), '누적 방문자 표시 UI 누락');
assert(dashboardSource.includes('dashboardDailyVisitorCount') && dashboardSource.includes('dailyAnonymousVisitors') && dashboardSource.includes('connectDailyVisitor'), '날짜별 익명 방문자 집계 누락');
assert(labStyles.includes('.teacher-schedule-tab .teacher-schedule-button') && labStyles.includes('display: table-cell !important'), '교사 목록 또는 교시 셀 레이아웃 CSS 누락');
assert(labStyles.includes('.class-schedule-tab .class-schedule-button') && labStyles.includes('overflow-wrap: anywhere'), '학급 목록 버튼 내부 맞춤 레이아웃 누락');
assert(labMarkup.includes('subject-browser-tab') && labMarkup.includes('subject-selector-header'), '교과별 수업 브라우저형 마크업 누락');
assert(appSource.includes('subject-selector-button') && labStyles.includes('.subject-browser-layout') && labStyles.includes('--subject-blue'), '교과별 수업 하늘색 디자인 누락');
assert(labStyles.includes('.subject-selector-panel .side-btn-list') && labStyles.includes('overflow: visible'), '교과 선택 목록 내부 스크롤 제거 누락');
assert(labStyles.includes('.subject-browser-tab .teacher-premium-table { min-width: 0 !important') && labStyles.includes('.subject-browser-tab .premium-schedule-scroll { overflow-x: visible'), '교과별 모바일 시간표 화면 맞춤 누락');
assert(labMarkup.includes('premium-meeting-tab') && labMarkup.includes('meeting-tab-toolbar') && labMarkup.includes('meeting-selector-header'), '협의시간 프리미엄 레이아웃 마크업 누락');
assert(labStyles.includes('@container meeting-panel') && labStyles.includes('.premium-meeting-tab .meeting-th-day') && appSource.includes('meeting-teacher-icon'), '협의시간 옅은 노랑 반응형 디자인 누락');
assert(!labMarkup.includes('class="new-tab-badge"'), '상단 탭 NEW 배지가 남아 있음');

const movingRoomAudit = read(`(() => {
  const codes = new Set();
  Object.values(TEACHER_SCHEDULE).forEach(schedule => Object.values(schedule).forEach(value => {
    const code = getTimeGroupCode(value); if (code) codes.add(code);
  }));
  const unmappedCodes = [...codes].filter(code => !TIME_GROUP_ROOM_ASSIGNMENTS[code]);
  return {
    assignmentCount: Object.keys(TIME_GROUP_ROOM_ASSIGNMENTS).length,
    unmappedCodes,
    psychologyRooms: getTimeGroupRooms('204 A_심리'),
    psychologyUse: getTimeGroupRoomUse('자기주도학습실', '월', 4, '12'),
    home204Occupied: isClassroomOccupiedByLesson('2-4', CLASS_SCHEDULE['2-4']['월4']),
    home201Occupied: isClassroomOccupiedByLesson('2-1', CLASS_SCHEDULE['2-1']['월4']),
    infoRoomUse: getTimeGroupRoomUse('정보교실', '월', 4, '12').map(use => use.code),
    creditRoomUse: getTimeGroupRoomUse('학점제실1', '월', 4, '3').map(use => use.code),
  };
})()`);
assert(movingRoomAudit.assignmentCount >= 80, 'PDF 타임별 강의실 매핑 수 부족');
assert(movingRoomAudit.unmappedCodes.length === 0, `타임별 강의실 미매핑: ${movingRoomAudit.unmappedCodes.join(', ')}`);
assert(JSON.stringify(movingRoomAudit.psychologyRooms) === JSON.stringify(['자기주도학습실']), 'A_심리 강의실 매핑 오류');
assert(movingRoomAudit.psychologyUse.some(use => use.code === 'A_심리' && use.teacher === '홍원정'), 'A_심리 특별실 정규 사용 누락');
assert(!movingRoomAudit.home204Occupied && movingRoomAudit.home201Occupied, '이동수업 교실 비움/일반 교실 사용 판정 오류');
assert(movingRoomAudit.infoRoomUse.includes('A_경제'), '정보교실 A_경제 정규 사용 누락');
assert(movingRoomAudit.creditRoomUse.includes('A_고전'), '학점제실1 A_고전 정규 사용 누락');
assert(dashboardSource.includes('isClassroomOccupiedByLesson(classKey,lesson)') && dashboardSource.includes('getTimeGroupRoomUse(room,day,p,group)'), '오늘의 예약 이동수업 판정 연결 누락');
assert(labMarkup.includes('isClassroomOccupiedByLesson(classKey, lesson)') && labMarkup.includes('getTimeGroupRoomUse(room, dayKey, periodNumber, gradeGroup)'), '예약 저장 시 이동수업 판정 연결 누락');
assert(labStyles.includes('.teacher-schedule-tab .teacher-detail-header') && labStyles.includes('.class-detail-header'), '교사/학급 프리미엄 디자인 CSS 누락');

const candidateAudit = read(`(() => {
  const groups = getSubjectGroups();
  let badSubstitutes = 0, placeholderSubstitutes = 0, invalidSubstitutes = 0;
  let selectionSwaps = 0, externalSwaps = 0, externalSubstitutes = 0, invalidVirtualSwaps = 0, swapCount = 0;
  const snapshot = createScheduleSnapshot();
  const auditLesson = (teacher, slot, value, external = false) => {
    const match = slot.match(/^(.+?)([1-7])$/); if (!match) return;
    const day = match[1], period = Number(match[2]);
    const info = parseCellValue(value, teacher, slot, external);
    const swaps = external ? [] : findSwapCandidates(teacher, day, period, value, snapshot);
    swapCount += swaps.length;
    if (info.isSelect) selectionSwaps += swaps.length;
    if (external) externalSwaps += swaps.length;
    const source = external ? null : createLessonRecord(teacher, day, period, value);
    for (const swap of swaps) {
      const candidateValue = (TEACHER_SCHEDULE[swap.teacher] || {})[swap.day + swap.period];
      const candidate = createLessonRecord(swap.teacher, swap.day, swap.period, candidateValue);
      if (!evaluateVirtualSwap(source, candidate, snapshot).valid) invalidVirtualSwaps++;
    }
    const sourceGroup = Object.entries(groups).find(([, names]) => names.includes(teacher));
    const substitutes = findSubstituteCandidates(teacher, day, period, value);
    if (external) externalSubstitutes += substitutes.length;
    for (const candidate of substitutes) {
      if (!sourceGroup || !sourceGroup[1].includes(candidate.teacher)) badSubstitutes++;
      if (candidate.teacher.includes('온라인') || candidate.teacher === '중국어특성화') placeholderSubstitutes++;
      if (!canSubstituteLesson(candidate.teacher, day, period, info)) invalidSubstitutes++;
    }
  };
  for (const [teacher, row] of Object.entries(TEACHER_SCHEDULE)) for (const [slot, value] of Object.entries(row)) auditLesson(teacher, slot, value);
  for (const [teacher, row] of Object.entries(EXTERNAL_LESSONS)) for (const [slot, values] of Object.entries(row)) for (const value of values) auditLesson(teacher, slot, value, true);
  return { badSubstitutes, placeholderSubstitutes, invalidSubstitutes, selectionSwaps, externalSwaps, externalSubstitutes, invalidVirtualSwaps, swapCount };
})()`);
assert(candidateAudit.badSubstitutes === 0, '다른 교과 대체 후보 발생');
assert(candidateAudit.placeholderSubstitutes === 0, '온라인/특성화 표시 항목이 대체 교사로 나옴');
assert(candidateAudit.invalidSubstitutes === 0, '교사/학급 충돌이 있는 대체 후보 발생');
assert(candidateAudit.selectionSwaps === 0, '선택과목 교체 후보 발생');
assert(candidateAudit.externalSwaps === 0, '외부강사 교체 후보 발생');
assert(candidateAudit.externalSubstitutes === 0, '외부강사 대체 후보 발생');
assert(candidateAudit.invalidVirtualSwaps === 0, '가상 맞교환 후 충돌하는 교체 후보 발생');

const afterSchoolSource = fs.readFileSync(path.join(root, 'docs/js/afterschool.js'), 'utf8');
const afterSchoolStyles = fs.readFileSync(path.join(root, 'docs/css/afterschool.css'), 'utf8');
assert(teacherPopupMarkup.includes('onclick="openClubAttendancePopup()"') && !teacherPopupMarkup.includes("onclick=\"location.href='club.html'\""), '동아리 출석부 현재창 이동이 남아 있음');
assert(appSource.includes('function openClubAttendancePopup()') && appSource.includes("window.open('club.html', 'clubAttendancePopup'"), '동아리 출석부 팝업 열기 기능 누락');
assert(teacherPopupMarkup.includes('data-tab="afterSchool"') && teacherPopupMarkup.includes('id="afterSchoolAttendanceRoot"'), '방과후학교 출석부 탭 마크업 누락');
assert(teacherPopupMarkup.includes('js/afterschool.js') && teacherPopupMarkup.includes('css/afterschool.css'), '방과후학교 출석부 자원 연결 누락');
assert(afterSchoolSource.includes('JSZip.loadAsync') && afterSchoolSource.includes('Contents\\/section'), 'HWPX 학생 명단 파서 누락');
assert(teacherPopupMarkup.includes('pako.min.js') && afterSchoolSource.includes('parseHwpBinary') && afterSchoolSource.includes('XLSX.CFB.read'), 'HWP 5.x 바이너리 출석부 파서 누락');
assert(fs.readFileSync(path.join(root, 'docs/js/app.js'), 'utf8').includes('function ensureAfterSchoolAttendance()') && teacherPopupMarkup.includes('js/afterschool.js?v=20260831-10'), '방과후학교 출석부 런타임 재로딩 보호 누락');
assert(afterSchoolSource.includes('afterSchoolCreateProgram') && afterSchoolSource.includes('afterRegisterTeacher') && afterSchoolSource.includes('afterRegisterPin') && !afterSchoolSource.includes('id="afterRegisterUploader"'), '방과후학교 출석부 간소화 등록 기능 누락');
assert(afterSchoolSource.includes('S.programs=cleanPlaceholderPrograms(remote)') && !afterSchoolSource.includes('merged={...S.programs,...remote}'), 'Firebase 전체 삭제 후 로컬 기존 목록이 다시 합쳐지는 오류');
assert(afterSchoolSource.includes('afterSchoolPreviewRegisterFile') && afterSchoolSource.includes('teacherNearLabels') && afterSchoolSource.includes('sameRegisterFile'), 'HWP/HWPX 과목·지도교사 자동 입력 누락');
assert(afterSchoolSource.includes('existingProgramsCard') && afterSchoolSource.includes('afterExistingPin') && afterSchoolSource.includes('afterSchoolUnlockSelected'), '등록 출석부 목록·4자리 비밀번호 진입 화면 누락');
assert(afterSchoolSource.includes('방과후 과목을 선택하세요') && afterSchoolSource.includes("const id=$('afterExistingProgram')?.value||''"), '방과후 과목 기본 선택 안내 또는 명시적 선택 검증 누락');
assert(afterSchoolSource.includes("history.pushState") && afterSchoolSource.includes("window.addEventListener('popstate'") && afterSchoolSource.includes('returnToEntry()'), '출석부 뒤로가기 초기화면 복귀 처리 누락');
assert(afterSchoolSource.includes("p.uploader=''") && afterSchoolStyles.includes('#afterSchoolPrintSheet{display:none}') && afterSchoolStyles.includes('#afterSchoolPrintSheet{display:block!important}'), '등록자 제거 또는 출력용 서식 화면 노출 차단 누락');
assert(afterSchoolSource.includes('function dateInputTabs(') && afterSchoolSource.includes('function attendanceOverview('), '출결 입력 날짜 또는 일자별 현황표 누락');
assert(afterSchoolSource.includes('window.afterSchoolDownloadHwp') && afterSchoolSource.includes("type:'application/x-hwp;charset=utf-8'"), '한글 HWP 다운로드 기능 누락');
assert(afterSchoolStyles.includes('.after-input-dates') && afterSchoolStyles.includes('.after-overview-wrap'), '일자별 출결 화면 CSS 누락');
assert(afterSchoolStyles.includes('margin:18mm 25mm') && afterSchoolStyles.includes('mso-header-margin:15mm') && afterSchoolStyles.includes('mso-footer-margin:15mm') && afterSchoolStyles.includes('mso-gutter-margin:0mm'), '출석부 용지·머리말·꼬리말·제본 여백 설정 누락');
assert(afterSchoolStyles.includes('"Hancom Gothic","한컴고딕"') && afterSchoolStyles.includes('font-size:10pt!important'), '출석부 한컴고딕 10pt 출력 설정 누락');
assert(afterSchoolSource.includes('margin:18mm 25mm') && afterSchoolSource.includes("font-family:'Hancom Gothic','한컴고딕'"), '한글 다운로드 여백 또는 글꼴 설정 누락');
assert(afterSchoolSource.includes('function hwpSheet(') && afterSchoolSource.includes('<body>${hwpSheet(p)}</body>'), '한글 다운로드 전용 표 기반 서식 누락');
assert(afterSchoolSource.includes('width:11.3%') && afterSchoolSource.includes('49.5/dates.length') && afterSchoolSource.includes('<col style="width:6%"><col style="width:6%"><col style="width:6%"><col style="width:6%">'), '원본 템플릿 학생·날짜·출결 열 실측 비율 누락');
assert(afterSchoolSource.includes('width:62%') && afterSchoolSource.includes('width:16%'), '원본 템플릿 제목·결재란 실측 비율 누락');
assert(afterSchoolStyles.includes('table-layout:fixed!important') && afterSchoolStyles.includes('width:auto!important;min-width:0!important'), '웹 인쇄 원본 템플릿 colgroup 고정 적용 누락');
assert(afterSchoolSource.includes('printSheet=hwpSheet') && afterSchoolSource.includes('el.innerHTML=hwpSheet(p)'), '웹 인쇄와 한글 다운로드 서식 통합 누락');
assert(afterSchoolSource.includes('function requestAccessPin(') && afterSchoolSource.includes('function verifyAccess(') && afterSchoolSource.includes('p.accessPin=pin') && afterSchoolSource.includes('window.afterSchoolChangePin'), '등록 교사 지정 4자리 출석부 비밀번호 누락');
assert(afterSchoolSource.includes('function cleanPlaceholderPrograms(') && afterSchoolSource.includes('빈 출석부 정리 실패'), '중복된 등록 미지정 빈 출석부 자동 정리 누락');
assert(fs.readFileSync(path.join(root, 'docs/js/dashboard.js'), 'utf8').includes('dashboardAdminResetAfterSchoolPin') && fs.readFileSync(path.join(root, 'docs/js/dashboard.js'), 'utf8').includes("afterSchool:'shared/afterSchoolAttendance'"), '운영관리자 출석부 비밀번호 초기화 누락');
assert(fs.readFileSync(path.join(root, 'docs/js/dashboard.js'), 'utf8').includes('dashboardAdminDeleteAfterSchool') && fs.readFileSync(path.join(root, 'docs/js/dashboard.js'), 'utf8').includes('모든 출결 기록을 삭제'), '운영관리자 출석부 목록 삭제 누락');
assert(!fs.readFileSync(path.join(root, 'docs/js/dashboard.js'), 'utf8').includes('CONSTITUTION_NOTICE') && fs.readFileSync(path.join(root, 'docs/js/dashboard.js'), 'utf8').includes('isRemovedConstitutionNotice'), '헌법교육 고정 공지 제거 또는 기존 자료 정리 누락');
const examSupervisionSource=fs.readFileSync(path.join(root,'docs/js/exam-supervision.js'),'utf8');
const examSupervisionStyles=fs.readFileSync(path.join(root,'docs/css/exam-supervision.css'),'utf8');
const examSupervisionResponsiveStyles=fs.readFileSync(path.join(root,'docs/css/exam-supervision-responsive.css'),'utf8');
const examSupervisionEnhancedStyles=fs.readFileSync(path.join(root,'docs/css/exam-supervision-enhanced.css'),'utf8');
assert(teacherPopupMarkup.includes('data-tab="examSupervision"') && teacherPopupMarkup.includes('id="examSupervisionTab"'), '감독시간표 탭 또는 패널 누락');
assert(examSupervisionSource.includes("date:'2026-09-02'") && examSupervisionSource.includes("title:'9월 학력평가'"), '9월 2일 학력평가 감독일 누락');
assert(examSupervisionSource.includes("subject:'국어'") && examSupervisionSource.includes("subject:'수학'") && examSupervisionSource.includes("subject:'영어'") && examSupervisionSource.includes("subject:'한국사·탐구'"), '학력평가 교시별 과목 누락');
assert(examSupervisionSource.includes('searchExamSupervision') && examSupervisionSource.includes('assignmentTime'), '감독교사 검색 또는 시간 확인 기능 누락');
assert(examSupervisionStyles.includes('.exam-teacher-cell.is-match') && examSupervisionStyles.includes('@keyframes exam-cell-pulse'), '감독 검색 결과 강조 CSS 누락');
assert(examSupervisionSource.includes('function matrix(') && examSupervisionSource.includes('colspan="10"') && examSupervisionSource.includes('1~3학년 전체 학급'), '1~3학년 전체 감독표 한 화면 표시 누락');
assert(!examSupervisionSource.includes('하루 종일 감독이 없는 교사'), '삭제된 하루 종일 무감독 교사 영역이 다시 표시됨');
assert(examSupervisionSource.includes('12:55~13:20') && examSupervisionSource.includes('12:25~12:55') && examSupervisionSource.includes('12:00~12:25'), '학년별 점심시간 표시 누락');
assert(examSupervisionStyles.includes('.exam-matrix') && examSupervisionStyles.includes('zoom:calc((100vw - 42px)/1280)'), '감독표 전체 축소 또는 모바일 한 화면 표시 CSS 누락');
assert(examSupervisionResponsiveStyles.includes('transform:scale(.27)') && examSupervisionResponsiveStyles.includes('height:105px'), '모바일 30개 학급 전체 감독표 고정 축소 누락');
assert(examSupervisionSource.includes('oncompositionstart=') && examSupervisionSource.includes('event?.isComposing') && examSupervisionSource.includes('examSupervisionComposition'), '감독 교사 검색 한글 IME 조합 보호 누락');
assert(examSupervisionSource.includes('examSupervisionImportExcel') && examSupervisionSource.includes("shared/examSupervision/${day.date}") && examSupervisionSource.includes('parseExamSupervisionWorkbook'), '감독표 엑셀 업로드 또는 날짜별 공유 저장 누락');
assert(examSupervisionSource.includes('selectExamSupervisionDate') && examSupervisionSource.includes('시험일 선택'), '시험일별 감독표 탭 누락');
assert(examSupervisionSource.includes('selectExamSupervisionGrade') && examSupervisionSource.includes('학년 선택') && examSupervisionSource.includes("S.grade?'is-single':''"), '감독표 학년별 확대 보기 누락');
assert(examSupervisionEnhancedStyles.includes('.exam-matrix.is-single') && examSupervisionEnhancedStyles.includes('.exam-grade-filter'), '감독표 학년별 확대 디자인 누락');
assert(examSupervisionEnhancedStyles.includes('.exam-time-guide{display:none!important}') && examSupervisionEnhancedStyles.includes('border-collapse:separate') && examSupervisionEnhancedStyles.includes('#eadfce'), '감독 시험시간 영역 제거 또는 연한 베이지 프리미엄 표 디자인 누락');
assert(examSupervisionSource.includes("document.addEventListener('compositionend'") && examSupervisionSource.includes("document.addEventListener('input'") && examSupervisionEnhancedStyles.includes('font-weight:900'), '감독 교사 검색 이벤트 보강 또는 학급·교사 글자 강조 누락');
assert(examSupervisionSource.includes('입력과 동시에 해당 교사와 교시가 반짝입니다') && examSupervisionSource.includes("classList.toggle('is-match'"), '감독 검색 시 엔터 없는 즉시 강조 방식 누락');
assert(examSupervisionSource.includes("CHOSEONG='ㄱㄲㄴㄷ") && examSupervisionSource.includes("classList.toggle('is-period-match'"), '감독 교사 초성 검색 또는 일치 교시 강조 누락');
assert(examSupervisionEnhancedStyles.includes('.exam-period-row.is-period-match>th') && examSupervisionEnhancedStyles.includes('@keyframes exam-duty-search-sparkle') && examSupervisionEnhancedStyles.includes('#ffbd3d'), '승차지도 방식의 교사·교시 반짝임 디자인 누락');
assert(afterSchoolSource.includes("personSelect('uploader','올린 사람'") && afterSchoolSource.includes("personSelect('teacher','지도교사'"), '올린 사람/지도교사 연락처 선택 누락');
assert(afterSchoolSource.includes('dailyChecks') && afterSchoolSource.includes('afterSchoolUpdateDailyCheck') && afterSchoolSource.includes("daily('teacherConfirm')"), '수업일별 점검사항/담당강사 확인 누락');
assert(afterSchoolSource.includes('${d.getMonth()+1}/${d.getDate()}') && afterSchoolSource.includes('weekdays=dates.map'), '날짜 M/D 및 요일 아래행 출력 누락');
assert(afterSchoolSource.includes('.info-table td{padding:8px;text-align:left') && afterSchoolSource.includes('.note-cell{height:45px;padding:6px;text-align:left'), '운영정보 또는 비고 왼쪽 정렬 누락');
assert(afterSchoolSource.includes('align="left" style="text-align:left!important"'), '한글 호환 운영요일/수업시수 인라인 왼쪽 정렬 누락');
assert(afterSchoolSource.includes('class="note-cell" align="left" style="text-align:left!important"'), '한글 호환 비고 인라인 왼쪽 정렬 누락');
assert(afterSchoolSource.includes('i+=10') && afterSchoolSource.includes('page-break-after:always') && afterSchoolSource.includes('attendance-output-page'), '출력/한글 날짜 10칸 단위 페이지 분할 누락');
assert(afterSchoolStyles.includes('.after-lock-card'), '지도교사 전화번호 확인 화면 CSS 누락');
assert(afterSchoolSource.includes("O:'○'") && afterSchoolSource.includes("A:'/'") && afterSchoolSource.includes("X:'X'") && afterSchoolSource.includes("E:'△'"), '출결 기호 정책 누락');
assert(afterSchoolSource.includes('shared/afterSchoolAttendance') && afterSchoolSource.includes('function totals('), '출석부 공유 저장 또는 자동 합계 누락');
assert(afterSchoolSource.includes('window.afterSchoolPrint') && afterSchoolStyles.includes('@media print') && afterSchoolStyles.includes('size:A4 portrait'), 'A4 출석부 출력 기능 누락');

console.log(JSON.stringify({
  teacherCount: read(`Object.keys(TEACHER_SCHEDULE).length`),
  classCount: read(`Object.keys(CLASS_SCHEDULE).length`),
  roomCount: read(`Object.keys(LAB_SCHEDULE).length`),
  badSubstitutes: candidateAudit.badSubstitutes,
  placeholderSubstitutes: candidateAudit.placeholderSubstitutes,
  selectionSwaps: candidateAudit.selectionSwaps,
  externalSwaps: candidateAudit.externalSwaps,
  externalSubstitutes: candidateAudit.externalSubstitutes,
  industryCoTeachingSubstitutes: industryCoTeachingAudit.substituteCount,
  industryMeetingMisses: industryMeetingAudit.length,
  reportedSwapRegression,
  ohSeungcheolRegression,
  teacherScheduleConflicts: baseCollisionAudit.teacherConflicts,
  classScheduleConflicts: baseCollisionAudit.classConflicts,
  specialRoomPolicyAudit,
  specialRoomDataAudit,
  labDisplayAudit,
  labPremiumDesign: true,
  movingRoomAudit,
  premiumTeacherAndClassDesign: true,
  onlineSubjectTeachers: onlineSubjectTeachers.length,
  songJunhanLessonCount,
  teacherPopupLinked: true,
  pdfColorCounts,
  invalidSubstitutes: candidateAudit.invalidSubstitutes,
  invalidVirtualSwaps: candidateAudit.invalidVirtualSwaps,
  swapCandidatesChecked: candidateAudit.swapCount,
  subjectRules,
  periodRules,
  bottom,
}, null, 2));
