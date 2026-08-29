// =====================================================
// 수업확인 프로그램 - 메인 앱 로직 v3.0
// =====================================================

// ── 전역 상태 ──
const STATE = {
  currentTab: 'swap',
  selectedSwapTeacher: null,
  selectedSwapDay: null,
  selectedSwapPeriod: null,
  meetingSelectedTeachers: new Set(),
  blockSettings: {},
  blockSelectedTeacher: null,
  blockTempDays: {},
  calendarPeriod: `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`,
  freeSelectedTeacher: null,
  teacherScheduleSelected: [],
  contactDept: 'all',
  contactUnlocked: false,
  rosterUnlocked: false,
  rosterSelectedClass: null,
  rosterUnlockedClass: null,
  subjectClassSelected: null,
  subjectClassView: 'subject',
  classScheduleSelected: [],
  labSelected: null,
  memo: '',
};

// 예약·시간표 데이터의 기존 키는 보존하고 화면에는 정식 실습실 명칭을 표시한다.
const LAB_DISPLAY_NAMES = Object.freeze({
  '만콘실': '만화콘텐츠 제작실',
  '영상실': '영상제작실',
  '컴그실': '컴퓨터그래픽실',
  '회계실': '회계실무실',
  '사행실': '사무행정실',
  '창구실': '창구사무실',
  '전상실': '전자상거래실',
});

function getLabDisplayName(labName) {
  return LAB_DISPLAY_NAMES[labName] || String(labName || '').replace(/\([^)]+\)/, '').trim();
}

function getTimeGroupCode(lessonValue) {
  const match = String(lessonValue || '').match(/(?:^|\s)([A-J]_[^\s]+)/);
  return match ? match[1] : '';
}

function getTimeGroupRooms(lessonValue) {
  const code = getTimeGroupCode(lessonValue);
  return code && typeof TIME_GROUP_ROOM_ASSIGNMENTS !== 'undefined'
    ? [...(TIME_GROUP_ROOM_ASSIGNMENTS[code] || [])]
    : [];
}

function isClassroomOccupiedByLesson(classKey, lessonValue) {
  const assignedRooms = getTimeGroupRooms(lessonValue);
  return !assignedRooms.length || assignedRooms.includes(classKey);
}

function getTimeGroupRoomUse(room, day, period, gradeGroup = null) {
  const slot = day + period;
  const uses = [];
  Object.entries(TEACHER_SCHEDULE || {}).forEach(([teacher, schedule]) => {
    const lessonValue = schedule[slot] || '';
    if (!lessonValue || !getTimeGroupRooms(lessonValue).includes(room)) return;
    const lessonGrade = String(lessonValue).match(/^([1-3])\d{2}\s/)?.[1] || '';
    if (gradeGroup === '3' && lessonGrade !== '3') return;
    if (gradeGroup === '12' && !['1','2'].includes(lessonGrade)) return;
    const code = getTimeGroupCode(lessonValue);
    if (!uses.some(use => use.code === code)) uses.push({ code, teacher, lessonValue });
  });
  return uses;
}

function getTimeGroupRoomForClass(classKey, lessonValue) {
  const assignedRooms = getTimeGroupRooms(lessonValue);
  if (!assignedRooms.length || assignedRooms.includes(classKey)) return '';
  return assignedRooms.find(room => !/^\d-\d+$/.test(room)) || assignedRooms[0];
}

function getTimeGroupAssignedRoom(lessonValue, preferredClassKey = '') {
  const assignedRooms = getTimeGroupRooms(lessonValue);
  if (!assignedRooms.length) return '';
  const classNumber = String(lessonValue || '').match(/^([1-3])(\d{2})\s/)?.slice(1, 3);
  const inferredClassKey = classNumber ? `${classNumber[0]}-${Number(classNumber[1])}` : '';
  const classKey = preferredClassKey || inferredClassKey;
  return assignedRooms.includes(classKey)
    ? classKey
    : (assignedRooms.find(room => !/^\d-\d+$/.test(room)) || assignedRooms[0]);
}

// ── 유틸리티 ──
function qs(sel, parent = document) { return parent.querySelector(sel); }
function qsa(sel, parent = document) { return [...parent.querySelectorAll(sel)]; }
function cel(tag, cls, text) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
}
function copyToClipboard(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-check"></i> 복사됨!';
    btn.style.background = '#3da86a';
    setTimeout(() => { btn.innerHTML = orig; btn.style.background = ''; }, 2000);
  }).catch(() => showAlert('클립보드 복사에 실패했습니다.'));
}

function copySchedulePanel(panelId, btn) {
  const panel = qs('#' + panelId);
  if (!panel) return;
  const text = (panel.innerText || panel.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
  if (!text) { showAlert('복사할 시간표를 먼저 선택해주세요.'); return; }
  copyToClipboard(text, btn);
}

function printSchedulePanel(panelId, title) {
  const panel = qs('#' + panelId);
  if (!panel || !(panel.innerText || panel.textContent || '').trim()) {
    showAlert('출력할 시간표를 먼저 선택해주세요.');
    return;
  }
  const printWindow = window.open('', '_blank', 'width=1200,height=850');
  if (!printWindow) { showAlert('팝업 차단을 해제한 뒤 다시 출력해주세요.'); return; }
  printWindow.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${title}</title><style>
    *{box-sizing:border-box}body{font-family:"Noto Sans KR",Arial,sans-serif;color:#222;padding:18px}h1{font-size:20px;margin:0 0 14px}
    .teacher-compare-grid,.class-compare-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.teacher-compare-card,.class-compare-card{break-inside:avoid;border:1px solid #bbb;border-radius:8px;overflow:hidden}
    table{width:100%;border-collapse:collapse;font-size:10px}th,td{border:1px solid #aaa;padding:4px;text-align:center}th{background:#eef4f7}.teacher-detail-header,.card-header{padding:10px;background:#eaf3f7;font-weight:700}.schedule-export-actions,button,.empty-state{display:none!important}
    @media print{body{padding:0}@page{size:landscape;margin:8mm}}
  </style></head><body><h1>${title}</h1>${panel.innerHTML}</body></html>`);
  printWindow.document.close();
  printWindow.onload = () => { printWindow.focus(); printWindow.print(); };
}

// ── 실시간 날짜/시간 업데이트 ──
function updateDateTime() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const weekdays = ['일요일','월요일','화요일','수요일','목요일','금요일','토요일'];
  const dateStr = `${now.getFullYear()}년 ${now.getMonth()+1}월 ${now.getDate()}일`;
  const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const weekdayStr = weekdays[now.getDay()];

  const dateEl = qs('#headerDate');
  const timeEl = qs('#headerTime');
  const wdEl   = qs('#headerWeekday');
  if (dateEl) dateEl.textContent = dateStr;
  if (timeEl) timeEl.textContent = timeStr;
  if (wdEl)   wdEl.textContent = weekdayStr;
}

// ── 알림 모달 ──
function showAlert(msg) {
  qs('#alertMsg').innerHTML = msg.replace(/\n/g, '<br>');
  resetDraggableModal(qs('#alertModal'));
  qs('#alertModal').classList.add('open');
}
function closeAlert() { qs('#alertModal').classList.remove('open'); }

// ── 결과 모달 ──
function openModal() { resetDraggableModal(qs('#resultModal')); qs('#resultModal').classList.add('open'); }
function closeModal() {
  closeTeacherSchedulePopup();
  qs('#resultModal').classList.remove('open');
}

function closeTeacherSchedulePopup() {
  qs('#teacherScheduleModal')?.classList.remove('open');
}

function openTeacherSchedulePopup(teacher) {
  if (!ALL_TEACHERS.includes(teacher)) return;
  const modal = qs('#teacherScheduleModal');
  const title = qs('#teacherScheduleModalTitle');
  const body = qs('#teacherScheduleModalBody');
  if (!modal || !title || !body) return;
  title.textContent = `${teacher} 선생님 시간표`;
  body.innerHTML = buildTeacherDetailCard(teacher, false, true);
  resetDraggableModal(modal);
  modal.classList.add('open');
  qs('#teacherScheduleModalClose')?.focus();
}

function teacherScheduleLink(teacher, innerHtml, className = '') {
  if (!ALL_TEACHERS.includes(teacher)) return `<span class="${className}">${innerHtml}</span>`;
  return `<button type="button" class="result-teacher-link ${className}" onclick="openTeacherSchedulePopup('${teacher}')" title="${teacher} 선생님 시간표 보기">${innerHtml}</button>`;
}

// ── 공통 팝업 드래그 ──
function resetDraggableModal(target) {
  const panel = target?.matches?.('.modal,.dashboard-modal-panel') ? target : target?.querySelector?.('.modal,.dashboard-modal-panel');
  if (!panel) return;
  panel.dataset.dragX = '0';
  panel.dataset.dragY = '0';
  panel.style.transform = 'translate(0px, 0px)';
}

function initDraggableModals() {
  if (document.documentElement.dataset.modalDragReady) return;
  document.documentElement.dataset.modalDragReady = 'yes';
  document.addEventListener('pointerdown', event => {
    if (event.button !== undefined && event.button !== 0) return;
    const handle = event.target.closest('.result-modal-header,.modal-header,.alert-modal-body,.dashboard-modal-heading');
    if (!handle || event.target.closest('button,a,input,textarea,select,label')) return;
    const panel = handle.closest('.modal,.dashboard-modal-panel');
    if (!panel) return;
    event.preventDefault();
    const startX = event.clientX, startY = event.clientY;
    const originX = Number(panel.dataset.dragX || 0), originY = Number(panel.dataset.dragY || 0);
    const rect = panel.getBoundingClientRect();
    handle.setPointerCapture?.(event.pointerId);
    panel.classList.add('is-dragging');
    const move = moveEvent => {
      const deltaX = Math.max(8 - rect.left, Math.min(window.innerWidth - 8 - rect.right, moveEvent.clientX - startX));
      const deltaY = Math.max(8 - rect.top, Math.min(window.innerHeight - 8 - rect.bottom, moveEvent.clientY - startY));
      const nextX = originX + deltaX, nextY = originY + deltaY;
      panel.dataset.dragX = String(nextX);
      panel.dataset.dragY = String(nextY);
      panel.style.transform = `translate(${nextX}px, ${nextY}px)`;
    };
    const end = () => {
      panel.classList.remove('is-dragging');
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  });
}

// ── 탭 전환 ──
function switchTab(name) {
  STATE.currentTab = name;
  qsa('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  qsa('.tab-panel').forEach(p => p.classList.toggle('active', p.id === name + 'Tab'));
  if (name === 'home' && typeof renderDashboard === 'function') renderDashboard();
  if (name === 'swap')          renderSwapTable();
  if (name === 'teacher')       renderTeacherScheduleTab();
  if (name === 'subjectClass')  renderSubjectClassTab();
  if (name === 'classSchedule') renderClassScheduleTab();
  if (name === 'lab')           renderLabTab();
  if (name === 'afterSchool' && typeof renderAfterSchoolAttendance === 'function') renderAfterSchoolAttendance();
  if (name === 'free')          renderFreeTab();
  if (name === 'meeting')       renderMeetingTab();
  if (name === 'calendar')      renderCalendarTab();
  if (name === 'roster')        renderRosterTab();
  if (name === 'contact')       renderContactTab();
  if (name === 'block')         renderBlockTab();
  if (name === 'util')          renderUtilTab();
  if (name === 'dashboardAdmin' && typeof renderDashboardAdmin === 'function') renderDashboardAdmin();
}

// ═══════════════════════════════════════════════
// 셀 공통 헬퍼
// ═══════════════════════════════════════════════

// 셀값 파싱: "106 국어1" → {subject, classLabel, grade, classNum, isSelect, isMint, isOnline}
// teacher 매개변수: 해당 셀의 교사명 (MINT_TEACHERS 체크용)
function parseCellValue(v, teacher, slot, forceExternal = false) {
  if (!v) return { subject:'', classLabel:'', grade:null, classNum:null, isSelect:false, isMint:false, isOnline:false };
  const s = String(v).trim();
  let grade = null, classNum = null, isSelect = false, isMint = forceExternal, isOnline = false;

  // SELECT_CELLS 기반 선택과목 판정 (PDF 노란색 셀)
  if (slot && typeof SELECT_CELLS !== 'undefined' && SELECT_CELLS[teacher] && SELECT_CELLS[teacher].has(slot)) {
    isSelect = true;
  }

  // 시간강사/산학협력교사/체육순회 체크
  if (teacher && typeof MINT_TEACHERS !== 'undefined' && MINT_TEACHERS.has(teacher)) {
    isMint = true;
  }
  // 혼합 셀에서 일반수업까지 민트로 판정하지 않도록 수업값까지 비교한다.
  if (!isMint && slot && typeof EXTERNAL_LESSONS !== 'undefined') {
    const externalValues = EXTERNAL_LESSONS[teacher]?.[slot] || [];
    isMint = externalValues.some(value => String(value).trim() === s);
  }
  // 온라인 수업 키워드 체크 (교사 없음)
  const onlineKeywords = ['온라인', 'online', '물리온라인'];
  if (onlineKeywords.some(k => s.toLowerCase().includes(k.toLowerCase()))) {
    isOnline = true;
    if (!isSelect) isMint = true; // SELECT_CELLS에 있으면 select 우선
  }
  // 체육순회 처리
  if (teacher === '체육순회') {
    isMint = true;
  }
  // 값 내 키워드 보조 체크
  const mintKeywords = ['시간강사','출강','강사'];
  if (mintKeywords.some(k => s.includes(k))) isMint = true;

  // "101 국어1" 형태
  const roomM = s.match(/([1-3])(\d{2})\s+(.+)/);
  if (roomM) {
    grade = roomM[1];
    const cn = parseInt(roomM[2]);
    classNum = cn > 10 ? null : cn;
    if (cn > 10) isSelect = true;  // SELECT_CELLS 판정 유지, 반호 기반 추가
    const subject = roomM[3];
    if (/^[A-N]_/.test(subject)) isSelect = true;
    // 온라인 포함 과목명 체크
    if (onlineKeywords.some(k => subject.toLowerCase().includes(k.toLowerCase()))) {
      isOnline = true; isMint = true;
    }
    return {
      subject: subject.length > 8 ? subject.slice(0,7)+'..' : subject,
      classLabel: isSelect ? `${grade}학년선택` : `${grade}-${classNum}`,
      grade, classNum, isSelect, isMint, isOnline
    };
  }
  // "선택" 직접 포함
  if (s.includes('선택')) isSelect = true;
  return { subject: s.length > 8 ? s.slice(0,7)+'..' : s, classLabel:'', grade:null, classNum:null, isSelect, isMint, isOnline };
}

// 담임 창체 시간 여부
function isChatcheTime(teacher, day, period) {
  if (!TEACHER_TO_CLASS[teacher]) return false;
  return CHATCHE_TIMES.some(ct => ct.day === day && ct.period === period);
}

// 교체 불가 시간 여부
function isBlockedTime(teacher, day, period) {
  const bs = STATE.blockSettings[teacher];
  if (!bs || !bs[day]) return false;
  return bs[day].includes(period);
}

function getExternalLessonValues(teacher, day, period) {
  return (typeof EXTERNAL_LESSONS !== 'undefined' && EXTERNAL_LESSONS[teacher]?.[day + period]) || [];
}

function isExternalLesson(teacher, day, period, value = '') {
  const slot = day + period;
  if (typeof EXTERNAL_INSTRUCTORS !== 'undefined' && EXTERNAL_INSTRUCTORS.has(teacher)) return true;
  const externalValues = getExternalLessonValues(teacher, day, period);
  if (value) return externalValues.some(v => String(v).trim() === String(value).trim());
  return externalValues.length > 0 && !(TEACHER_SCHEDULE[teacher] || {})[slot];
}

function getGradeGroup(grade) { return String(grade) === '3' ? '3' : '12'; }

function getPeriodTime(period, grade = null) {
  const gradeTime = grade && typeof PERIOD_TIMES_BY_GRADE !== 'undefined'
    ? PERIOD_TIMES_BY_GRADE[getGradeGroup(grade)]?.[period]
    : null;
  return gradeTime?.time || PERIOD_TIMES[period]?.time || '';
}

function getLessonInterval(period, grade = null) {
  const times = getPeriodTime(period, grade).match(/(\d{1,2}):(\d{2})\s*[~∼-]\s*(\d{1,2}):(\d{2})/);
  if (!times) return null;
  return {
    start: Number(times[1]) * 60 + Number(times[2]),
    end: Number(times[3]) * 60 + Number(times[4]),
  };
}

function intervalsOverlap(a, b) {
  return !!a && !!b && a.start < b.end && b.start < a.end;
}

// 교체·대체의 교사 충돌은 학교 시간표의 요일·교시를 우선한다.
// 학년별 실제 시각이 다르더라도 같은 '4교시' 수업 두 개를 한 교사가 맡을 수는 없다.
function lessonSlotsConflict(a, b) {
  return a.day === b.day && (a.period === b.period || intervalsOverlap(a.interval, b.interval));
}

function slotParts(slot) {
  const match = String(slot).match(/^(.+?)([1-7])$/);
  return match ? { day:match[1], period:Number(match[2]) } : null;
}

function isTeacherBusyAt(teacher, day, period, targetInfo, ignoreLessons = []) {
  const target = getLessonInterval(period, targetInfo?.grade);
  const schedule = TEACHER_SCHEDULE[teacher] || {};
  const hasRegularLesson = Object.entries(schedule).some(([slot, value]) => {
    const parts = slotParts(slot);
    if (!parts || parts.day !== day || !value) return false;
    if (ignoreLessons.some(x => x.teacher === teacher && x.day === parts.day && x.period === parts.period)) return false;
    const existingInfo = parseCellValue(value, teacher, slot);
    return parts.period === period || intervalsOverlap(target, getLessonInterval(parts.period, existingInfo.grade));
  });
  if (hasRegularLesson) return true;

  // 산학교사 민트 수업은 외부강사와 공동으로 진행하며 담당 교사의 임장이 필수다.
  // 따라서 일반 시간표에 없는 민트 셀도 협의시간·교체 충돌 검사에서는 수업으로 센다.
  if (typeof INDUSTRY_CO_TEACHING_TEACHERS === 'undefined' ||
      !INDUSTRY_CO_TEACHING_TEACHERS.has(teacher) ||
      typeof EXTERNAL_LESSONS === 'undefined') return false;
  return Object.entries(EXTERNAL_LESSONS[teacher] || {}).some(([slot, values]) => {
    const parts = slotParts(slot);
    if (!parts || parts.day !== day) return false;
    return values.some(value => {
      const existingInfo = parseCellValue(value, teacher, slot, true);
      return parts.period === period || intervalsOverlap(target, getLessonInterval(parts.period, existingInfo.grade));
    });
  });
}

function isClassBusy(classInfo, day, period, ignoreLessons = []) {
  if (!classInfo?.grade || !classInfo?.classNum) return false;
  const classKey = `${classInfo.grade}-${classInfo.classNum}`;
  const target = getLessonInterval(period, classInfo.grade);
  return Object.entries(CLASS_SCHEDULE[classKey] || {}).some(([slot, value]) => {
    const parts = slotParts(slot);
    if (!parts || parts.day !== day || !value) return false;
    if (ignoreLessons.some(x => x.classKey === classKey && x.day === parts.day && x.period === parts.period)) return false;
    return intervalsOverlap(target, getLessonInterval(parts.period, classInfo.grade));
  });
}

function createLessonRecord(teacher, day, period, value, forceExternal = false) {
  const info = parseCellValue(value, teacher, day + period, forceExternal);
  return {
    teacher, day, period, value,
    grade: info.grade,
    classNum: info.classNum,
    classKey: info.grade && info.classNum ? `${info.grade}-${info.classNum}` : null,
    interval: getLessonInterval(period, info.grade),
    isExternal: forceExternal,
  };
}

function createScheduleSnapshot() {
  return { teacherRecords:new Map(), classRecords:new Map() };
}

function getTeacherLessonRecords(teacher, snapshot = null) {
  const cache = snapshot?.teacherRecords;
  if (cache?.has(teacher)) return cache.get(teacher);
  const records = [];
  for (const [slot, value] of Object.entries(TEACHER_SCHEDULE[teacher] || {})) {
    const parts = slotParts(slot);
    if (parts && value) records.push(createLessonRecord(teacher, parts.day, parts.period, value));
  }

  // 산학교사 공동수업은 일반 시간표와 별도 데이터에 있으나 교사는 실제로 임장한다.
  if (typeof INDUSTRY_CO_TEACHING_TEACHERS !== 'undefined' &&
      INDUSTRY_CO_TEACHING_TEACHERS.has(teacher) &&
      typeof EXTERNAL_LESSONS !== 'undefined') {
    for (const [slot, values] of Object.entries(EXTERNAL_LESSONS[teacher] || {})) {
      const parts = slotParts(slot);
      if (!parts) continue;
      values.forEach(value => records.push(createLessonRecord(teacher, parts.day, parts.period, value, true)));
    }
  }
  if (cache) cache.set(teacher, records);
  return records;
}

function getClassLessonRecords(classKey, snapshot = null) {
  const cache = snapshot?.classRecords;
  if (cache?.has(classKey)) return cache.get(classKey);
  const grade = String(classKey || '').split('-')[0];
  const records = [];
  for (const [slot, value] of Object.entries(CLASS_SCHEDULE[classKey] || {})) {
    const parts = slotParts(slot);
    if (!parts || !value) continue;
    records.push({
      classKey, day:parts.day, period:parts.period, value,
      interval:getLessonInterval(parts.period, grade),
    });
  }
  if (cache) cache.set(classKey, records);
  return records;
}

function findScheduleRecordConflicts(records) {
  const conflicts = [];
  for (let i = 0; i < records.length; i++) {
    for (let j = i + 1; j < records.length; j++) {
      if (lessonSlotsConflict(records[i], records[j])) {
        conflicts.push([records[i], records[j]]);
      }
    }
  }
  return conflicts;
}

function isSameTeacherLesson(record, source) {
  return record.teacher === source.teacher && record.day === source.day &&
    record.period === source.period && String(record.value) === String(source.value);
}

// 두 원수업을 제거한 뒤 서로의 시간에 임시 배치하여 최종 교사·학급 상태를 검증한다.
function evaluateVirtualSwap(sourceA, sourceB, snapshot = null) {
  const movedA = { ...sourceA, day:sourceB.day, period:sourceB.period, interval:getLessonInterval(sourceB.period, sourceA.grade) };
  const movedB = { ...sourceB, day:sourceA.day, period:sourceA.period, interval:getLessonInterval(sourceA.period, sourceB.grade) };
  const teacherConflicts = [];
  const classConflicts = [];

  for (const teacher of new Set([sourceA.teacher, sourceB.teacher])) {
    const finalRecords = getTeacherLessonRecords(teacher, snapshot)
      .filter(record => !isSameTeacherLesson(record, sourceA) && !isSameTeacherLesson(record, sourceB));
    if (movedA.teacher === teacher) finalRecords.push(movedA);
    if (movedB.teacher === teacher) finalRecords.push(movedB);
    findScheduleRecordConflicts(finalRecords).forEach(conflict => teacherConflicts.push({ teacher, conflict }));
  }

  for (const classKey of new Set([sourceA.classKey, sourceB.classKey].filter(Boolean))) {
    const finalRecords = getClassLessonRecords(classKey, snapshot).filter(record => {
      const removesA = sourceA.classKey === classKey && record.day === sourceA.day && record.period === sourceA.period;
      const removesB = sourceB.classKey === classKey && record.day === sourceB.day && record.period === sourceB.period;
      return !removesA && !removesB;
    });
    if (movedA.classKey === classKey) finalRecords.push({ ...movedA, classKey });
    if (movedB.classKey === classKey) finalRecords.push({ ...movedB, classKey });
    findScheduleRecordConflicts(finalRecords).forEach(conflict => classConflicts.push({ classKey, conflict }));
  }

  return {
    valid: teacherConflicts.length === 0 && classConflicts.length === 0,
    teacherConflicts,
    classConflicts,
  };
}

function canSubstituteLesson(candidate, day, period, targetInfo) {
  if (isTeacherBusyAt(candidate, day, period, targetInfo)) return false;
  if (!targetInfo?.grade || !targetInfo?.classNum) return true;
  const classKey = `${targetInfo.grade}-${targetInfo.classNum}`;
  return !isClassBusy(targetInfo, day, period, [{ classKey, day, period }]);
}

// 교사의 학년군 파악 (3학년 or 1·2학년)
function getTeacherGradeGroup(teacher) {
  const sch = TEACHER_SCHEDULE[teacher] || {};
  let g3 = 0, g12 = 0;
  Object.values(sch).forEach(v => {
    if (!v) return;
    const info = parseCellValue(v, teacher);
    if (info.grade === '3') g3++;
    else if (info.grade === '1' || info.grade === '2') g12++;
  });
  return (g3 > 0 && g3 >= g12) ? '3' : '12';
}

// ═══════════════════════════════════════════════
// 교체/대체 시간표 탭
// ═══════════════════════════════════════════════
function buildSwapLessonBlock(value, teacher, day, period, isExternal = false, externalIndex = 0) {
  const key = day + period;
  const info = parseCellValue(value, teacher, key, isExternal);
  const clickFn = isExternal
    ? `onExternalCellClick('${teacher}','${day}',${period},${externalIndex});event.stopPropagation();`
    : `onCellClick('${teacher}','${day}',${period});event.stopPropagation();`;
  let style = 'padding:3px 2px;border-radius:4px;cursor:pointer;';
  let label = info.classLabel;
  if (isExternal) {
    style += 'background:var(--cell-mint-bg);border:1px solid var(--cell-mint-bd);';
  } else if (info.isSelect) {
    style += 'background:var(--cell-select-bg);border:1px solid var(--cell-select-bd);';
    label = `${label} · 교체불가`;
  }
  const assignedRoom = getTimeGroupAssignedRoom(value);
  if (assignedRoom) label = `${label} · ${getLabDisplayName(assignedRoom)}`;
  return `<div style="${style}" onclick="${clickFn}">
    <div class="cell-subject">${info.subject}</div>
    <div class="cell-class" style="font-size:8px;">${label}</div>
  </div>`;
}

function renderSwapTable() {
  const wrap = qs('#swapTableWrap');
  if (!wrap) return;

  const rawSearch = (qs('#swapSearch')?.value || '').trim();
  const searchTerms = rawSearch ? rawSearch.split(/[,\s]+/).map(s => s.trim().toLowerCase()).filter(Boolean) : [];
  const teachers = ALL_TEACHERS.filter(t => !searchTerms.length || searchTerms.some(s => t.toLowerCase().includes(s)));

  let html = `<table class="schedule-table"><thead><tr>
    <th class="teacher-th" rowspan="2">교사명</th>`;
  DAYS.forEach(d => {
    html += `<th class="day-header" colspan="${PERIODS.length}">${d}요일</th>`;
  });
  html += `</tr><tr>`;
  DAYS.forEach(() => {
    PERIODS.forEach(p => { html += `<th>${p}</th>`; });
  });
  html += `</tr></thead><tbody>`;

  teachers.forEach(teacher => {
    const sch = TEACHER_SCHEDULE[teacher] || {};
    const isHomeroom = !!TEACHER_TO_CLASS[teacher];
    const gradeGroup = getTeacherGradeGroup(teacher);

    html += `<tr>`;
    html += `<td class="teacher-td">${teacher}<br>
      <span style="font-size:9px;color:var(--txt-light);">${isHomeroom ? TEACHER_TO_CLASS[teacher]+'담' : ''}</span>
    </td>`;

    DAYS.forEach((day, di) => {
      PERIODS.forEach((period, pi) => {
        const key = day + period;
        const val = sch[key] || '';
        const externalValues = getExternalLessonValues(teacher, day, period);
        const blocked = isBlockedTime(teacher, day, period);
        const isChatech = isChatcheTime(teacher, day, period);
        const dayStartCls = pi === 0 ? 'day-start' : '';

        // 점심시간 처리 (교사별로 학년군에 맞게)
        const isLunchSlot = checkLunchSlot(teacher, gradeGroup, day, period);

        let cellClass = dayStartCls;
        let cellStyle = '';
        let cellContent = '';
        let clickable = '';

        if (val || externalValues.length) {
          cellStyle = 'style="background:white;padding:2px;"';
          const blocks = [];
          if (val) blocks.push(buildSwapLessonBlock(val, teacher, day, period));
          externalValues.forEach((externalValue, index) => {
            blocks.push(buildSwapLessonBlock(externalValue, teacher, day, period, true, index));
          });
          cellContent = `<div style="display:flex;flex-direction:column;gap:2px;">${blocks.join('')}</div>`;
        } else if (isLunchSlot) {
          cellStyle = 'style="background:#fffcee;cursor:default;"';
          cellContent = `<span style="font-size:9.5px;color:#c8a000;font-style:italic;">점심</span>`;
        } else if (blocked) {
          cellStyle = 'style="background:var(--cell-blocked-bg);cursor:default;"';
          cellContent = `<span style="font-size:9.5px;color:#c07070;">불가</span>`;
        } else if (isChatech && !val) {
          cellStyle = 'style="background:var(--cell-chatech-bg);"';
          cellContent = `<span class="cell-chatech">창체</span>`;
          clickable = `onclick="onCellClick('${teacher}','${day}',${period})"`;
        }

        const cellTitle = `${teacher} ${day}${period}교시${externalValues.length ? ' · 민트색은 외부강사 수업' : ''}`;

        html += `<td class="${cellClass}" id="cell-${teacher.replace(/\s/g,'_')}-${day}-${period}" 
                   ${cellStyle} ${clickable} title="${cellTitle}">
          ${cellContent}
        </td>`;
      });
    });
    html += `</tr>`;
  });
  html += `</tbody></table>`;
  wrap.innerHTML = html;
}

// 점심 슬롯인지 확인 (수업이 없는 점심시간 표시용)
function checkLunchSlot(teacher, gradeGroup, day, period) {
  const sch = TEACHER_SCHEDULE[teacher] || {};
  const val = sch[day + period] || '';
  if (val) return false; // 수업이 있으면 점심 아님
  // 3학년 선생님: 3교시 다음이 점심 (하지만 4교시는 수업)
  // 1·2학년 선생님: 4교시 다음이 점심
  // 점심 슬롯은 별도로 표시하지 않고 빈칸으로 두는 것이 더 자연스러움
  return false;
}

// ── 셀 클릭 (교체/대체 검색) ──
function onCellClick(teacher, day, period) {
  const sch = TEACHER_SCHEDULE[teacher] || {};
  const key = day + period;
  const val = sch[key];
  openLessonMatching(teacher, day, period, val, false);
}

function onExternalCellClick(teacher, day, period, externalIndex = 0) {
  const val = getExternalLessonValues(teacher, day, period)[externalIndex];
  openLessonMatching(teacher, day, period, val, true);
}

function openLessonMatching(teacher, day, period, val, forceExternal = false) {
  const key = day + period;
  const isChatech = isChatcheTime(teacher, day, period);

  if (!val && !isChatech) return;

  // 이전 선택 해제
  qsa('.is-selected, .is-partner').forEach(el => el.classList.remove('is-selected','is-partner'));

  const safeTeacher = teacher.replace(/\s/g,'_');
  const myCell = qs(`#cell-${safeTeacher}-${day}-${period}`);
  if (myCell) myCell.classList.add('is-selected');

  STATE.selectedSwapTeacher = teacher;
  STATE.selectedSwapDay = day;
  STATE.selectedSwapPeriod = period;

  const info = parseCellValue(val || '', teacher, key, forceExternal);

  // 온라인 수업 안내
  if (info.isOnline) {
    renderResultModal_blocked(teacher, day, period, val, '온라인 수업입니다. 담당 교사가 없어 교체 및 대체가 불가합니다.');
    openModal();
    return;
  }

  // 체육순회 안내
  if (teacher === '체육순회') {
    renderResultModal_blocked(teacher, day, period, val, '체육순회 수업은 교체 및 대체가 불가합니다.');
    openModal();
    return;
  }
  if (forceExternal || isExternalLesson(teacher, day, period, val)) {
    if (typeof INDUSTRY_CO_TEACHING_TEACHERS !== 'undefined' && INDUSTRY_CO_TEACHING_TEACHERS.has(teacher)) {
      renderResultModal_blocked(
        teacher,
        day,
        period,
        val,
        '산학교사 공동수업으로 담당 교사가 반드시 임장해야 하므로 교체 및 대체가 불가합니다.'
      );
      openModal();
      return;
    }
    renderResultModal_blocked(
      teacher,
      day,
      period,
      val,
      '외부강사 수업으로 교체 및 대체가 불가합니다.'
    );
    openModal();
    return;
  }

  const swapResults = findSwapCandidates(teacher, day, period, val);
  const subResults  = findSubstituteCandidates(teacher, day, period, val);

  swapResults.forEach(r => {
    const cell = qs(`#cell-${r.teacher.replace(/\s/g,'_')}-${r.day}-${r.period}`);
    if (cell) cell.classList.add('is-partner');
  });

  renderResultModal(teacher, day, period, val, swapResults, subResults);
  openModal();
}

// 교체(맞교환) 후보
// 교체 조건: 두 원수업을 제거하고 서로의 시간에 가상 배치한 최종 상태에서
// 양쪽 교사와 양쪽 학급 모두 시간 충돌이 없어야 한다.
function findSwapCandidates(myTeacher, myDay, myPeriod, myVal, scheduleSnapshot = createScheduleSnapshot()) {
  const myInfo = parseCellValue(myVal, myTeacher, myDay + myPeriod);
  if (!myVal || myInfo.isSelect || myInfo.isMint || isExternalLesson(myTeacher, myDay, myPeriod, myVal) || !myInfo.grade || !myInfo.classNum) return [];
  const sourceLesson = createLessonRecord(myTeacher, myDay, myPeriod, myVal);

  const results = [];
  const seen = new Set(); // 중복 방지

  ALL_TEACHERS.forEach(other => {
    if (other === myTeacher) return;
    // 민트 교사(시간강사/산학협력교사)는 교체 대상 아님
    if (typeof MINT_TEACHERS !== 'undefined' && MINT_TEACHERS.has(other)) return;
    if (isBlockedTime(other, myDay, myPeriod)) return;
    if (isChatcheTime(other, myDay, myPeriod)) return;
    const otherRow = TEACHER_SCHEDULE[other] || {};
    DAYS.forEach(d => {
      PERIODS.forEach(p => {
        if (d === myDay && p === myPeriod) return;
        if (isBlockedTime(myTeacher, d, p)) return;
        if (isChatcheTime(myTeacher, d, p)) return;
        if (isBlockedTime(other, d, p)) return;
        if (isChatcheTime(other, d, p)) return;

        const otherVal = otherRow[d + p];
        if (!otherVal) return;
        const otherInfo = parseCellValue(otherVal, other, d + p);
        if (otherInfo.isSelect || otherInfo.isMint || isExternalLesson(other, d, p, otherVal) || !otherInfo.grade || !otherInfo.classNum) return;
        const ignored = [
          { teacher:myTeacher, classKey:sourceLesson.classKey, day:myDay, period:myPeriod },
          { teacher:other, classKey:`${otherInfo.grade}-${otherInfo.classNum}`, day:d, period:p },
        ];
        if (isTeacherBusyAt(myTeacher, d, p, myInfo, ignored) ||
            isTeacherBusyAt(other, myDay, myPeriod, otherInfo, ignored) ||
            isClassBusy(myInfo, d, p, ignored) ||
            isClassBusy(otherInfo, myDay, myPeriod, ignored)) return;
        const candidateLesson = createLessonRecord(other, d, p, otherVal);
        if (!evaluateVirtualSwap(sourceLesson, candidateLesson, scheduleSnapshot).valid) return;
        const key = `${other}|${d}|${p}`;
        if (seen.has(key)) return;
        seen.add(key);
        results.push({ teacher: other, day: d, period: p, grade: otherInfo.grade, subject: otherInfo.subject, theirClass: otherInfo.classLabel });
      });
    });
  });
  return results;
}

// 대체 후보 (공강 선생님 중 같은 교과)
function findSubstituteCandidates(myTeacher, day, period, lessonValue = '') {
  // PDF의 모든 민트색 수업은 외부강사 수업이므로 교체·대체 후보를 만들지 않는다.
  if (isExternalLesson(myTeacher, day, period, lessonValue)) {
    return [];
  }

  // 창체 시간인 경우: 비담임 교사 명단에서 해당 시간 공강인 교사를 대체 후보로 반환
  if (isChatcheTime(myTeacher, day, period)) {
    const results = [];
    const key = day + period;
    CHANGCHE_AVAILABLE_TEACHERS.forEach(candidate => {
      if (isBlockedTime(candidate, day, period)) return;
      const targetInfo = parseCellValue(lessonValue || '101 창체', myTeacher, key);
      if (canSubstituteLesson(candidate, day, period, targetInfo)) {
        results.push({ teacher: candidate, subject: '창체' });
      }
    });
    return results;
  }

  const subjectGroups = getSubjectGroups();
  const subjectEntry = Object.entries(subjectGroups).find(([, teachers]) => teachers.includes(myTeacher));
  if (!subjectEntry) return [];
  const [subject, sameSubjectTeachers] = subjectEntry;
  const targetInfo = parseCellValue(lessonValue || (TEACHER_SCHEDULE[myTeacher] || {})[day + period] || '', myTeacher, day + period);

  const results = [];
  sameSubjectTeachers.forEach(candidate => {
    if (candidate === myTeacher) return;
    if (candidate.includes('온라인') || candidate === '중국어특성화') return;
    if (isBlockedTime(candidate, day, period)) return;
    if (isChatcheTime(candidate, day, period)) return;
    if (canSubstituteLesson(candidate, day, period, targetInfo)) {
      results.push({ teacher: candidate, subject });
    }
  });
  return results;
}

// 결과 모달 – 차단됨(시간강사/산학협력교사 등)
function renderResultModal_blocked(teacher, day, period, val, msg) {
  const info = parseCellValue(val || '', teacher, day + period);
  const dayNames = {월:'월요일',화:'화요일',수:'수요일',목:'목요일',금:'금요일'};
  const periodTime = getPeriodTime(period, info.grade);

  qs('#modalMyLesson').innerHTML = `
    <div class="result-my-lesson mint">
      <div class="result-my-meta">
        <span class="result-meta-tag day">${dayNames[day] || day}</span>
        <span class="result-meta-tag period">${period}교시</span>
        ${periodTime ? `<span class="result-meta-tag time">${periodTime}</span>` : ''}
      </div>
      <div class="result-my-title">
        <span class="result-subject-name">${info.subject || val || '-'}</span>
        <span class="result-class-badge mint">${info.classLabel || ''}</span>
      </div>
      ${teacherScheduleLink(teacher, `${teacher} 선생님`, 'result-my-teacher')}
      <div class="result-rule-badge mint"><i class="fas fa-palette"></i> 시간강사·산학협력교사 수업 (민트색)</div>
    </div>`;
  qs('#modalSwapList').innerHTML = `
    <div class="result-rule-notice mint">
      <div class="result-rule-icon">🚫</div>
      <div>
        <div style="font-weight:700;font-size:13.5px;margin-bottom:4px;">교체·대체 불가</div>
        <div style="font-size:12px;color:var(--txt-mid);line-height:1.5;">${msg}</div>
      </div>
    </div>`;
  qs('#modalCopyBtn').onclick = null;
}

// 결과 모달 메인 렌더링
function renderResultModal(teacher, day, period, val, swapRes, subRes, forceExternal = false) {
  const info      = parseCellValue(val || '', teacher, day + period, forceExternal);
  const externalLesson = forceExternal || isExternalLesson(teacher, day, period, val);
  const isChatech = isChatcheTime(teacher, day, period) && !val;
  const lessonName = isChatech ? '창의적 체험활동(창체)' : (info.subject || val || '-');
  const dayNames = {월:'월요일',화:'화요일',수:'수요일',목:'목요일',금:'금요일'};
  const periodTime = getPeriodTime(period, info.grade);
  const homeroomCls = TEACHER_TO_CLASS[teacher];

  // ── 선택 수업 박스 ──
  qs('#modalMyLesson').innerHTML = `
    <div class="result-my-lesson ${externalLesson ? 'mint' : info.isSelect ? 'select' : 'normal'}">
      <div class="result-my-meta">
        <span class="result-meta-tag day">${dayNames[day] || day}</span>
        <span class="result-meta-tag period">${period}교시</span>
        ${periodTime ? `<span class="result-meta-tag time">${periodTime}</span>` : ''}
      </div>
      <div class="result-my-title">
        <span class="result-subject-name">${lessonName}</span>
        ${info.classLabel ? `<span class="result-class-badge ${info.isSelect ? 'select' : ''}">${info.classLabel}</span>` : ''}
        ${isChatech ? '<span class="result-class-badge chatech">창체</span>' : ''}
      </div>
      ${teacherScheduleLink(teacher, `${teacher} 선생님${homeroomCls ? ' · ' + homeroomCls + '반 담임' : ''}`, 'result-my-teacher')}
      ${info.isSelect ? '<div class="result-rule-badge select"><i class="fas fa-palette"></i> 선택과목 (노란색) — 대체만 가능, 교체 불가</div>' : ''}
      ${externalLesson ? '<div class="result-rule-badge mint"><i class="fas fa-user-clock"></i> 외부강사 수업 (민트색) — 교체 불가</div>' : ''}
    </div>`;

  let html = '';

  // ── 민트(시간강사/산학협력교사) 경고 메시지 ──
  if (info.isMint) {
    html += `<div style="background:#fffde7;border:1.5px solid #f9a825;border-radius:8px;padding:10px 14px;margin-bottom:12px;display:flex;align-items:center;gap:10px;">
      <span style="font-size:18px;">⚠️</span>
      <span style="font-weight:700;font-size:13px;color:#e65100;">시간 또는 산학강사가 수업하는 시간입니다</span>
    </div>`;
  }

  // ── 1. 교체 가능 (맞교환) ──
  html += `<div class="result-section-hd swap">
    <i class="fas fa-exchange-alt"></i> 교체 가능 (맞교환)
    ${(!isChatech && !info.isSelect && swapRes.length > 0) ? `<span class="result-count-badge swap">${swapRes.length}명</span>` : ''}
  </div>`;

  if (externalLesson) {
    html += `<div class="result-rule-notice mint"><div class="result-rule-icon">🚫</div><div>
      <div style="font-weight:700;font-size:13px;margin-bottom:3px;">외부강사 수업 · 교체 불가</div>
      <div style="font-size:12px;color:var(--txt-mid);line-height:1.5;">외부강사 수업은 맞교환 후보에 포함하지 않습니다.<br>아래 동일 교과 대체 가능 선생님을 확인하세요.</div>
    </div></div>`;
  } else if (isChatech) {
    html += `<div class="result-empty-msg"><i class="fas fa-info-circle"></i> 창체 시간은 맞교환 대상이 아닙니다.</div>`;
  } else if (info.isSelect || !info.grade) {
    html += `<div class="result-rule-notice select">
      <div class="result-rule-icon">🟡</div>
      <div>
        <div style="font-weight:700;font-size:13px;margin-bottom:3px;">교체(맞교환) 불가</div>
        <div style="font-size:12px;color:var(--txt-mid);line-height:1.5;">선택과목은 맞교환이 불가능합니다.<br>아래 대체 가능 선생님을 확인하세요.</div>
      </div>
    </div>`;
  } else if (swapRes.length === 0) {
    html += `<div class="result-empty-msg"><i class="fas fa-search"></i> 교체 가능한 대상이 없습니다.<br><span style="font-size:11px;color:var(--txt-light);">조건: 상대방이 내 반(${info.classLabel})에 수업이 있고, 서로 시간을 맞바꿀 수 있는 경우</span></div>`;
  } else {
    swapRes.forEach((r, i) => {
      const rPeriodTime = getPeriodTime(r.period, r.grade);
      html += `
        <div class="result-card swap">
          <div class="result-card-num swap">${i + 1}</div>
          <div class="result-card-info">
            ${teacherScheduleLink(r.teacher, `${r.teacher} 선생님
              ${TEACHER_TO_CLASS[r.teacher] ? `<span style="font-size:10.5px;font-weight:400;color:var(--txt-light);margin-left:4px;">${TEACHER_TO_CLASS[r.teacher]}담임</span>` : ''}`, 'result-card-name')}
            <div class="result-card-detail">
              <span class="result-detail-chip day">${r.day}요일 ${r.period}교시</span>
              ${rPeriodTime ? `<span class="result-detail-chip time">${rPeriodTime}</span>` : ''}
              <span class="result-detail-chip subj">${r.subject} / ${r.theirClass || info.classLabel}</span>
            </div>
            <div class="result-card-desc">
              <i class="fas fa-exchange-alt" style="color:var(--swap-color);font-size:10px;"></i>
              <strong style="color:var(--swap-color);">${teacher}</strong> 선생님 <strong>${day}요일 ${period}교시</strong> ↔
              <strong style="color:var(--swap-color);">${r.teacher}</strong> 선생님 <strong>${r.day}요일 ${r.period}교시</strong> 맞교환
            </div>
          </div>
        </div>`;
    });
  }

  // ── 2. 대체 가능 (공강 선생님) ──
  html += `<div class="result-section-hd sub" style="margin-top:12px;">
    <i class="fas fa-user-plus"></i> 대체 가능 (공강 선생님)
    ${subRes.length > 0 ? `<span class="result-count-badge sub">${subRes.length}명</span>` : ''}
  </div>`;

  if (subRes.length === 0) {
    const groupEntry = Object.entries(getSubjectGroups()).find(([, teachers]) => teachers.includes(teacher));
    const subj = groupEntry ? groupEntry[0] : '';
    html += `<div class="result-empty-msg"><i class="fas fa-search"></i>
      ${subj ? `[${subj}] 교과 중 이 시간에 공강인 선생님이 없습니다.` : '대체 가능한 선생님이 없습니다.'}
    </div>`;
  } else {
    subRes.forEach((r, i) => {
      html += `
        <div class="result-card sub">
          <div class="result-card-check">✓</div>
          <div class="result-card-info">
            ${teacherScheduleLink(r.teacher, `${r.teacher} 선생님
              ${TEACHER_TO_CLASS[r.teacher] ? `<span style="font-size:10.5px;font-weight:400;color:var(--txt-light);margin-left:4px;">${TEACHER_TO_CLASS[r.teacher]}담임</span>` : ''}`, 'result-card-name')}
            <div class="result-card-detail">
              <span class="result-detail-chip free">${day}요일 ${period}교시 공강</span>
              <span class="result-detail-chip subj">${r.subject} 교과</span>
            </div>
            <div class="result-card-desc sub">
              이 시간 <strong class="result-free-highlight">공강</strong>이므로 <strong>${r.teacher}</strong> 선생님이 ${lessonName} 수업을 대신 들어갈 수 있습니다.
            </div>
          </div>
        </div>`;
    });
  }

  qs('#modalSwapList').innerHTML = html;

  // 복사 버튼
  qs('#modalCopyBtn').onclick = () => {
    const myText = `${teacher} 선생님 ${day}요일 ${period}교시 (${lessonName}${info.classLabel ? ' · ' + info.classLabel : ''})`;
    let text = `[수업 교체·대체 매칭 결과]\n\n`;
    text += `📌 선택 수업: ${myText}\n`;
    text += `   시간: ${periodTime}\n\n`;
    text += `▶ 교체 가능 (맞교환) ${swapRes.length}명\n`;
    if (info.isSelect) {
      text += `   ※ 선택과목은 교체(맞교환) 불가\n`;
    } else {
      swapRes.forEach((r, i) => {
        const rt = getPeriodTime(r.period, r.grade);
        text += `  ${i+1}. ${r.teacher} 선생님 — ${r.day}요일 ${r.period}교시 ${rt} (${r.subject})\n`;
      });
      if (swapRes.length === 0) text += `   해당 없음\n`;
    }
    text += `\n▶ 대체 가능 (공강) ${subRes.length}명\n`;
    subRes.forEach((r, i) => {
      text += `  ${i+1}. ${r.teacher} 선생님 (${r.subject} 교과 · 공강)\n`;
    });
    if (subRes.length === 0) text += `   해당 없음\n`;
    copyToClipboard(text, qs('#modalCopyBtn'));
  };
}

// ═══════════════════════════════════════════════
// 교사별 시간표 탭
// ═══════════════════════════════════════════════
function getSelectedScheduleTeachers() {
  const selected = STATE.teacherScheduleSelected;
  if (Array.isArray(selected)) return selected.filter(name => ALL_TEACHERS.includes(name));
  if (selected && ALL_TEACHERS.includes(selected)) return [selected];
  return [];
}

function renderTeacherScheduleTab() {
  renderTeacherListPanel();
  const selected = getSelectedScheduleTeachers();
  renderTeacherDetailTable(selected.length ? selected : ALL_TEACHERS);
}

function renderTeacherListPanel() {
  const rawSearch = (qs('#teacherScheduleSearch')?.value || '').trim();
  const searchTerms = rawSearch ? rawSearch.split(/[,\s]+/).map(s => s.trim().toLowerCase()).filter(Boolean) : [];
  const listEl = qs('#teacherScheduleList');
  if (!listEl) return;

  const filtered = ALL_TEACHERS.filter(t => !searchTerms.length || searchTerms.some(s => t.toLowerCase().includes(s)));
  if (!filtered.length) {
    listEl.innerHTML = `<div style="padding:14px;text-align:center;color:var(--txt-light);font-size:12px;">검색 결과 없음</div>`;
    STATE.teacherScheduleSelected = [];
    renderTeacherDetailTable([]);
    return;
  }

  // 검색어가 있으면 일치하는 교사를 모두 선택하여 비교 시간표를 즉시 표시한다.
  if (searchTerms.length) {
    STATE.teacherScheduleSelected = filtered;
    renderTeacherDetailTable(filtered);
  }

  listEl.innerHTML = filtered.map(t => {
    const active = getSelectedScheduleTeachers().includes(t) ? 'active' : '';
    const homeroomCls = TEACHER_TO_CLASS[t] || '';
    return `<button class="side-btn-item premium-selector-button teacher-schedule-button ${active}" onclick="selectTeacherSchedule('${t}')">
      <span class="premium-selector-icon"><i class="fas fa-user"></i></span>
      <span class="premium-selector-copy"><strong>${t} 선생님</strong><small>${homeroomCls ? `${homeroomCls} 담임` : '주간 시간표 보기'}</small></span>
      <i class="fas fa-chevron-right premium-selector-arrow" aria-hidden="true"></i>
    </button>`;
  }).join('');
}

function selectTeacherSchedule(teacher) {
  STATE.teacherScheduleSelected = [teacher];
  renderTeacherListPanel();
  renderTeacherDetailTable([teacher]);
}

function buildTeacherDetailCard(teacher, compact = false, popup = false) {
  const sch = TEACHER_SCHEDULE[teacher] || {};
  const isHR = !!TEACHER_TO_CLASS[teacher];
  const gradeGroup = getTeacherGradeGroup(teacher);
  const subMap = SUBJECT_SUBSTITUTE_MAP[teacher];
  const cls = TEACHER_TO_CLASS[teacher] || '-';
  const lunchAfter = gradeGroup === '3' ? 3 : 4;
  const lunchLabel = gradeGroup === '3' ? '점심 (11:30~)' : '점심 (12:30~)';

  let freeCount = 0;
  DAYS.forEach(d => PERIODS.forEach(p => {
    if (!sch[d+p] && !isChatcheTime(teacher, d, p) && p <= 7) freeCount++;
  }));

  return `<article class="teacher-compare-card ${compact ? 'is-compact' : ''} ${popup ? 'teacher-popup-card' : ''}">
    <div class="teacher-detail-header">
      <div class="teacher-avatar"><i class="fas fa-user-tie"></i></div>
      <div class="teacher-card-identity">
        <div class="teacher-card-title">${teacher} 선생님</div>
        <div class="teacher-card-meta">
          ${isHR ? cls + '반 담임 · ' : ''}${subMap ? subMap.subject : ''} 교과
        </div>
        <div class="teacher-card-badges">
          <span class="badge ${gradeGroup==='3'?'badge-orange':'badge-blue'}">${gradeGroup==='3'?'3학년 일과':'1·2학년 일과'}</span>
          <span class="badge badge-green">공강 ${freeCount}교시</span>
        </div>
      </div>
    </div>
    <div class="premium-schedule-scroll">
      <table class="teacher-detail-table teacher-premium-table" style="min-width:${compact ? '420px' : '600px'};">
        <thead>
          <tr>
            <th class="teacher-period-heading">교시</th>
            ${DAYS.map(d=>`<th>${d}요일</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${PERIODS.map(p => {
            let lunchRow = '';
            if (p === lunchAfter + 1) {
              lunchRow = `<tr class="premium-lunch-row">
                <td class="period-label premium-lunch-label">점심</td>
                ${DAYS.map(()=>`<td class="premium-lunch-cell">${lunchLabel}</td>`).join('')}
              </tr>`;
            }
            const row = `<tr>
              <td class="period-label premium-period-cell teacher-period-cell">
                <strong class="teacher-period-number">${p}교시</strong>
                <span class="teacher-period-time">${getPeriodTime(p, gradeGroup === '3' ? '3' : '1').replace('~','<wbr>~')}</span>
              </td>
              ${DAYS.map(d => {
                const key = d + p;
                const val = sch[key] || '';
                const externalValues = getExternalLessonValues(teacher, d, p);
                const isChatech = isChatcheTime(teacher, d, p);
                const blocked = isBlockedTime(teacher, d, p);
                if (val || externalValues.length) {
                  const blocks = [];
                  if (val) blocks.push(buildSwapLessonBlock(val, teacher, d, p));
                  externalValues.forEach((externalValue, index) => {
                    blocks.push(buildSwapLessonBlock(externalValue, teacher, d, p, true, index));
                  });
                  return `<td style="padding:3px;background:white;"><div style="display:flex;flex-direction:column;gap:3px;">${blocks.join('')}</div></td>`;
                }
                if (isChatech && !val) return `<td style="background:var(--cell-chatech-bg);color:var(--cell-chatech-tx);font-size:11px;font-weight:700;">창체</td>`;
                if (blocked) return `<td style="background:var(--cell-blocked-bg);font-size:10px;color:#c07070;">교체불가</td>`;
                if (!val) return `<td class="teacher-free-cell"><span>공강</span></td>`;
                return `<td></td>`;
              }).join('')}
            </tr>`;
            return lunchRow + row;
          }).join('')}
        </tbody>
      </table>
    </div></article>`;
}

function renderTeacherDetailTable(teachers) {
  const panel = qs('#teacherDetailPanel');
  if (!panel) return;
  const selected = (Array.isArray(teachers) ? teachers : [teachers]).filter(name => ALL_TEACHERS.includes(name));
  if (!selected.length) {
    panel.innerHTML = `<div class="empty-state"><div class="empty-icon">👈</div><h3>왼쪽에서 선생님을 선택해주세요</h3><p>쉼표나 공백으로 여러 이름을 검색하면 시간표를 나란히 비교할 수 있습니다</p></div>`;
    return;
  }
  const compact = selected.length > 1;
  panel.innerHTML = `<div class="teacher-compare-summary"><i class="fas fa-columns"></i> ${selected.length}명 시간표 비교</div><div class="teacher-compare-grid ${selected.length === 1 ? 'single' : ''}">${selected.map(teacher => buildTeacherDetailCard(teacher, compact)).join('')}</div>`;
}

// ═══════════════════════════════════════════════
// 공강 시간표 탭
// ═══════════════════════════════════════════════
function renderFreeTab() {
  const listEl = qs('#freeTeacherList');
  if (!listEl) return;
  const searchVal = (qs('#freeSearch')?.value || '').toLowerCase();

  const filtered = ALL_TEACHERS.filter(t => !searchVal || t.includes(searchVal));

  if (!filtered.length) {
    listEl.innerHTML = `<div style="padding:14px;text-align:center;color:var(--txt-light);font-size:12px;">검색 결과 없음</div>`;
    return;
  }

  listEl.innerHTML = filtered.map(t => {
    const sch = TEACHER_SCHEDULE[t] || {};
    let freeCount = 0;
    DAYS.forEach(d => PERIODS.forEach(p => {
      if (!sch[d+p] && !isChatcheTime(t,d,p)) freeCount++;
    }));
    const active = STATE.freeSelectedTeacher === t ? 'active' : '';
    const homeroomCls = TEACHER_TO_CLASS[t] || '';
    return `<button class="side-btn-item ${active}" onclick="selectFreeTeacher('${t}')">
      <span>${t}</span>
      <span class="side-btn-sub">${homeroomCls ? homeroomCls + ' 담임 · ' : ''}공강 ${freeCount}칸</span>
    </button>`;
  }).join('');

  if (STATE.freeSelectedTeacher) renderFreeDetail(STATE.freeSelectedTeacher);
}

function selectFreeTeacher(teacher) {
  STATE.freeSelectedTeacher = teacher;
  renderFreeTab();
  renderFreeDetail(teacher);
}

function renderFreeDetail(teacher) {
  const panel = qs('#freeDetailPanel');
  if (!panel) return;
  const sch = TEACHER_SCHEDULE[teacher] || {};
  const gradeGroup = getTeacherGradeGroup(teacher);
  const lunchAfter = gradeGroup === '3' ? 3 : 4;
  const lunchLabel = gradeGroup === '3' ? '점심' : '점심';

  let html = `<div class="card-header"><i class="fas fa-clock"></i> ${teacher} 선생님 공강 시간표</div>`;
  html += `<div style="overflow-x:auto;padding:14px;">`;
  html += `<table style="border-collapse:collapse;width:100%;font-size:12px;min-width:420px;">
    <thead><tr>
      <th style="background:linear-gradient(135deg,#5b7fe8,#9b7de8);color:white;padding:8px;text-align:center;width:68px;border-radius:6px 0 0 0;">교시</th>
      ${DAYS.map((d,i)=>`<th style="background:linear-gradient(135deg,#5b7fe8,#9b7de8);color:white;padding:8px;text-align:center;${i===DAYS.length-1?'border-radius:0 6px 0 0;':''}">${d}요일</th>`).join('')}
    </tr></thead>
    <tbody>`;

  PERIODS.forEach(p => {
    // 점심 행 삽입
    if (p === lunchAfter + 1) {
      html += `<tr>
        <td style="background:#fff8ea;padding:7px 4px;text-align:center;font-size:10px;color:#b8860b;font-style:italic;">점심</td>
        ${DAYS.map(()=>`<td style="background:#fff8ea;padding:7px;text-align:center;font-size:10.5px;color:#b8860b;">점심시간</td>`).join('')}
      </tr>`;
    }
    html += `<tr>
      <td style="background:var(--bg-soft);padding:7px 4px;text-align:center;font-weight:700;font-size:11.5px;border-bottom:1px solid var(--border-lt);">
        ${p}교시
        <div style="font-size:9px;color:var(--txt-light);">${PERIOD_TIMES[p].time}</div>
      </td>`;
    DAYS.forEach(d => {
      const val = sch[d + p] || '';
      const isChatech = isChatcheTime(teacher, d, p);
      const blocked = isBlockedTime(teacher, d, p);
      if (isChatech && !val) {
        html += `<td style="background:var(--cell-chatech-bg);text-align:center;font-size:11px;color:var(--cell-chatech-tx);padding:8px;font-weight:700;">창체</td>`;
      } else if (blocked) {
        html += `<td style="background:var(--cell-blocked-bg);text-align:center;font-size:10px;color:#c07070;padding:6px;">불가</td>`;
      } else if (!val) {
        html += `<td style="background:var(--cell-free-bg);text-align:center;font-weight:800;color:var(--cell-free-tx);font-size:14px;padding:8px;">✓</td>`;
      } else {
        const info = parseCellValue(val, teacher, d + p);
        let tdStyle = 'padding:5px;text-align:center;border-bottom:1px solid var(--border-lt);';
        if (info.isOnline) {
          tdStyle += 'background:#e8f5e9;';
          html += `<td style="${tdStyle}" title="온라인 수업">
            <div style="font-size:10px;font-weight:700;color:#2e7d32;">온라인</div>
            <div style="font-size:9.5px;color:#388e3c;">${info.classLabel}</div>
          </td>`;
        } else if (info.isMint) {
          tdStyle += 'background:var(--cell-mint-bg);';
          const mintLabel = teacher === '체육순회' ? '[순회]' : '[강사]';
          html += `<td style="${tdStyle}">
            <div style="font-size:11.5px;font-weight:700;">${info.subject}</div>
            <div style="font-size:9px;color:var(--cell-mint-bd);">${mintLabel}${info.classLabel}</div>
          </td>`;
        } else if (info.isSelect) {
          tdStyle += 'background:var(--cell-select-bg);';
          html += `<td style="${tdStyle}">
            <div style="font-size:11.5px;font-weight:700;">${info.subject}</div>
            <div style="font-size:10px;color:var(--txt-mid);">${info.classLabel}</div>
          </td>`;
        } else {
          html += `<td style="${tdStyle}">
            <div style="font-size:11.5px;font-weight:700;">${info.subject}</div>
            <div style="font-size:10px;color:var(--txt-mid);">${info.classLabel}</div>
          </td>`;
        }
      }
    });
    html += `</tr>`;
  });

  html += `</tbody></table></div>`;
  panel.innerHTML = html;
}

// ═══════════════════════════════════════════════
// 협의회 시간 탭
// ═══════════════════════════════════════════════
function renderMeetingTab() {
  const listEl = qs('#meetingTeacherList');
  if (!listEl) return;
  const rawSearch = (qs('#meetingSearch')?.value || '').trim();
  const searchTerms = rawSearch ? rawSearch.split(/[,\s]+/).map(s => s.trim().toLowerCase()).filter(Boolean) : [];

  const filtered = ALL_TEACHERS.filter(t => !searchTerms.length || searchTerms.some(s => t.toLowerCase().includes(s)));
  if (!filtered.length) {
    listEl.innerHTML = `<div style="padding:14px;text-align:center;color:var(--txt-light);font-size:12px;">검색 결과 없음</div>`;
  } else {
    listEl.innerHTML = filtered.map(t => {
      const selected = STATE.meetingSelectedTeachers.has(t);
      const grp = getTeacherGradeGroup(t);
      const grpBadge = grp === '3'
        ? `<span class="meeting-grade-badge grade3">3학년</span>`
        : `<span class="meeting-grade-badge grade12">1·2학년</span>`;
      return `<button class="side-btn-item meeting-teacher-btn ${selected ? 'selected' : ''}"
          onclick="toggleMeetingTeacher('${t}', ${!selected})">
        <span class="meeting-teacher-icon"><i class="fas fa-user"></i></span>
        <span class="meeting-btn-copy"><span class="meeting-btn-name">${t} 선생님</span><span class="meeting-btn-meta">${grpBadge}</span></span>
        <span class="meeting-check">${selected ? '✓' : '<i class="fas fa-chevron-right"></i>'}</span>
      </button>`;
    }).join('');
  }

  const countEl = qs('#meetingCount');
  if (countEl) countEl.textContent = `${STATE.meetingSelectedTeachers.size}명 선택됨`;
  if (STATE.meetingSelectedTeachers.size >= 2) findMeetingTime();
}

function toggleMeetingTeacher(teacher, checked) {
  if (checked) STATE.meetingSelectedTeachers.add(teacher);
  else STATE.meetingSelectedTeachers.delete(teacher);
  renderMeetingTab();
}

function resetMeetingSelection() {
  STATE.meetingSelectedTeachers.clear();
  renderMeetingTab();
  qs('#meetingResult').innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><h3>교사를 2명 이상 선택해주세요</h3><p>공통으로 공강인 시간을 자동으로 찾아드립니다</p></div>`;
}

function findMeetingTime() {
  if (STATE.meetingSelectedTeachers.size < 2) return;
  const teachers = [...STATE.meetingSelectedTeachers];
  const selectedDays = qsa('#meetingDayFilters .filter-chip.checked').map(el => el.dataset.value);
  const selectedPeriods = qsa('#meetingPeriodFilters .filter-chip.checked').map(el => parseInt(el.dataset.value));

  const available = [];
  DAYS.forEach(day => {
    if (!selectedDays.includes(day)) return;
    PERIODS.forEach(period => {
      if (!selectedPeriods.includes(period)) return;

      if (period === 4) {
        // 4교시는 교사의 소속 학년이 아니라 실제 시간구간으로 충돌을 판정한다.
        // 혼합 학년 협의에서도 선택한 교사 전원이 해당 구간에 비어 있어야 한다.
        if (teachers.every(t => !isBlockedTime(t,day,period) && !isChatcheTime(t,day,period) && !isTeacherBusyAt(t, day, period, { grade:'1' }))) {
          available.push({ day, period, type:'4A', note:'1·2학년 기준' });
        }
        if (teachers.every(t => !isBlockedTime(t,day,period) && !isChatcheTime(t,day,period) && !isTeacherBusyAt(t, day, period, { grade:'3' }))) {
          available.push({ day, period, type:'4B', note:'3학년 기준' });
        }
      } else {
        const allFree = teachers.every(t =>
          !isBlockedTime(t,day,period) && !isChatcheTime(t,day,period) && !(TEACHER_SCHEDULE[t]||{})[day+period]
        );
        if (allFree) available.push({ day, period, type:'normal', note:'' });
      }
    });
  });

  renderMeetingResult(teachers, available);
}

function renderMeetingResult(teachers, times) {
  const el = qs('#meetingResult');
  const copyBtn = qs('#meetingCopyBtn');
  if (copyBtn) copyBtn.style.display = 'none';

  // 선택 교사 상단 바
  let html = `<div class="meeting-selected-bar">
    <span class="meeting-selected-label">선택 ${teachers.length}명:</span>
    ${teachers.map(t => `<span class="meeting-selected-tag">${t} <button onclick="toggleMeetingTeacher('${t}',false)" style="background:none;border:none;cursor:pointer;color:inherit;font-weight:900;margin-left:2px;padding:0;">×</button></span>`).join('')}
    <button class="btn btn-outline btn-sm" onclick="resetMeetingSelection()" style="margin-left:auto;white-space:nowrap;">전체 해제</button>
    <button class="btn btn-dark btn-sm" onclick="printMeetingResult()"><i class="fas fa-print"></i> 인쇄</button>
  </div>`;

  if (times.length === 0) {
    html += `<div class="empty-state"><div class="empty-icon">😞</div><h3>공통 공강 시간이 없습니다</h3><p>선택한 교사들이 동시에 공강인 시간이 없습니다</p></div>`;
  } else {
    html += buildMeetingTable(teachers, times);
  }
  el.innerHTML = html;
}

function buildMeetingTable(teachers, times) {
  const freeSet = new Set(times.map(t => t.day + t.period));
  const free4A  = new Set(times.filter(t => t.type === '4A').map(t => t.day + '4A'));
  const free4B  = new Set(times.filter(t => t.type === '4B').map(t => t.day + '4B'));

  // 특정 교시·요일의 수업/공강 계산
  function getCellInfo(day, period, targetGrade = null) {
    const grp = teachers;
    let teachingCount = 0; let freeTeachers = [];
    grp.forEach(t => {
      const ch  = isChatcheTime(t, day, period);
      const bl  = isBlockedTime(t, day, period);
      const busy = isTeacherBusyAt(t, day, period, targetGrade ? { grade:targetGrade } : {});
      if (busy || ch || bl) teachingCount++; else freeTeachers.push(t);
    });
    return { teachingCount, freeTeachers, total: grp.length };
  }

  const totalTeachers = teachers.length;
  let html = `<div class="meeting-table-wrap">`;
  html += `<div class="meeting-table-info"><i class="fas fa-circle" style="color:#27ae60;font-size:10px;"></i> <strong>공통 공강 (${totalTeachers}교시 시차 반영)</strong></div>`;
  html += `<div class="meeting-tbl-scroll"><table class="meeting-tbl">
    <thead><tr>
      <th class="meeting-th-period">교시</th>
      ${DAYS.map(d => `<th class="meeting-th-day">${d}</th>`).join('')}
    </tr></thead>
    <tbody>`;

  PERIODS.forEach(p => {
    if (p === 4) {
      html += `<tr><td class="meeting-td-period">
        <span class="meeting-period-num">4</span>
        <span class="meeting-period-sub">11:40~12:30</span>
        <span class="meeting-period-grade">1·2학년</span>
      </td>`;
      DAYS.forEach(day => {
        const isAllFree = free4A.has(day + '4A');
        const info = getCellInfo(day, 4, '1');
        html += buildMeetingCell(isAllFree, info.teachingCount, info.freeTeachers, info.total);
      });
      html += `</tr>`;

      html += `<tr><td class="meeting-td-period">
        <span class="meeting-period-num">4</span>
        <span class="meeting-period-sub">12:40~13:30</span>
        <span class="meeting-period-grade">3학년</span>
      </td>`;
      DAYS.forEach(day => {
        const isAllFree = free4B.has(day + '4B');
        const info = getCellInfo(day, 4, '3');
        html += buildMeetingCell(isAllFree, info.teachingCount, info.freeTeachers, info.total);
      });
      html += `</tr>`;
    } else {
      const timeLabel = PERIOD_TIMES[p]?.time?.split('~')[0]?.trim() || '';
      html += `<tr><td class="meeting-td-period">
        <span class="meeting-period-num">${p}</span>
        <span class="meeting-period-sub">${timeLabel}</span>
      </td>`;
      DAYS.forEach(day => {
        const isAllFree = freeSet.has(day + p);
        const info = getCellInfo(day, p);
        html += buildMeetingCell(isAllFree, info.teachingCount, info.freeTeachers, info.total);
      });
      html += `</tr>`;
    }
  });

  html += `</tbody></table></div></div>`;
  return html;
}

function buildMeetingCell(isAllFree, teachingCount, freeTeachers, total) {
  if (isAllFree || (freeTeachers.length === total && total > 0)) {
    return `<td class="meeting-td free-all">
      <div class="mtd-check" title="공강">☕</div>
      <div class="mtd-free-label">공강</div>
    </td>`;
  } else if (freeTeachers.length > 0) {
    return `<td class="meeting-td free-partial">
      <div class="mtd-teaching-count">${teachingCount}명 수업</div>
      ${freeTeachers.map(t => `<div class="mtd-free-name">${t} 가능</div>`).join('')}
    </td>`;
  } else {
    return `<td class="meeting-td busy-all">
      <div class="mtd-teaching-count">${teachingCount}명 수업</div>
    </td>`;
  }
}

function copyMeetingResult() {
  const teachers = [...STATE.meetingSelectedTeachers];
  const selectedDays = qsa('#meetingDayFilters .filter-chip.checked').map(el => el.dataset.value);
  const selectedPeriods = qsa('#meetingPeriodFilters .filter-chip.checked').map(el => parseInt(el.dataset.value));
  let text = `[협의시간 결과]\n참석: ${teachers.join(', ')} 선생님 (${teachers.length}명)\n\n`;
  DAYS.forEach(d => {
    if (!selectedDays.includes(d)) return;
    PERIODS.forEach(p => {
      if (!selectedPeriods.includes(p)) return;
      if (p === 4) {
        const free12 = teachers.every(t => !isBlockedTime(t,d,p) && !isChatcheTime(t,d,p) && !isTeacherBusyAt(t,d,p,{grade:'1'}));
        const free3 = teachers.every(t => !isBlockedTime(t,d,p) && !isChatcheTime(t,d,p) && !isTeacherBusyAt(t,d,p,{grade:'3'}));
        if (free12) text += `○ ${d}요일 4교시 (1·2학년 11:40~12:30) - 전체 공강\n`;
        if (free3) text += `○ ${d}요일 4교시 (3학년 12:40~13:30) - 전체 공강\n`;
      } else {
        const allFree = teachers.every(t => !isBlockedTime(t,d,p) && !isChatcheTime(t,d,p) && !isTeacherBusyAt(t,d,p,{}));
        if (allFree) text += `○ ${d}요일 ${p}교시 - 전체 공강\n`;
      }
    });
  });
  copyToClipboard(text, null);
}

function printMeetingResult() {
  const result = qs('#meetingResult');
  if (!result || STATE.meetingSelectedTeachers.size < 2) {
    showAlert('교사를 2명 이상 선택해주세요.');
    return;
  }
  const printWindow = window.open('', '_blank', 'width=1100,height=800');
  if (!printWindow) {
    showAlert('팝업이 차단되었습니다. 브라우저에서 팝업을 허용해주세요.');
    return;
  }
  const teachers = [...STATE.meetingSelectedTeachers];
  printWindow.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>협의시간 결과</title>
    <style>body{font-family:'Noto Sans KR',sans-serif;padding:24px;color:#333}h1{font-size:20px;margin:0 0 6px}.meta{font-size:13px;margin-bottom:18px;color:#666}.meeting-selected-bar button,.meeting-selected-tag button,.btn{display:none!important}.meeting-tbl{width:100%;border-collapse:collapse}.meeting-tbl th,.meeting-tbl td{border:1px solid #bbb;padding:8px;text-align:center}.meeting-tbl th{background:#eee}.free-all{background:#eafaf1}.free-partial{background:#fff8dc}.meeting-table-info{margin-bottom:10px;font-weight:700}.meeting-period-grade,.meeting-period-sub{display:block;font-size:10px}.mtd-free-name{font-size:10px}@media print{body{padding:0}}</style>
    </head><body><h1>협의시간 결과</h1><div class="meta">참석: ${teachers.join(', ')} 선생님 (${teachers.length}명)</div>${result.innerHTML}</body></html>`);
  printWindow.document.close();
  printWindow.onload = () => { printWindow.focus(); printWindow.print(); };
}

// ═══════════════════════════════════════════════
// 학사일정 탭 (달력형)
// ═══════════════════════════════════════════════
function renderCalendarTab() {
  const monthList = qs('#calendarMonthList');
  const content   = qs('#calendarContent');
  if (!monthList || !content) return;

  const periods = [...new Set(ACADEMIC_CALENDAR.map(e => e.date.slice(0,7)))].sort();
  
  // 버튼식 월 선택 (cal-month-list 스타일)
  monthList.innerHTML = `<div class="cal-month-list">` +
    periods.map(period => {
      const [year,monthText] = period.split('-'), month = Number(monthText);
      const label = `${year === '2026' ? '' : `${year}년 `}${month}월`;
      const cnt = ACADEMIC_CALENDAR.filter(e => e.date.startsWith(`${period}-`)).length;
      return `<div class="cal-month-row">
        <button class="cal-month-btn ${period === STATE.calendarPeriod ? 'active' : ''}" onclick="selectCalendarMonth('${period}')">
          ${label} <span style="font-size:10px;opacity:0.7;font-weight:400;">(${cnt})</span>
        </button>
        <button class="cal-month-print" onclick="printCalendarMonth('${period}')" title="${label}만 출력" aria-label="${label} 출력"><i class="fas fa-print"></i></button>
      </div>`;
    }).join('') +
  `</div>`;

  if (!periods.includes(STATE.calendarPeriod)) STATE.calendarPeriod = periods[0] || '2026-01';
  renderCalendarGrid(STATE.calendarPeriod);
}

function selectCalendarMonth(period) {
  STATE.calendarPeriod = period;
  renderCalendarTab();
}

function printCalendarMonth(period) {
  STATE.calendarPeriod = period;
  renderCalendarTab();
  const [year,monthText] = period.split('-'), month = Number(monthText);
  const content = qs('#calendarContent');
  if (!content) return;
  const printWindow = window.open('', '_blank', 'width=1100,height=850');
  if (!printWindow) { showAlert('팝업 차단을 해제한 뒤 다시 출력해주세요.'); return; }
  printWindow.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${year}년 ${month}월 학사일정</title><style>
    *{box-sizing:border-box}body{font-family:"Noto Sans KR",Arial,sans-serif;color:#293548;margin:0;padding:8mm}h1{text-align:center;font-size:21px;margin:0 0 12px}.print-sub{text-align:right;font-size:10px;color:#748094;margin-bottom:8px}
    .cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}.cal-header-cell{text-align:center;font-size:11px;font-weight:700;padding:5px;background:#edf3f6}.cal-cell{min-height:78px;border:1px solid #cfd8df;padding:5px;overflow:hidden}.cal-cell.other-month{background:#f4f5f6}.cal-cell.sunday .cal-day-num{color:#d64b4b}.cal-cell.saturday .cal-day-num{color:#3977b8}.cal-day-num{font-size:12px;font-weight:800;margin-bottom:4px}.cal-event{font-size:9px;padding:2px 4px;border-radius:4px;margin-bottom:2px;white-space:normal}.cal-event.important{background:#fff4b8}.cal-event.exam{background:#ffe0e0}.cal-event.holiday{background:#dff1df}.cal-event.vacation{background:#eadfff}.cal-event.event{background:#ffead0}
    .badge{display:inline-block;padding:2px 6px;border-radius:10px;font-size:9px;font-weight:700}.badge-blue{background:#dfe9ff}.badge-red{background:#ffe0e0}.badge-green{background:#dff1df}.badge-purple{background:#eadfff}.badge-orange{background:#ffead0}
    .calendar-month-heading{display:none!important}.calendar-event-list{padding:10px 0!important;border-top:2px solid #aeb9c3!important}button{display:none!important}@page{size:A4 landscape;margin:8mm}@media print{body{padding:0}}
  </style></head><body><h1>제주중앙고등학교 ${year}년 ${month}월 학사일정</h1><div class="print-sub">${new Date().toLocaleDateString('ko-KR')} 출력</div><div id="calendarContent">${content.innerHTML}</div></body></html>`);
  printWindow.document.close();
  printWindow.onload = () => { printWindow.focus(); printWindow.print(); };
}

function renderCalendarGrid(period) {
  const content = qs('#calendarContent');
  if (!content) return;

  const [yearText,monthText] = period.split('-');
  const year = Number(yearText), month = Number(monthText);
  const firstDay = new Date(year, month - 1, 1);
  const lastDay  = new Date(year, month, 0);
  const startDow = firstDay.getDay(); // 0=일
  const totalDays = lastDay.getDate();
  const today = new Date();

  // 이달 이벤트 맵
  const eventMap = {};
  ACADEMIC_CALENDAR.forEach(ev => {
    const d = ev.date.split('-');
    if (ev.date.startsWith(`${period}-`)) {
      const key = parseInt(d[2]);
      if (!eventMap[key]) eventMap[key] = [];
      eventMap[key].push(ev);
    }
  });

  const DAY_LABELS = ['일','월','화','수','목','금','토'];

  let html = `<div class="calendar-month-heading" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:10px 16px;border-bottom:1px solid var(--border-lt);background:var(--sky-pale);">
    <span style="font-size:18px;font-weight:800;color:var(--brown);">📅 ${year}년 ${month}월</span>
  </div>
  <div class="cal-grid">`;

  // 요일 라벨
  DAY_LABELS.forEach((dl, i) => {
    const color = i===0 ? 'color:#e05050;' : i===6 ? 'color:var(--sky-deep);' : '';
    html += `<div class="cal-header-cell" style="${color}">${dl}</div>`;
  });

  // 이전 달 빈칸
  for (let i = 0; i < startDow; i++) {
    html += `<div class="cal-cell other-month"></div>`;
  }

  // 날짜 채우기
  for (let d = 1; d <= totalDays; d++) {
    const dow = (startDow + d - 1) % 7;
    const events = eventMap[d] || [];
    const isToday = (today.getFullYear() === year && today.getMonth()+1 === month && today.getDate() === d);
    const isSun = dow === 0;
    const isSat = dow === 6;

    let classes = 'cal-cell';
    if (isToday) classes += ' today';
    if (isSun) classes += ' sunday';
    if (isSat) classes += ' saturday';

    html += `<div class="${classes}">
      <div class="cal-day-num">${d}</div>`;

    events.slice(0,2).forEach(ev => {
      html += `<div class="cal-event ${ev.type}" title="${ev.event}">${ev.event}</div>`;
    });
    if (events.length > 2) {
      html += `<div style="font-size:9px;color:var(--txt-light);">+${events.length-2}개</div>`;
    }
    html += `</div>`;
  }

  // 남은 빈칸
  const totalCells = startDow + totalDays;
  const remainder = 7 - (totalCells % 7);
  if (remainder < 7) {
    for (let i = 0; i < remainder; i++) {
      html += `<div class="cal-cell other-month"></div>`;
    }
  }
  html += `</div>`;

  // 이달 이벤트 목록 (간결하게)
  const monthEvents = ACADEMIC_CALENDAR.filter(e => e.date.startsWith(`${period}-`));
  if (monthEvents.length > 0) {
    html += `<div class="calendar-event-list" style="border-top:2px solid var(--border-lt);padding:12px 14px;">
      <div style="font-size:12px;font-weight:700;color:var(--txt-mid);margin-bottom:8px;">📋 ${month}월 일정 목록</div>`;
    monthEvents.forEach(ev => {
      const d = new Date(ev.date);
      const dayNames = ['일','월','화','수','목','금','토'];
      html += `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border-lt);flex-wrap:wrap;">
        <span style="font-size:12px;font-weight:700;color:var(--brown);min-width:36px;">${d.getDate()}일</span>
        <span style="font-size:11px;color:var(--txt-light);">(${dayNames[d.getDay()]})</span>
        <span class="badge ${getEventBadgeClass(ev.type)}" style="font-size:10px;">${getEventTypeName(ev.type)}</span>
        <span style="font-size:13px;color:var(--txt-dark);font-weight:600;flex:1;">${ev.event}</span>
      </div>`;
    });
    html += `</div>`;
  }

  content.innerHTML = html;
}

function navigateCalendar(dir) {
  const periods = [...new Set(ACADEMIC_CALENDAR.map(e => e.date.slice(0,7)))].sort();
  const idx = periods.indexOf(STATE.calendarPeriod);
  const newIdx = idx + dir;
  if (newIdx >= 0 && newIdx < periods.length) {
    STATE.calendarPeriod = periods[newIdx];
    renderCalendarTab();
  }
}

function getEventTypeName(type) {
  const map = { important:'중요일정', exam:'시험', holiday:'공휴일·휴업', vacation:'방학', event:'행사' };
  return map[type] || type;
}
function getEventBadgeClass(type) {
  const map = { important:'badge-blue', exam:'badge-red', holiday:'badge-green', vacation:'badge-purple', event:'badge-orange' };
  return map[type] || 'badge-gray';
}

// ═══════════════════════════════════════════════
// 연락처 탭 (비밀번호 보호)
// ═══════════════════════════════════════════════
function renderContactTab() {
  // 잠금 해제 상태이면 내용 보여주기
  if (STATE.contactUnlocked) {
    showContactContent();
  } else {
    const lock = qs('#contactLockScreen');
    const content = qs('#contactContent');
    if (lock) lock.style.display = 'flex';
    if (content) content.style.display = 'none';
  }
}

function verifyContactPassword() {
  const pw = (qs('#contactPassword')?.value || '').trim();
  const hint = qs('#contactHint');
  if (pw.length !== 4) {
    if (hint) { hint.textContent = '4자리 숫자를 입력해주세요.'; hint.style.color = '#c0392b'; }
    return;
  }
  // 연락처에 등록된 교직원 휴대전화 뒷 4자리와 일치하는지 확인
  const matched = STAFF_CONTACTS.some(c => {
    if (!/^010-\d{4}-\d{4}$/.test(c.phone || '')) return false;
    const digits = c.phone.replace(/-/g,'');
    return digits.slice(-4) === pw;
  });
  if (matched) {
    STATE.contactUnlocked = true;
    if (qs('#contactPassword')) qs('#contactPassword').value = '';
    if (hint) { hint.textContent = ''; }
    showContactContent();
  } else {
    if (hint) { hint.textContent = '비밀번호가 올바르지 않습니다.'; hint.style.color = '#c0392b'; }
  }
}

function showContactContent() {
  const lock = qs('#contactLockScreen');
  const content = qs('#contactContent');
  if (lock) lock.style.display = 'none';
  if (content) content.style.display = 'block';
  renderContactList();
}

function lockContact() {
  STATE.contactUnlocked = false;
  const lock = qs('#contactLockScreen');
  const content = qs('#contactContent');
  if (lock) lock.style.display = 'flex';
  if (content) content.style.display = 'none';
  if (qs('#contactPassword')) qs('#contactPassword').value = '';
}

function copyContactPhone(phone, btn, event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  const number = String(phone || '').trim();
  if (!number || !btn) return;

  const showCopied = () => {
    const original = btn.innerHTML;
    btn.classList.add('copied');
    btn.innerHTML = '<i class="fas fa-check"></i><span>복사됨</span>';
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.innerHTML = original;
    }, 1600);
  };
  const fallbackCopy = () => {
    const input = document.createElement('textarea');
    input.value = number;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(input);
    if (!copied) throw new Error('copy failed');
    showCopied();
  };

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(number).then(showCopied).catch(() => {
      try { fallbackCopy(); } catch (error) { showAlert('전화번호 복사에 실패했습니다.'); }
    });
  } else {
    try { fallbackCopy(); } catch (error) { showAlert('전화번호 복사에 실패했습니다.'); }
  }
}

function renderContactList() {
  const searchVal = (qs('#contactSearch')?.value || '').toLowerCase();
  const dept = STATE.contactDept;

  const depts = ['all', ...new Set(STAFF_CONTACTS.map(c => c.dept))];
  const deptBar = qs('#contactDeptBar');
  if (deptBar) {
    deptBar.innerHTML = depts.map(d =>
      `<div class="dept-chip ${d === dept ? 'active' : ''}" onclick="selectContactDept('${d}')">
        ${d === 'all' ? '전체' : d}
      </div>`
    ).join('');
  }

  const grid = qs('#contactGrid');
  if (!grid) return;

  const filtered = STAFF_CONTACTS.filter(c => {
    const matchDept = dept === 'all' || c.dept === dept;
    const matchSearch = !searchVal || c.name.includes(searchVal) || c.role.includes(searchVal) || c.ext.includes(searchVal);
    return matchDept && matchSearch;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="empty-icon">📞</div><h3>검색 결과가 없습니다</h3></div>`;
    return;
  }

  // 담임 역할 맵: teacher name → "X-Y담임"
  const homeroomRoleMap = {};
  Object.entries(HOMEROOM_TEACHERS).forEach(([cls, name]) => {
    if (!homeroomRoleMap[name]) homeroomRoleMap[name] = [];
    homeroomRoleMap[name].push(`${cls}담임`);
  });

  // 부서별 배지 색상
  const deptBadgeMap = {
    '관리직':'badge-brown', '교무부':'badge-blue', '1학년부':'badge-sky',
    '2학년부':'badge-green', '3학년부':'badge-purple', '교육정보부':'badge-orange',
    '취업부':'badge-orange', '학생생활안전부':'badge-red', '예술건강부':'badge-yellow',
    '보건실':'badge-green', '방송실':'badge-gray', '교목실':'badge-purple',
    '상담실':'badge-sky', '행정실':'badge-gray', '급식소':'badge-gray',
    '교과':'badge-blue',
  };

  // 아바타 이모지
  const deptAvatarMap = {
    '관리직':'🏫', '교무부':'📋', '1학년부':'🌱', '2학년부':'🌿',
    '3학년부':'🌳', '교육정보부':'💻', '취업부':'💼', '학생생활안전부':'🛡️',
    '예술건강부':'🎨', '보건실':'🏥', '방송실':'📻', '교목실':'✝️',
    '상담실':'💬', '행정실':'🏢', '급식소':'🍱', '교과':'📚',
  };

  grid.innerHTML = filtered.map(c => {
    const homeroomRoles = homeroomRoleMap[c.name] || [];
    const badgeCls = deptBadgeMap[c.dept] || 'badge-gray';
    const avatarEmoji = deptAvatarMap[c.dept] || '👤';
    const phoneDigits = String(c.phone || '').replace(/[^\d+]/g, '');

    // 역할 표시: role + 담임 역할 합산
    let roleDisplay = c.role;
    if (homeroomRoles.length > 0) {
      // 담임 정보가 role에 이미 없으면 추가
      const homeroomStr = homeroomRoles.join(', ');
      if (!c.role.includes('담임')) {
        roleDisplay = `${c.role}<br><span style="color:var(--orange);font-weight:700;">${homeroomStr}</span>`;
      } else {
        roleDisplay = c.role;
      }
    }

    return `<div class="contact-card">
      <div class="contact-avatar">${avatarEmoji}</div>
      <div class="contact-name">${c.name}</div>
      <div class="contact-role">${roleDisplay}</div>
      ${c.ext ? `<div class="contact-ext"><i class="fas fa-phone"></i> 내선 ${c.ext}</div>` : ''}
      ${c.phone && c.phone !== '-' ? `<div class="contact-phone-actions">
        <a class="contact-phone-link" href="tel:${phoneDigits}" aria-label="${c.name} 선생님 ${c.phone} 전화 걸기" title="${c.phone} 전화 걸기">
          <i class="fas fa-phone-alt" aria-hidden="true"></i><span>${c.phone}</span>
        </a>
        <button type="button" class="contact-phone-copy" onclick="copyContactPhone('${c.phone}',this,event)" aria-label="${c.name} 선생님 전화번호 복사" title="전화번호 복사">
          <i class="far fa-copy" aria-hidden="true"></i><span>복사</span>
        </button>
      </div>` : ''}
      <div class="contact-dept-badge"><span class="badge ${badgeCls}" style="margin-top:6px;">${c.dept}</span></div>
    </div>`;
  }).join('');
}

function selectContactDept(dept) {
  STATE.contactDept = dept;
  renderContactList();
}

// ═══════════════════════════════════════════════
// 실습실 시간표 탭
// ═══════════════════════════════════════════════
function renderLabTab() {
  // 사이드 버튼 목록 생성
  const sideList = qs('#labSideList');
  if (sideList) {
    const labNames = Object.keys(LAB_SCHEDULE);
    // 첫 진입 시 첫 번째 실습실 자동 선택
    if (!STATE.labSelected && labNames.length > 0) {
      STATE.labSelected = labNames[0];
    }
    sideList.innerHTML = labNames.map(name => {
      const active = STATE.labSelected === name ? 'active' : '';
      // 괄호 안 호실 추출: e.g. "컴퓨터실1(308호)" → "308호"
      const roomMatch = name.match(/\(([^)]+)\)/);
      const roomLabel = roomMatch ? roomMatch[1] : '';
      const displayName = getLabDisplayName(name);
      return `<button class="side-btn-item lab-room-button ${active}" data-lab="${name}" onclick="selectLab('${name}')" aria-pressed="${active ? 'true' : 'false'}">
        <span class="lab-room-button-icon"><i class="fas fa-door-open"></i></span>
        <span class="lab-room-button-copy">
          <span class="lab-room-button-name">${displayName}</span>
          <span class="lab-room-button-meta">주간 사용 현황${roomLabel ? ` · ${roomLabel}` : ''}</span>
        </span>
        <i class="fas fa-chevron-right lab-room-button-arrow" aria-hidden="true"></i>
      </button>`;
    }).join('');
  }

  // 선택된 실습실 시간표 표시
  renderLabDetail(STATE.labSelected);
}

function selectLab(labName) {
  STATE.labSelected = labName;
  // 사이드 버튼 active 업데이트
  qsa('#labSideList .side-btn-item').forEach(btn => {
    const selected = btn.dataset.lab === labName;
    btn.classList.toggle('active', selected);
    btn.setAttribute('aria-pressed', String(selected));
  });
  renderLabDetail(labName);
}

function renderLabDetail(labName) {
  const wrap = qs('#labTableWrap');
  if (!wrap || !labName) return;
  const sched = LAB_SCHEDULE[labName];
  if (!sched) {
    wrap.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><h3>시간표 데이터가 없습니다</h3></div>`;
    return;
  }

  const displayLabName = getLabDisplayName(labName);
  let html = `
    <div class="lab-detail-header">
      <span class="lab-detail-icon"><i class="fas fa-flask"></i></span>
      <div class="lab-detail-heading">
        <span class="lab-detail-eyebrow">SPECIAL CLASSROOM</span>
        <h2>${displayLabName}</h2>
        <p>요일별 정규수업과 담당 교사를 한눈에 확인하세요.</p>
      </div>
      <span class="lab-detail-status"><i class="fas fa-calendar-check"></i> 2학기</span>
    </div>
    <div class="lab-table-scroll">
      <table class="schedule-table lab-table">
        <thead>
          <tr>
            <th class="teacher-th lab-period-head">교시</th>
            ${DAYS.map(d=>`<th class="day-header">${d}요일</th>`).join('')}
          </tr>
        </thead>
        <tbody>`;

  // 실습실에 등장하는 교사 목록 수집 → 색상 매핑
  const labTeachers = new Set();
  DAYS.forEach(d => PERIODS.forEach(p => {
    const rawCell = (sched[d]||{})[p] || '';
    const cells = rawCell && typeof rawCell === 'object' ? Object.values(rawCell) : [rawCell];
    cells.filter(Boolean).forEach(cell => {
      const tm = cell.match(/[가-힣]{2,4}$/);
      if (tm) labTeachers.add(tm[0]);
    });
  }));
  const labTeacherArr = [...labTeachers].sort((a,b) => a.localeCompare(b,'ko'));
  const labColors = [
    {bg:'#EFF5F6',bd:'#8CAEB3',tx:'#284F55'},
    {bg:'#F8F3EA',bd:'#C7A76C',tx:'#664A1E'},
    {bg:'#F2F0F7',bd:'#9E91B5',tx:'#4A3D63'},
    {bg:'#EDF5F1',bd:'#7FA793',tx:'#285846'},
    {bg:'#F8EEEE',bd:'#C49393',tx:'#6A3535'},
    {bg:'#F4F2E9',bd:'#B9AA73',tx:'#5D5327'},
    {bg:'#EEF1F5',bd:'#8E9FB4',tx:'#33485F'},
    {bg:'#F6EEF2',bd:'#B28DA0',tx:'#623B50'},
    {bg:'#EFF4ED',bd:'#91A887',tx:'#3F5936'},
    {bg:'#F5F0EB',bd:'#B09A83',tx:'#574432'},
    {bg:'#EDF2F8',bd:'#819BB8',tx:'#2E4967'},
    {bg:'#F5EFF5',bd:'#AA90AA',tx:'#5A3D5A'},
  ];
  const teacherColorMap = {};
  labTeacherArr.forEach((t, i) => {
    teacherColorMap[t] = labColors[i % labColors.length];
  });

  // 범례
  html += `<div class="lab-teacher-legend"><span class="lab-legend-title"><i class="fas fa-user-tie"></i> 담당 교사</span>`;
  labTeacherArr.forEach(t => {
    const c = teacherColorMap[t];
    html += `<span class="lab-teacher-chip" style="--lab-chip-bg:${c.bg};--lab-chip-border:${c.bd};--lab-chip-text:${c.tx};"><i class="fas fa-circle"></i>${t}</span>`;
  });
  html += `</div>`;

  function appendLabRow(p, gradeGroup = null) {
    const time = gradeGroup ? getPeriodTime(p, gradeGroup === '3' ? '3' : '1') : getPeriodTime(p);
    const gradeLabel = gradeGroup === '3' ? '3학년' : gradeGroup === '12' ? '1·2학년' : '';
    html += `<tr>
      <td class="teacher-td lab-period-cell">
        <strong>${p}교시</strong>${gradeLabel ? `<span class="lab-period-grade">${gradeLabel}</span>` : ''}
        <span class="lab-period-time">${time}</span>
      </td>`;
    DAYS.forEach(d => {
      const rawCell = (sched[d]||{})[p] || '';
      const cell = gradeGroup && rawCell && typeof rawCell === 'object' ? (rawCell[gradeGroup] || '') : rawCell;
      if (cell) {
        const tm = cell.match(/[가-힣]{2,4}$/);
        const tName = tm ? tm[0] : '';
        const c = teacherColorMap[tName] || {bg:'var(--yellow-pale)',bd:'var(--border)',tx:'var(--brown)'};
        // 과목·반·교사 분리 표시
        const parts = cell.replace(/\s*(전상실|컴그실|만콘실|영상실|창구실|사행실|회계실)\s*/g,' ').trim().split(' ');
        const roomClass = parts[0] || '';
        const subj = parts[1] || '';
        const teacher = parts[2] || tName;
        html += `<td class="lab-lesson-cell" style="--lab-cell-bg:${c.bg};--lab-cell-border:${c.bd};--lab-cell-text:${c.tx};" title="${cell}"><button class="lab-lesson-button" onclick="openLabLessonMatching('${labName}','${d}',${p},'${gradeGroup || ''}')">
          <span class="lab-lesson-subject">${subj || roomClass}</span>
          <span class="lab-lesson-meta">${roomClass}${teacher && teacher !== subj ? ' · '+teacher : ''}</span>
        </button></td>`;
      } else {
        html += `<td class="lab-cell-empty"><span aria-hidden="true">—</span><small>비어 있음</small></td>`;
      }
    });
    html += `</tr>`;
  }

  PERIODS.forEach(p => {
    if (p === 4) {
      appendLabRow(4, '12');
      appendLabRow(4, '3');
    } else {
      appendLabRow(p);
    }
  });
  html += `</tbody></table></div>`;
  wrap.innerHTML = html;
}

function openLabLessonMatching(labName, day, period, gradeGroup = '') {
  const rawCell = (LAB_SCHEDULE[labName]?.[day] || {})[period] || '';
  const cell = gradeGroup && rawCell && typeof rawCell === 'object' ? (rawCell[gradeGroup] || '') : rawCell;
  if (!cell) return;
  const teacherMatch = String(cell).match(/([가-힣]{2,8})$/);
  const teacher = teacherMatch ? teacherMatch[1] : '';
  if (!teacher || !TEACHER_SCHEDULE[teacher]) {
    showAlert(`${getLabDisplayName(labName)} ${day}요일 ${period}교시의 담당 교사를 찾지 못했습니다.`);
    return;
  }
  const parts = String(cell).split(/\s+/);
  const classNum = parts[0] || '';
  const subject = parts[1] || '';
  const regular = (TEACHER_SCHEDULE[teacher] || {})[day + period] || '';
  const regularParts = regular.split(/\s+/);
  const regularSubject = (regularParts[1] || '').replace(/^[A-Z]_/, '');
  const lessonValue = regularParts[0] === classNum && regularSubject === subject
    ? regular
    : `${classNum} ${subject} ${labName}`;
  openLessonMatching(teacher, day, period, lessonValue, isExternalLesson(teacher, day, period, lessonValue));
}

// ═══════════════════════════════════════════════
// ═══════════════════════════════════════════════
// 교과별 수업 탭
// ═══════════════════════════════════════════════
function getSubjectGroups() {
  // 세부 과목 → 상위 교과 매핑
  const SUBJ_ALIAS = {
    '화법':'국어','화언':'국어','화작':'국어','독서':'국어','고전':'국어','언매':'국어','실국':'국어','심국':'국어','국어1':'국어','국어2':'국어','문학':'국어','교육':'국어',
    '수1':'수학','수2':'수학','수학1':'수학','수학2':'수학','확통':'수학','미적':'수학','미적1':'수학','경수':'수학','실수':'수학',
    '영어1':'영어','영어2':'영어','영2':'영어','영회':'영어','영독':'영어','심영':'영어','실영':'영어',
    '일본어':'외국어','중어B':'외국어','중어C':'외국어','중특A':'외국어','중특B':'외국어',
    '한국사':'사회','국사':'사회','통사2':'사회','경제':'사회','정법':'사회','법사':'사회','사탐':'사회','사문3':'사회','세지':'사회','한지':'사회','동사':'사회','동아시아사':'사회','윤리':'사회','윤사':'사회','생윤':'사회',
    '통과2':'과학','과탐2':'과학','지과2':'과학','화학2':'과학','물리2':'과학','생명2':'과학','세포':'과학','역학':'과학','융과':'과학','과사':'과학','물질':'과학','생명':'과학','지구':'과학','물리':'과학','화학':'과학',
    '종교':'종교',
    '체육1':'체육','체육2':'체육','스생':'체육','스생1':'체육','운동과건강':'체육',
  };
  const groups = {};
  // 1) SUBJECT_SUBSTITUTE_MAP 기반
  for (const [teacher, info] of Object.entries(SUBJECT_SUBSTITUTE_MAP)) {
    if (!info || !info.subject) continue;
    const subj = SUBJ_ALIAS[info.subject] || info.subject;
    if (!groups[subj]) groups[subj] = [];
    if (!groups[subj].includes(teacher)) groups[subj].push(teacher);
  }
  // 2) TEACHER_SCHEDULE에 있지만 SUBJECT_SUBSTITUTE_MAP에 없는 교사 추가
  for (const teacher of Object.keys(TEACHER_SCHEDULE)) {
    // 이미 추가된 교사 스킵
    let alreadyAdded = false;
    for (const arr of Object.values(groups)) { if (arr.includes(teacher)) { alreadyAdded = true; break; } }
    if (alreadyAdded) continue;
    const sched = TEACHER_SCHEDULE[teacher];
    const subjCount = {};
    for (const val of Object.values(sched)) {
      const m = String(val).match(/[1-3]\d{2}\s+(.+)/);
      if (m) {
        let s = m[1].replace(/^[A-Z]_/,'');
        const mapped = SUBJ_ALIAS[s] || s;
        subjCount[mapped] = (subjCount[mapped] || 0) + 1;
      }
    }
    if (Object.keys(subjCount).length === 0) continue;
    const mainSubj = Object.entries(subjCount).sort((a,b) => b[1]-a[1])[0][0];
    if (!groups[mainSubj]) groups[mainSubj] = [];
    if (!groups[mainSubj].includes(teacher)) groups[mainSubj].push(teacher);
  }
  // 교과별 수업 탭의 확정 수정사항
  for (const teachers of Object.values(groups)) {
    ['홍민영','김제령','김지윤','송준한','백경민','이순규'].forEach(name => {
      const index = teachers.indexOf(name);
      if (index >= 0) teachers.splice(index, 1);
    });
  }
  if (groups['상업']) groups['상업'] = groups['상업'].filter(name => name !== '고대홍');
  delete groups['국어2'];
  delete groups['체육2'];
  Object.keys(groups).forEach(subject => {
    // 교과별 수업 탭에는 실제 교사만 표시하고 온라인 수업용 계정은 제외한다.
    groups[subject] = groups[subject].filter(name => TEACHER_SCHEDULE[name] && !name.includes('온라인'));
    if (!groups[subject].length) delete groups[subject];
  });
  // 시간표가 없는 교사도 요청된 교과 버튼에 명시적으로 표시한다.
  groups['디자인'] = [...new Set([...(groups['디자인'] || []), '김제령'])];
  groups['체육'] = [...new Set([...(groups['체육'] || []), '김지윤'])];
  groups['영상'] = ['송준한'];
  groups['미술'] = [...new Set([...(groups['미술'] || []), '백경민'])];
  groups['종교'] = [...new Set([...(groups['종교'] || []), '이순규'])];
  groups['진로'] = [...new Set([...(groups['진로'] || []), '이순규'])];
  return groups;
}

function renderSubjectClassTab() {
  const view = STATE.subjectClassView || 'subject';
  // 토글 버튼 스타일
  const btnS = qs('#scViewSubject'), btnC = qs('#scViewClass');
  if (btnS && btnC) {
    btnS.className = `subject-view-button ${view === 'subject' ? 'active' : ''}`;
    btnC.className = `subject-view-button ${view === 'class' ? 'active' : ''}`;
    btnS.setAttribute('aria-pressed', view === 'subject' ? 'true' : 'false');
    btnC.setAttribute('aria-pressed', view === 'class' ? 'true' : 'false');
  }
  const header = qs('#scPanelHeader');
  if (view === 'subject') {
    if (header) header.innerHTML = '<span class="subject-selector-header-icon"><i class="fas fa-book"></i></span><span><strong>교과 선택</strong><small>확인할 교과를 선택하세요</small></span>';
    renderSubjectClassTab_subject();
  } else {
    if (header) header.innerHTML = '<span class="subject-selector-header-icon"><i class="fas fa-school"></i></span><span><strong>학년·반 선택</strong><small>담당 교사를 확인할 반을 선택하세요</small></span>';
    renderSubjectClassTab_class();
  }
}

function renderSubjectClassTab_subject() {
  const groups = getSubjectGroups();
  const listEl = qs('#subjectClassList');
  listEl.innerHTML = '';
  const subjectOrder = ['국어','수학','영어','외국어','사회','과학','체육','음악','미술','영상','정보','디자인','상업','종교','진로'];
  const subjects = Object.keys(groups).sort((a, b) => {
    const ai = subjectOrder.indexOf(a), bi = subjectOrder.indexOf(b);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
  subjects.forEach(subj => {
    const btn = cel('button', 'side-btn-item subject-selector-button' + (STATE.subjectClassSelected === subj ? ' active' : ''));
    btn.innerHTML = `<span class="subject-selector-icon"><i class="fas fa-book-open"></i></span><span class="subject-selector-copy"><strong>${subj}</strong><small>담당 교사 ${groups[subj].length}명</small></span><i class="fas fa-chevron-right subject-selector-arrow" aria-hidden="true"></i>`;
    btn.onclick = () => { STATE.subjectClassSelected = subj; renderSubjectClassTab(); };
    listEl.appendChild(btn);
  });
  if (STATE.subjectClassSelected && groups[STATE.subjectClassSelected]) {
    renderSubjectClassDetail(STATE.subjectClassSelected, groups[STATE.subjectClassSelected]);
  } else {
    renderAllSubjectClassDetails(subjects, groups);
  }
}

function renderAllSubjectClassDetails(subjects, groups) {
  const panel = qs('#subjectClassDetail');
  if (!panel) return;
  panel.innerHTML = `<div class="subject-overview-summary"><i class="fas fa-book-open"></i> 전체 ${subjects.length}개 교과 수업</div><div class="subject-overview-grid">${subjects.map(subject => buildSubjectClassDetail(subject, groups[subject], true)).join('')}</div>`;
}

function getClassTeacherMap() {
  const SUBJ_ALIAS = {
    '화법':'국어','화언':'국어','화작':'국어','독서':'국어','고전':'국어','언매':'국어','실국':'국어','심국':'국어','국어1':'국어','국어2':'국어','문학':'국어','교육':'국어',
    '수1':'수학','수2':'수학','수학1':'수학','수학2':'수학','확통':'수학','미적':'수학',
    '영어1':'영어','영어2':'영어','영회':'영어','영독':'영어',
    '일본어':'외국어','중어B':'외국어','중어C':'외국어','중특A':'외국어','중특B':'외국어',
    '한국사':'사회','경제':'사회','정법':'사회','세지':'사회','한지':'사회','동아시아사':'사회','윤사':'사회','생윤':'사회',
    '지과2':'과학','화학2':'과학','물리2':'과학','생명':'과학','지구':'과학','물리':'과학','화학':'과학',
    '종교':'종교','체육1':'체육','체육2':'체육','스생':'체육','스생1':'체육','운동과건강':'체육',
  };
  const map = {}; // key: "1-1", value: [{teacher, subject, detail}]
  for (const [teacher, sched] of Object.entries(TEACHER_SCHEDULE)) {
    for (const val of Object.values(sched)) {
      const m = String(val).match(/([1-3])(\d{2})\s+(.+)/);
      if (!m) continue;
      const grade = m[1], cn = parseInt(m[2]), rawSubj = m[3].replace(/^[A-Z]_/,'');
      if (cn > 10) continue; // 선택과목 제외
      const classKey = `${grade}-${cn}`;
      const bigSubj = SUBJ_ALIAS[rawSubj] || rawSubj;
      if (!map[classKey]) map[classKey] = [];
      const existing = map[classKey].find(e => e.teacher === teacher && e.bigSubj === bigSubj);
      if (!existing) map[classKey].push({ teacher, bigSubj, detail: rawSubj });
    }
  }
  return map;
}

function renderSubjectClassTab_class() {
  const map = getClassTeacherMap();
  const listEl = qs('#subjectClassList');
  listEl.innerHTML = '';
  const classes = Object.keys(map).sort((a, b) => {
    const [ag, ac] = a.split('-').map(Number), [bg, bc] = b.split('-').map(Number);
    return (ag * 100 + ac) - (bg * 100 + bc);
  });
  classes.forEach(cls => {
    const btn = cel('button', 'side-btn-item subject-selector-button' + (STATE.subjectClassSelected === cls ? ' active' : ''));
    btn.innerHTML = `<span class="subject-selector-icon"><i class="fas fa-school"></i></span><span class="subject-selector-copy"><strong>${cls}반</strong><small>담당 교사 ${map[cls].length}명</small></span><i class="fas fa-chevron-right subject-selector-arrow" aria-hidden="true"></i>`;
    btn.onclick = () => { STATE.subjectClassSelected = cls; renderSubjectClassTab(); };
    listEl.appendChild(btn);
  });
  if (STATE.subjectClassSelected && map[STATE.subjectClassSelected]) {
    renderClassTeacherDetail(STATE.subjectClassSelected, map[STATE.subjectClassSelected]);
  } else {
    const panel = qs('#subjectClassDetail');
    if (panel) panel.innerHTML = `<div class="empty-state subject-empty-state"><div class="empty-icon">🏫</div><h3>학년·반을 선택해주세요</h3><p>선택한 학급의 교과별 담당 교사를 보여드립니다</p></div>`;
  }
}

function renderClassTeacherDetail(classKey, entries) {
  const panel = qs('#subjectClassDetail');
  const subjectOrder = ['국어','수학','영어','외국어','사회','과학','체육','음악','미술','정보','디자인','상업','종교','진로'];
  entries.sort((a, b) => {
    const ai = subjectOrder.indexOf(a.bigSubj), bi = subjectOrder.indexOf(b.bigSubj);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
  let html = `<div class="card-header subject-detail-heading"><i class="fas fa-school"></i><span><strong>${classKey}반 담당 교사</strong><small>총 ${entries.length}명</small></span></div>`;
  html += `<div class="subject-class-teacher-list">`;
  entries.forEach(e => {
    html += `<button class="subject-class-teacher-row" onclick="STATE.teacherScheduleSelected='${e.teacher}';switchTab('teacher');">`;
    html += `<span class="subject-class-badge">${e.bigSubj}</span>`;
    html += `<span class="subject-class-teacher-copy"><strong>${e.teacher} 선생님</strong>${e.detail !== e.bigSubj ? `<small>${e.detail}</small>` : '<small>시간표 보기</small>'}</span>`;
    html += `<i class="fas fa-chevron-right" aria-hidden="true"></i></button>`;
  });
  html += `</div>`;
  panel.innerHTML = html;
}

function buildSubjectClassDetail(subjectName, teachers, compact = false) {
  let html = `<section class="subject-overview-card ${compact ? 'is-compact' : ''}"><div class="card-header subject-detail-heading"><i class="fas fa-book"></i><span><strong>${subjectName} 교과</strong><small>담당 교사 ${teachers.length}명</small></span></div>`;
  html += `<div class="subject-teacher-schedule-grid ${teachers.length === 1 ? 'single' : ''}">`;
  teachers.forEach(teacher => {
    const hasSchedule = teacher !== '백경민' && !!TEACHER_SCHEDULE[teacher];
    html += hasSchedule
      ? buildTeacherDetailCard(teacher, true)
      : `<article class="teacher-compare-card subject-no-schedule"><div class="teacher-detail-header"><div class="teacher-avatar">👤</div><div><strong>${teacher} 선생님</strong><p>등록된 시간표가 없습니다.</p></div></div></article>`;
  });
  html += `</div></section>`;
  return html;
}

function renderSubjectClassDetail(subjectName, teachers) {
  const panel = qs('#subjectClassDetail');
  if (!panel) return;
  panel.innerHTML = buildSubjectClassDetail(subjectName, teachers);
}

// ═══════════════════════════════════════════════
// 학급별 시간표 탭
// ═══════════════════════════════════════════════
function renderClassScheduleTab() {
  renderClassScheduleList();
  const selected = getSelectedScheduleClasses();
  renderClassScheduleDetail(selected.length ? selected : Object.keys(CLASS_SCHEDULE));
}

function getSelectedScheduleClasses() {
  const allClasses = Object.keys(CLASS_SCHEDULE);
  const selected = STATE.classScheduleSelected;
  if (Array.isArray(selected)) return selected.filter(cls => allClasses.includes(cls));
  return selected && allClasses.includes(selected) ? [selected] : [];
}

function renderClassScheduleList() {
  const listEl = qs('#classScheduleList');
  if (!listEl) return;
  const rawSearch = (qs('#classScheduleSearch')?.value || '').trim().toLowerCase();
  const searchTerms = rawSearch ? rawSearch.split(/[,\s]+/).filter(Boolean) : [];
  const allClasses = Object.keys(CLASS_SCHEDULE);
  const classes = allClasses.filter(c => !searchTerms.length || searchTerms.some(term =>
    allClasses.includes(term) ? c === term : c.includes(term)
  ));

  if (!classes.length) {
    listEl.innerHTML = `<div style="padding:14px;text-align:center;color:var(--txt-light);font-size:12px;">검색 결과 없음</div>`;
    STATE.classScheduleSelected = [];
    renderClassScheduleDetail([]);
    return;
  }

  if (searchTerms.length) {
    STATE.classScheduleSelected = classes;
    renderClassScheduleDetail(classes);
  }

  // 학년별로 그룹핑
  const byGrade = {};
  classes.forEach(cls => {
    const g = cls.split('-')[0];
    if (!byGrade[g]) byGrade[g] = [];
    byGrade[g].push(cls);
  });

  let html = '';
  Object.keys(byGrade).sort().forEach(grade => {
    html += `<div class="side-btn-group-label">${grade}학년</div>`;
    byGrade[grade].forEach(cls => {
      const active = getSelectedScheduleClasses().includes(cls) ? 'active' : '';
      const teacher = HOMEROOM_TEACHERS[cls] || '';
      html += `<button class="side-btn-item premium-selector-button class-schedule-button ${active}" onclick="selectClassSchedule('${cls}')">
        <span class="premium-selector-icon"><i class="fas fa-school"></i></span>
        <span class="premium-selector-copy"><strong>${cls}반</strong><small>${teacher ? `담임 ${teacher}` : '주간 시간표 보기'}</small></span>
        <i class="fas fa-chevron-right premium-selector-arrow" aria-hidden="true"></i>
      </button>`;
    });
  });

  listEl.innerHTML = html;
}

function selectClassSchedule(cls) {
  STATE.classScheduleSelected = [cls];
  renderClassScheduleList();
  renderClassScheduleDetail([cls]);
}

function buildClassScheduleCard(cls, compact = false) {
  const sched = CLASS_SCHEDULE[cls];
  const teacher = HOMEROOM_TEACHERS[cls] || '미지정';
  if (!sched) {
    return `<article class="class-compare-card"><div class="empty-state"><div class="empty-icon">⚠️</div><h3>${cls} 시간표 데이터가 없습니다</h3></div></article>`;
  }

  // 학년 파악
  const grade = parseInt(cls.split('-')[0]);
  const isGrade3 = grade === 3;

  let html = `<article class="class-compare-card ${compact ? 'is-compact' : ''}"><div class="card-header class-detail-header">
    <span class="class-detail-icon"><i class="fas fa-school"></i></span>
    <span class="class-detail-copy"><small>CLASS TIMETABLE</small><strong>${cls}반 주간 시간표</strong><em>담임 ${teacher} 선생님</em></span>
  </div>
  <div class="premium-schedule-scroll class-schedule-scroll">
    <table class="schedule-table class-premium-table" style="min-width:${compact ? '440px' : '650px'};">
      <thead>
        <tr>
          <th style="min-width:60px;">교시</th>
          ${DAYS.map(d=>`<th style="min-width:110px;">${d}요일</th>`).join('')}
        </tr>
      </thead>
      <tbody>`;

  PERIODS.forEach(p => {
    // 점심 행 삽입
    if (isGrade3 && p === 4) {
      html += `<tr class="premium-lunch-row">
        <td class="premium-lunch-label">점심</td>
        <td colspan="5" class="premium-lunch-cell">11:30 ~ 13:40 (점심시간)</td>
      </tr>`;
    } else if (!isGrade3 && p === 5) {
      html += `<tr class="premium-lunch-row">
        <td class="premium-lunch-label">점심</td>
        <td colspan="5" class="premium-lunch-cell">12:30 ~ 13:40 (점심시간)</td>
      </tr>`;
    }

    html += `<tr>
      <td class="premium-period-cell"><strong>${p}교시</strong><span>${getPeriodTime(p, grade)}</span></td>`;

    DAYS.forEach(d => {
      const key = d + p;
      const val = sched[key] || '';
      let cellStyle = 'padding:8px;text-align:center;font-size:12px;';
      let content = '';

      if (val === '창체') {
        cellStyle += 'background:var(--cell-chatech-bg);color:var(--cell-chatech-tx);font-weight:600;';
        content = `<button class="class-lesson-button" onclick="openClassLessonMatching('${cls}','${d}',${p})">🌸 창체</button>`;
      } else if (val) {
        // "교과 교사명" 형식 파싱
        const parts = val.split(' ');
        const roomNames = new Set(['전상실','컴그실','만콘실','영상실','창구실','사행실','회계실']);
        const room = roomNames.has(parts[parts.length - 1]) ? parts.pop() : '';
        const tname = parts.pop() || '';
        const subj = parts.join(' ') || '';
        const movementRoom = getTimeGroupRoomForClass(cls, val);
        const displayedRoom = movementRoom || room;
        content = `<button class="class-lesson-button ${movementRoom ? 'is-moving-room' : ''}" onclick="openClassLessonMatching('${cls}','${d}',${p})">
          <span class="class-lesson-subject">${subj}</span>
          <span class="class-lesson-meta">${tname}${displayedRoom ? ' · ' + getLabDisplayName(displayedRoom) : ''}</span>
          ${movementRoom ? '<span class="class-movement-badge"><i class="fas fa-person-walking-arrow-right"></i> 이동수업 · 교실 비움</span>' : ''}
        </button>`;
      } else {
        cellStyle += 'color:var(--txt-muted);';
        content = '-';
      }
      html += `<td class="class-schedule-cell" style="${cellStyle}">${content}</td>`;
    });
    html += `</tr>`;
  });

  html += `</tbody></table></div></article>`;
  return html;
}

function renderClassScheduleDetail(classes) {
  const panel = qs('#classScheduleDetail');
  if (!panel) return;
  const selected = (Array.isArray(classes) ? classes : [classes]).filter(cls => CLASS_SCHEDULE[cls]);
  if (!selected.length) {
    panel.innerHTML = `<div class="empty-state"><div class="empty-icon">🏫</div><h3>왼쪽에서 학급을 선택해주세요</h3><p>쉼표나 공백으로 여러 학급을 검색하면 시간표를 나란히 비교할 수 있습니다</p></div>`;
    return;
  }
  const compact = selected.length > 1;
  panel.innerHTML = `<div class="class-compare-summary"><i class="fas fa-columns"></i> ${selected.length}개 학급 시간표 비교 · 수업 칸을 누르면 교체·대체 검색</div><div class="class-compare-grid ${selected.length === 1 ? 'single' : ''}">${selected.map(cls => buildClassScheduleCard(cls, compact)).join('')}</div>`;
}

function findTeachersForClassLesson(cls, day, period) {
  const slot = day + period;
  const classValue = (CLASS_SCHEDULE[cls] || {})[slot] || '';
  if (classValue === '창체') return HOMEROOM_TEACHERS[cls] ? [HOMEROOM_TEACHERS[cls]] : [];

  const roomNames = new Set(['전상실','컴그실','만콘실','영상실','창구실','사행실','회계실']);
  const tokens = String(classValue).split(/\s+/).filter(Boolean);
  if (roomNames.has(tokens[tokens.length - 1])) tokens.pop();
  const namedTeacher = tokens[tokens.length - 1];
  if (ALL_TEACHERS.includes(namedTeacher)) return [namedTeacher];

  return ALL_TEACHERS.filter(teacher => {
    const value = (TEACHER_SCHEDULE[teacher] || {})[slot];
    if (value) {
      const info = parseCellValue(value, teacher, slot);
      if (`${info.grade}-${info.classNum}` === cls) return true;
    }
    return getExternalLessonValues(teacher, day, period).some(item => {
      const info = parseCellValue(item, teacher, slot, true);
      return `${info.grade}-${info.classNum}` === cls;
    });
  });
}

function openClassLessonMatching(cls, day, period) {
  const teachers = findTeachersForClassLesson(cls, day, period);
  if (!teachers.length) {
    showAlert(`${cls}반 ${day}요일 ${period}교시의 담당 교사를 찾지 못했습니다.`);
    return;
  }
  const teacher = teachers[0];
  const value = (TEACHER_SCHEDULE[teacher] || {})[day + period];
  if (value) {
    onCellClick(teacher, day, period);
    return;
  }
  const externalValues = getExternalLessonValues(teacher, day, period);
  const externalIndex = externalValues.findIndex(item => {
    const info = parseCellValue(item, teacher, day + period, true);
    return `${info.grade}-${info.classNum}` === cls;
  });
  if (externalIndex >= 0) onExternalCellClick(teacher, day, period, externalIndex);
  else openLessonMatching(teacher, day, period, '', false);
}

// ═══════════════════════════════════════════════
// 학생 명렬표 탭 (비밀번호 보호)
// ═══════════════════════════════════════════════
// ── 학급 분류 헬퍼 ──
function getClassCategory(cls) {
  const [grade, num] = cls.split('-').map(Number);
  if (grade === 1) {
    if (num <= 6) return { label:'보통과', badge:'badge-sky' };
    else          return { label:'특성화', badge:'badge-orange' };
  } else if (grade === 2) {
    if (num <= 6) return { label:'보통과', badge:'badge-sky' };
    else          return { label:'특성화', badge:'badge-orange' };
  } else if (grade === 3) {
    if (num <= 4) return { label:'보통과', badge:'badge-sky' };
    else          return { label:'특성화', badge:'badge-orange' };
  }
  return { label:'', badge:'badge-gray' };
}

function renderRosterTab() {
  // 학급 선택 셀렉트 채우기
  const sel = qs('#rosterClassSelect');
  if (sel && sel.options.length <= 1) {
    // 학년별 그룹 optgroup
    const grades = { '1학년': [], '2학년': [], '3학년': [] };
    Object.keys(STUDENT_ROSTER).forEach(cls => {
      const g = parseInt(cls.split('-')[0]);
      if (g === 1) grades['1학년'].push(cls);
      else if (g === 2) grades['2학년'].push(cls);
      else grades['3학년'].push(cls);
    });
    Object.entries(grades).forEach(([label, classes]) => {
      const og = document.createElement('optgroup');
      og.label = label;
      classes.forEach(cls => {
        const cat = getClassCategory(cls);
        const opt = document.createElement('option');
        opt.value = cls;
        opt.textContent = `${cls}반 (${cat.label})`;
        og.appendChild(opt);
      });
      sel.appendChild(og);
    });
  }
  // 잠금 상태 표시
  if (STATE.rosterUnlocked) {
    showRosterContent(STATE.rosterUnlockedClass);
  } else {
    const lock = qs('#rosterLockScreen');
    const content = qs('#rosterContent');
    if (lock) lock.style.display = 'flex';
    if (content) content.style.display = 'none';
  }
}

function rosterClassChanged() {
  const hint = qs('#rosterHint');
  if (hint) hint.textContent = '';
  const pw = qs('#rosterPassword');
  if (pw) pw.value = '';
}

function verifyRosterPassword() {
  const cls = qs('#rosterClassSelect')?.value;
  const pw  = (qs('#rosterPassword')?.value || '').trim();
  const hint = qs('#rosterHint');

  if (!cls) {
    if (hint) { hint.textContent = '학급을 먼저 선택해주세요.'; hint.style.color='#c0392b'; }
    return;
  }
  if (pw.length !== 4) {
    if (hint) { hint.textContent = '4자리 숫자를 입력해주세요.'; hint.style.color='#c0392b'; }
    return;
  }

  // 해당 반 담임 선생님의 전화번호 뒷 4자리 확인
  const teacherName = HOMEROOM_TEACHERS[cls];
  const teacherContact = STAFF_CONTACTS.find(c => c.name === teacherName && c.phone && c.phone !== '-');

  let matched = false;
  if (teacherContact) {
    const digits = teacherContact.phone.replace(/-/g,'');
    matched = digits.slice(-4) === pw;
  }
  // 모든 선생님 중 일치하는 번호 → 해당 선생님으로 로그인
  if (!matched) {
    const matchedContact = STAFF_CONTACTS.find(c => {
      if (!c.phone || c.phone === '-') return false;
      const digits = c.phone.replace(/-/g,'');
      return digits.slice(-4) === pw;
    });
    if (matchedContact) {
      matched = true;
      callTeacherName = matchedContact.name;
    }
  }

  if (matched) {
    if (!callTeacherName) {
      // 담임 비밀번호로 들어온 경우 담임 이름 설정
      callTeacherName = teacherName || '';
    }
    STATE.rosterUnlocked = true;
    STATE.rosterUnlockedClass = cls;
    if (qs('#rosterPassword')) qs('#rosterPassword').value = '';
    if (hint) hint.textContent = '';
    showRosterContent(cls);
  } else {
    if (hint) { hint.textContent = '비밀번호가 올바르지 않습니다.'; hint.style.color='#c0392b'; }
  }
}

function showRosterContent(cls) {
  const lock = qs('#rosterLockScreen');
  const content = qs('#rosterContent');
  if (lock) lock.style.display = 'none';
  if (content) content.style.display = 'block';

  // 반 선택 스위치 채우기
  const sw = qs('#rosterClassSwitch');
  if (sw) {
    const grades = { '1학년': [], '2학년': [], '3학년': [] };
    Object.keys(STUDENT_ROSTER).forEach(c => {
      const g = parseInt(c.split('-')[0]);
      if (g === 1) grades['1학년'].push(c);
      else if (g === 2) grades['2학년'].push(c);
      else grades['3학년'].push(c);
    });
    sw.innerHTML = '';
    Object.entries(grades).forEach(([label, classes]) => {
      const og = document.createElement('optgroup');
      og.label = label;
      classes.forEach(c => {
        const cat = getClassCategory(c);
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = `${c}반 (${cat.label})`;
        if (c === cls) opt.selected = true;
        og.appendChild(opt);
      });
      sw.appendChild(og);
    });
  }

  // 타이틀
  const cat = getClassCategory(cls);
  const title = qs('#rosterClassTitle');
  if (title) title.innerHTML = `${cls}반${callTeacherName ? ` <span style="font-size:12px;font-weight:600;color:var(--sky-deep);margin-left:8px;"><i class="fas fa-user"></i> ${callTeacherName} 선생님</span>` : ''}`;

  renderRosterBody(cls);
}

function switchRosterClass(cls) {
  STATE.rosterUnlockedClass = cls;
  const cat = getClassCategory(cls);
  const title = qs('#rosterClassTitle');
  if (title) title.innerHTML = `${cls}반 <span class="badge ${cat.badge}" style="margin-left:6px;">${cat.label}</span>`;
  renderRosterBody(cls);
}

function renderRosterBody(cls) {
  const el = qs('#rosterBody');
  if (!el) return;
  const data = STUDENT_ROSTER[cls];
  if (!data) { el.innerHTML = `<div class="empty-state"><p>명렬 데이터 없음</p></div>`; return; }
  const { teacher, students } = data;

  let html = `
    <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap;align-items:center;">
      <div class="roster-info-chip"><i class="fas fa-chalkboard-teacher"></i> 담임: <strong>${teacher}</strong> 선생님</div>
      <div class="roster-info-chip"><i class="fas fa-users"></i> 총 <strong>${students.length}</strong>명</div>
      <div style="margin-left:auto;display:flex;gap:6px;">
        <button class="btn btn-outline btn-sm" onclick="printRoster('${cls}')"><i class="fas fa-print"></i> 인쇄</button>
        <button class="btn btn-outline btn-sm" onclick="downloadRosterCSV('${cls}')"><i class="fas fa-file-excel"></i> 엑셀</button>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:5px;">
  `;
  students.forEach(s => {
    html += `<button class="call-student-btn" onclick="openCallPanel('${cls}',${s.no},'${s.name.replace(/'/g,"\'")}')">
      <span class="call-student-no">${s.no}</span>
      <span class="call-student-name">${s.name}</span>
    </button>`;
  });
  html += `</div>`;

  // 호출 패널 (이름 클릭 시 여기에 표시)
  html += `<div id="inlineCallPanel" style="display:none;margin-top:14px;padding:16px;background:var(--sky-pale);border:2px solid var(--sky-mid);border-radius:var(--r-md);">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
      <div>
        <span style="font-size:12px;font-weight:700;color:var(--sky-deep);"><i class="fas fa-bullhorn"></i> 호출 대상</span>
        <div id="inlineCallName" style="font-size:18px;font-weight:900;color:var(--brown);margin-top:4px;"></div>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="qs('#inlineCallPanel').style.display='none'">✕ 닫기</button>
    </div>
    <div style="font-size:11px;font-weight:700;color:var(--txt-mid);margin-bottom:6px;">빠른 메시지</div>
    <div id="inlineQuickMsgs" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;"></div>
    <div style="display:flex;gap:8px;">
      <input type="text" class="search-input" id="inlineCallMsg" placeholder="직접 입력..." maxlength="50" style="flex:1;padding:10px 14px;border:2px solid var(--border);border-radius:var(--r-full);font-size:13px;" onkeydown="if(event.key==='Enter')sendInlineCall()">
      <button class="btn btn-primary" onclick="sendInlineCall()"><i class="fas fa-paper-plane"></i> 전송</button>
    </div>
  </div>`;

  // 연결 상태
  html += renderConnectionStatus(cls);

  // 전송 로그
  html += `<div id="rosterCallLog" style="margin-top:10px;max-height:150px;overflow-y:auto;"></div>`;

  el.innerHTML = html;
}

function openCallPanel(cls, no, name) {
  callSelectedClass = cls;
  callSelectedStudent = { no, name };

  // 버튼 selected 상태
  qsa('#rosterBody .call-student-btn').forEach(b => b.classList.remove('selected'));
  event.currentTarget.classList.add('selected');

  const panel = qs('#inlineCallPanel');
  if (panel) panel.style.display = 'block';

  const nameEl = qs('#inlineCallName');
  if (nameEl) nameEl.textContent = `${no}번 ${name} 학생`;

  const msgEl = qs('#inlineQuickMsgs');
  if (msgEl) {
    msgEl.innerHTML = QUICK_MESSAGES.map(msg =>
      `<button class="call-quick-btn" onclick="qs('#inlineCallMsg').value='${msg.replace(/'/g,"\'")}';">${msg}</button>`
    ).join('');
  }
  const input = qs('#inlineCallMsg');
  if (input) { input.value = ''; input.focus(); }
}

function sendInlineCall() {
  if (!callSelectedStudent) return;
  const input = qs('#inlineCallMsg');
  const msg = (input?.value || '').trim();
  if (!msg) { showAlert('메시지를 입력해주세요.'); return; }

  const payload = {
    type: 'call',
    className: callSelectedClass,
    studentNo: callSelectedStudent.no,
    studentName: callSelectedStudent.name,
    message: msg,
    callerTeacher: callTeacherName || '',
    timestamp: Date.now()
  };

  const ch = new BroadcastChannel('student-call-' + callSelectedClass);
  ch.postMessage(payload);
  ch.close();

  // Firebase에도 호출 데이터 기록
  if (firebaseDB) {
    firebaseDB.ref('calls/' + callSelectedClass).set(payload);
  }

  // 로그
  const logEl = qs('#rosterCallLog');
  if (logEl) {
    const now = new Date();
    const t = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    logEl.insertAdjacentHTML('afterbegin', `
      <div style="display:flex;align-items:center;gap:8px;padding:7px 12px;margin-bottom:3px;background:var(--green-pale);border:1px solid var(--green);border-radius:var(--r-md);font-size:12px;">
        <i class="fas fa-check-circle" style="color:var(--green);"></i>
        <span style="color:var(--txt-light);">${t}</span>
        <strong style="color:var(--brown);">${callSelectedStudent.name}</strong>
        <span style="color:var(--txt-mid);">${msg}</span>
      </div>`);
  }
  if (input) input.value = '';
  showAlert(`${callSelectedStudent.name} 학생에게 호출 메시지를 전송했습니다.`);
}

// 인쇄
function printRoster(cls) {
  const data = STUDENT_ROSTER[cls];
  if (!data) return;
  const teacher = data.teacher;
  const students = data.students;
  const cols = 5;
  const rows = Math.ceil(students.length / cols);

  let html = `<html><head><meta charset="UTF-8"><title>${cls}반 명렬표</title>
  <style>body{font-family:'Noto Sans KR',sans-serif;padding:20px}
  h2{text-align:center;margin-bottom:4px}
  .sub{text-align:center;font-size:13px;color:#777;margin-bottom:16px}
  table{width:100%;border-collapse:collapse}
  th,td{border:1px solid #ccc;padding:6px 10px;font-size:13px;text-align:center}
  th{background:#f0f0f0;font-weight:700}
  .no{color:#999;width:30px}
  @media print{body{padding:10px}}</style></head><body>
  <h2>${cls}반 학생 명렬표</h2>
  <div class="sub">담임: ${teacher} 선생님 | ${students.length}명</div>
  <table><thead><tr>`;
  for (let c = 0; c < cols; c++) html += `<th class="no">번호</th><th>이름</th>`;
  html += `</tr></thead><tbody>`;
  for (let r = 0; r < rows; r++) {
    html += '<tr>';
    for (let c = 0; c < cols; c++) {
      const idx = c * rows + r;
      const s = students[idx];
      if (s) html += `<td class="no">${s.no}</td><td>${s.name}</td>`;
      else html += '<td></td><td></td>';
    }
    html += '</tr>';
  }
  html += '</tbody></table></body></html>';

  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
  w.onload = () => { w.print(); };
}

// 엑셀(CSV) 다운로드
function downloadRosterCSV(cls) {
  const data = STUDENT_ROSTER[cls];
  if (!data) return;
  let csv = '\uFEFF번호,이름\n';
  data.students.forEach(s => { csv += `${s.no},${s.name}\n`; });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${cls}반_명렬표.csv`;
  a.click();
  URL.revokeObjectURL(url);
}


function lockRoster() {
  STATE.rosterUnlocked = false;
  STATE.rosterUnlockedClass = null;
  const lock = qs('#rosterLockScreen');
  const content = qs('#rosterContent');
  if (lock) lock.style.display = 'flex';
  if (content) content.style.display = 'none';
  if (qs('#rosterPassword')) qs('#rosterPassword').value = '';
}

// ═══════════════════════════════════════════════
// 교체 불가 설정 탭
// ═══════════════════════════════════════════════
function renderBlockTab() {
  const listEl = qs('#blockTeacherList');
  if (!listEl) return;
  const rawSearch = (qs('#blockSearch')?.value || '').trim();
  const searchTerms = rawSearch ? rawSearch.split(/[,\s]+/).map(s => s.trim().toLowerCase()).filter(Boolean) : [];

  const filtered = ALL_TEACHERS.filter(t => !searchTerms.length || searchTerms.some(s => t.toLowerCase().includes(s)));
  if (!filtered.length) {
    listEl.innerHTML = `<div style="padding:14px;text-align:center;color:var(--txt-light);font-size:12px;">검색 결과 없음</div>`;
  } else {
    listEl.innerHTML = filtered.map(t => {
      const active = STATE.blockSelectedTeacher === t ? 'active' : '';
      const hasBlock = !!STATE.blockSettings[t];
      return `<button class="side-btn-item ${active}" onclick="selectBlockTeacher('${t}')">
        <span>${t}</span>
        ${hasBlock ? `<span class="side-btn-sub block-set-badge">⛔ 설정됨</span>` : ''}
      </button>`;
    }).join('');
  }

  renderBlockSettingArea();
  renderBlockList();
}

function selectBlockTeacher(teacher) {
  STATE.blockSelectedTeacher = teacher;
  STATE.blockTempDays = {};
  renderBlockTab();
}

function renderBlockSettingArea() {
  const area = qs('#blockSettingArea');
  if (!area) return;
  if (!STATE.blockSelectedTeacher) {
    area.innerHTML = `<div class="empty-state"><div class="empty-icon">👈</div><h3>왼쪽에서 교사를 선택해주세요</h3></div>`;
    return;
  }

  const t = STATE.blockSelectedTeacher;
  const allOn = DAYS.every(d => STATE.blockTempDays[d] && STATE.blockTempDays[d].length > 0);

  let html = `<div style="font-size:14px;font-weight:800;color:#c0392b;margin-bottom:14px;"><i class="fas fa-user-slash"></i> ${t} 선생님</div>`;
  html += `<div style="font-size:12px;font-weight:700;color:var(--txt-mid);margin-bottom:8px;">📅 교체 불가 요일</div>`;
  html += `<div class="day-chip-group">`;
  html += `<div class="day-chip ${allOn ? 'blocked' : ''}" onclick="toggleBlockAllDays()">전체</div>`;
  DAYS.forEach(d => {
    const on = STATE.blockTempDays[d] && STATE.blockTempDays[d].length > 0;
    html += `<div class="day-chip ${on ? 'blocked' : ''}" onclick="toggleBlockDay('${d}')">${d}요일</div>`;
  });
  html += `</div>`;

  const shownDays = DAYS.filter(d => STATE.blockTempDays[d]);
  shownDays.forEach(d => {
    html += `<div style="margin-bottom:14px;">
      <div style="font-size:12px;font-weight:700;color:var(--txt-mid);margin-bottom:7px;">🕐 ${d}요일 교시 설정</div>
      <div class="period-check-grid">`;
    PERIODS.forEach(p => {
      const checked = STATE.blockTempDays[d]?.includes(p);
      html += `<label class="period-label ${checked ? 'checked' : ''}">
        <input type="checkbox" ${checked ? 'checked' : ''} onchange="toggleBlockPeriod('${d}',${p},this)">
        ${p}교시
      </label>`;
    });
    html += `</div></div>`;
  });

  const hasAny = Object.values(STATE.blockTempDays).some(arr => arr.length > 0);
  html += `<button class="btn btn-danger btn-full" ${hasAny ? '' : 'disabled'} onclick="addBlockEntry()">
    <i class="fas fa-plus-circle"></i> 교체 불가 추가
  </button>`;
  area.innerHTML = html;
}

function toggleBlockAllDays() {
  const allOn = DAYS.every(d => STATE.blockTempDays[d] && STATE.blockTempDays[d].length > 0);
  if (allOn) { STATE.blockTempDays = {}; }
  else { DAYS.forEach(d => { STATE.blockTempDays[d] = [...PERIODS]; }); }
  renderBlockSettingArea();
}
function toggleBlockDay(day) {
  if (STATE.blockTempDays[day]) delete STATE.blockTempDays[day];
  else STATE.blockTempDays[day] = [...PERIODS];
  renderBlockSettingArea();
}
function toggleBlockPeriod(day, period, cb) {
  if (!STATE.blockTempDays[day]) STATE.blockTempDays[day] = [];
  if (cb.checked) { if (!STATE.blockTempDays[day].includes(period)) STATE.blockTempDays[day].push(period); }
  else { STATE.blockTempDays[day] = STATE.blockTempDays[day].filter(p => p !== period); }
  renderBlockSettingArea();
}
function addBlockEntry() {
  const t = STATE.blockSelectedTeacher;
  if (!t) return;
  const toAdd = {};
  Object.keys(STATE.blockTempDays).forEach(d => {
    if (STATE.blockTempDays[d].length > 0) toAdd[d] = [...STATE.blockTempDays[d]].sort((a,b)=>a-b);
  });
  if (!Object.keys(toAdd).length) return;
  STATE.blockSettings[t] = toAdd;
  STATE.blockTempDays = {};
  renderBlockTab();
  saveBlockSettings();
}
function deleteBlockEntry(teacher) {
  delete STATE.blockSettings[teacher];
  renderBlockList();
  saveBlockSettings();
}
function renderBlockList() {
  const el = qs('#blockList');
  if (!el) return;
  const entries = Object.entries(STATE.blockSettings);
  const cnt = qs('#blockCount');
  if (cnt) cnt.textContent = entries.length ? `(${entries.length}명)` : '';

  if (!entries.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">✅</div><h3>등록된 항목 없음</h3><p>설정하면 자동으로 제외됩니다</p></div>`;
    return;
  }
  el.innerHTML = entries.map(([teacher, dayMap]) => {
    const tags = Object.entries(dayMap).map(([day, periods]) => {
      const label = periods.length === PERIODS.length ? `${day}요일 전일` : `${day} ${periods.join('·')}교시`;
      return `<span class="block-time-tag">${label}</span>`;
    }).join('');
    return `<div style="display:flex;align-items:flex-start;gap:10px;padding:12px;border:1px solid #fde8ed;border-radius:var(--r-md);margin-bottom:8px;background:white;">
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:700;color:#c0392b;margin-bottom:6px;"><i class="fas fa-user-slash"></i> ${teacher} 선생님</div>
        <div>${tags}</div>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="deleteBlockEntry('${teacher}')"><i class="fas fa-times"></i></button>
    </div>`;
  }).join('');
}

function saveBlockSettings() {
  try { localStorage.setItem('blockSettings', JSON.stringify(STATE.blockSettings)); } catch(e) {}
}
function loadBlockSettings() {
  try {
    const s = localStorage.getItem('blockSettings');
    if (s) STATE.blockSettings = JSON.parse(s);
  } catch(e) {}
}

// ═══════════════════════════════════════════════
// 금일 일정 요약 탭
// ═══════════════════════════════════════════════
function renderUtilTab() {
  renderTodayStatus();
  renderHomeroomList();
  renderSubjectGroups();
}

function saveMemo() {
  const memo = qs('#memoArea');
  const value = memo?.value || '';
  try { localStorage.setItem('memo', value); } catch(e) {}
  if (memo) memo.dataset.dirty = 'false';
  if (firebaseDB) {
    firebaseDB.ref('shared/memo').set({ text:value, updatedAt:firebase.database.ServerValue.TIMESTAMP })
      .then(() => showAlert('공유 메모가 저장되었습니다! 💾'))
      .catch(() => showAlert('서버 저장에 실패해 이 브라우저에만 저장했습니다.'));
  } else {
    showAlert('메모가 이 브라우저에 저장되었습니다.');
  }
}

function deleteSharedMemo() {
  const memo = qs('#memoArea');
  if (!confirm('공유 메모를 삭제하시겠습니까?')) return;
  if (memo) { memo.value = ''; memo.dataset.dirty = 'false'; }
  try { localStorage.removeItem('memo'); } catch(e) {}
  if (firebaseDB) firebaseDB.ref('shared/memo').remove();
}

function startSharedMemoListener() {
  const memo = qs('#memoArea');
  if (!firebaseDB || !memo || memo.dataset.sharedListener === 'true') return;
  memo.dataset.sharedListener = 'true';
  memo.addEventListener('input', () => { memo.dataset.dirty = 'true'; });
  const ref = firebaseDB.ref('shared/memo');
  ref.once('value').then(snap => {
    const localMemo = localStorage.getItem('memo') || '';
    if (!snap.exists() && localMemo) {
      return ref.set({ text:localMemo, updatedAt:firebase.database.ServerValue.TIMESTAMP });
    }
  }).finally(() => {
    ref.on('value', snap => {
      const remote = snap.val();
      const text = typeof remote === 'string' ? remote : (remote?.text || '');
      if (memo.dataset.dirty !== 'true') memo.value = text;
      try { localStorage.setItem('memo', text); } catch(e) {}
    });
  });
}

function renderTodayStatus() {
  const el = qs('#todayStatus');
  if (!el) return;
  const now = new Date();
  const dayIdx = now.getDay();
  const dayNames = ['일','월','화','수','목','금','토'];
  const dayKor = dayNames[dayIdx];

  if (!DAYS.includes(dayKor)) {
    el.innerHTML = `<p style="color:var(--txt-light);padding:14px;font-size:13px;">오늘(${dayKor}요일)은 수업일이 아닙니다.</p>`;
    return;
  }

  let html = `<div style="font-size:12px;font-weight:700;color:var(--txt-mid);margin-bottom:10px;">📌 오늘 (${dayKor}요일) 교시별 현황</div>`;
  PERIODS.forEach(p => {
    const teaching = ALL_TEACHERS.filter(t => {
      const val = (TEACHER_SCHEDULE[t]||{})[dayKor + p];
      return !!val || isChatcheTime(t, dayKor, p);
    }).length;
    const free = ALL_TEACHERS.length - teaching;
    html += `<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border-lt);">
      <div style="min-width:50px;font-weight:700;font-size:11.5px;color:var(--primary);">${p}교시</div>
      <div style="font-size:11.5px;color:var(--txt-mid);">수업 ${teaching}명</div>
      <div style="font-size:11.5px;color:var(--cell-free-tx);margin-left:auto;">공강 ${free}명</div>
    </div>`;
  });
  el.innerHTML = html;
}

function renderTodayCalendar() {
  const el = qs('#todayCalendar');
  if (!el) return;
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const todayEvents = ACADEMIC_CALENDAR.filter(e => e.date === todayStr);
  // 이번 달 남은 일정 (오늘 이후 5개)
  const upcoming = ACADEMIC_CALENDAR.filter(e => e.date > todayStr).slice(0, 5);

  let html = '';
  if (todayEvents.length) {
    html += `<div style="margin-bottom:10px;">
      <div style="font-size:11px;font-weight:700;color:var(--txt-mid);margin-bottom:6px;">📌 오늘 일정</div>`;
    todayEvents.forEach(e => {
      const badgeCls = getEventBadgeClass(e.type);
      html += `<div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid var(--border-lt);">
        <span class="badge ${badgeCls}" style="font-size:10px;">${getEventTypeName(e.type)}</span>
        <span style="font-size:12px;font-weight:600;color:var(--txt-dark);">${e.event}</span>
      </div>`;
    });
    html += `</div>`;
  } else {
    html += `<div style="font-size:12px;color:var(--txt-light);padding:8px 0;margin-bottom:8px;">오늘 특별 일정 없음 ✨</div>`;
  }

  if (upcoming.length) {
    html += `<div><div style="font-size:11px;font-weight:700;color:var(--txt-mid);margin-bottom:6px;">📅 다가오는 일정</div>`;
    upcoming.forEach(e => {
      const badgeCls = getEventBadgeClass(e.type);
      const d = new Date(e.date);
      const diff = Math.ceil((d - now) / 86400000);
      html += `<div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid var(--border-lt);">
        <span style="font-size:10.5px;color:var(--txt-light);min-width:60px;">${e.date.slice(5).replace('-','/')} (${e.day})</span>
        <span class="badge ${badgeCls}" style="font-size:10px;flex-shrink:0;">${getEventTypeName(e.type)}</span>
        <span style="font-size:11.5px;color:var(--txt-dark);flex:1;">${e.event}</span>
        <span style="font-size:10px;color:var(--txt-light);">D-${diff}</span>
      </div>`;
    });
    html += `</div>`;
  }
  el.innerHTML = html || `<div class="empty-state"><p>등록된 일정 없음</p></div>`;
}

function renderHomeroomList() {
  const el = qs('#homeroomListBody');
  if (!el) return;
  const entries = Object.entries(HOMEROOM_TEACHERS);
  el.innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:12px;">
    ${entries.map(([cls,name]) => `
      <div style="padding:4px 6px;background:var(--bg-soft);border-radius:4px;display:flex;justify-content:space-between;align-items:center;">
        <span style="color:var(--txt-mid);font-weight:700;">${cls}</span>
        <span style="color:var(--txt-dark);">${name}</span>
      </div>`).join('')}
  </div>`;
}

function renderSubjectGroups() {
  const el = qs('#subjectGroupBody');
  if (!el) return;
  const groups = [
    { subj:"국어",   cls:"badge-blue",   teachers:["황혜인","강승표","김연아","김보민","오재원","홍원정"] },
    { subj:"수학",   cls:"badge-purple",  teachers:["공은표","강혜민","김한주","오소영","오재영","고지수"] },
    { subj:"영어",   cls:"badge-green",   teachers:["조설아","김희경","김민지","김도연","김지선","송진호"] },
    { subj:"사회",   cls:"badge-orange",  teachers:["강창규","안미진","양찬호","김민권","양정원","현은심","이상희","김대현","강부열","김민정"] },
    { subj:"과학",   cls:"badge-blue",    teachers:["박종찬","오승철","현창식","장진혁","김현정"] },
    { subj:"체육",   cls:"badge-green",   teachers:["고세권","김재현","김형우","김지윤"] },
    { subj:"정보",   cls:"badge-purple",  teachers:["김영주","문원호","임수진","박정민","오소연","김태환","고대홍","백은정","이상분","송주연","임홍재","김영조"] },
    { subj:"상업",   cls:"badge-orange",  teachers:["백은정","김지연","송주연","임홍재","김영조","강향아","김태환","김유리"] },
    { subj:"미술",   cls:"badge-red",     teachers:["고지은","김윤주","김제령","백경민"] },
    { subj:"디자인", cls:"badge-blue",    teachers:["김윤주","김제령","박정민","문원호","임수진","오소연","이상분"] },
    { subj:"음악",   cls:"badge-green",   teachers:["강진석"] },
    { subj:"일본어", cls:"badge-orange",  teachers:["김수정"] },
    { subj:"종교",   cls:"badge-gray",    teachers:["이순규"] },
  ];
  el.innerHTML = groups.map(g => `
    <div style="margin-bottom:10px;">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;">
        <span class="badge ${g.cls}">${g.subj}</span>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:3px;">
        ${g.teachers.map(t=>`<span style="font-size:11px;background:var(--bg-soft);padding:2px 8px;border-radius:var(--r-full);color:var(--txt-dark);">${t}</span>`).join('')}
      </div>
    </div>`).join('');
}

// ── 필터칩 토글 ──
function toggleFilterChip(el) {
  el.classList.toggle('checked');
  if (STATE.meetingSelectedTeachers.size >= 2) findMeetingTime();
}



// ═══════════════════════════════════════════════
// 교실 연결 상태 모니터링 (하트비트) - Android/Windows 분리
// ═══════════════════════════════════════════════
const connectedClasses = {};  // { "1-1": { android: timestamp, windows: timestamp } }

// Firebase 하트비트 수신
function startHeartbeatListener() {
  if (!firebaseDB) return;
  firebaseDB.ref('heartbeat').on('value', (snap) => {
    const data = snap.val() || {};
    Object.keys(data).forEach(cls => {
      const entry = data[cls];
      if (!connectedClasses[cls]) connectedClasses[cls] = {};
      // 새 형식: heartbeat/CLS/android, heartbeat/CLS/windows
      if (entry.android && entry.android.ts) connectedClasses[cls].android = entry.android.ts;
      if (entry.windows && entry.windows.ts) connectedClasses[cls].windows = entry.windows.ts;
      // 하위 호환: 이전 형식 (heartbeat/CLS = {ts:...}) → windows로 간주
      if (entry.ts && typeof entry.ts === 'number') {
        connectedClasses[cls].windows = entry.ts;
      }
    });
  });
}

// BroadcastChannel fallback (같은 PC 테스트용)
try {
  const heartbeatChannel = new BroadcastChannel('heartbeat');
  heartbeatChannel.onmessage = (e) => {
    if (e.data && e.data.type === 'alive' && e.data.cls) {
      if (!connectedClasses[e.data.cls]) connectedClasses[e.data.cls] = {};
      connectedClasses[e.data.cls].windows = Date.now();
    }
  };
} catch(e) {}

function isClassConnected(cls) {
  const entry = connectedClasses[cls];
  if (!entry) return false;
  const now = Date.now();
  return (entry.android && now - entry.android < 120000) || (entry.windows && now - entry.windows < 120000);
}

function getClassConnectionDetail(cls) {
  const entry = connectedClasses[cls] || {};
  const now = Date.now();
  const android = entry.android && (now - entry.android < 120000);
  const windows = entry.windows && (now - entry.windows < 120000);
  return { android: !!android, windows: !!windows, any: !!android || !!windows };
}

function renderConnectionStatus(cls) {
  const d = getClassConnectionDetail(cls);
  const ac = d.android ? '#3da86a' : '#e05050';
  const wc = d.windows ? '#3da86a' : '#e05050';
  const bg = d.any ? '#e8f8ee' : '#fff0f0';
  const bd = d.any ? '#3da86a' : '#e05050';
  return `<div id="classConnectionStatus" style="margin-top:14px;padding:10px 14px;background:${bg};border:1.5px solid ${bd};border-radius:var(--r-md);display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:12px;">
    <span style="display:inline-flex;align-items:center;gap:4px;"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${ac};"></span><strong style="color:${ac};">안드로이드 ${d.android ? '연결됨' : '미연결'}</strong></span>
    <span style="color:var(--txt-light);">|</span>
    <span style="display:inline-flex;align-items:center;gap:4px;"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${wc};"></span><strong style="color:${wc};">윈도우 ${d.windows ? '연결됨' : '미연결'}</strong></span>
  </div>`;
}

// ═══════════════════════════════════════════════
// 학생호출 시스템
// ═══════════════════════════════════════════════
// 반별 전용 채널로 전송 (classroom.html이 반별로 수신)
let callSelectedStudent = null;
let callSelectedClass = null;
let callTeacherName = null; // 호출한 선생님 이름

const QUICK_MESSAGES = [
  "교무실로 오세요",
  "가정통신문 가지고 오세요",
  "위 학생은 짐 챙기고 교무실로 오세요.",
  "각 반 반장들은 지금 교무실로 모여주세요.",
  "교무실로 오세요. 위 학생이 자리에 없는 경우 다른 친구가 꼭 전달해주세요.",
  "수업중에 죄송합니다."
];

function switchRosterSub(sub) {
  const rosterPanel = qs('#rosterPanel');
  const callPanel = qs('#callPanel');
  const btnRoster = qs('#rosterSubRoster');
  const btnCall = qs('#rosterSubCall');
  if (sub === 'roster') {
    if (rosterPanel) rosterPanel.style.display = 'block';
    if (callPanel) callPanel.style.display = 'none';
    if (btnRoster) { btnRoster.className = 'btn btn-sm btn-primary'; }
    if (btnCall) { btnCall.className = 'btn btn-sm btn-outline'; }
  } else {
    if (rosterPanel) rosterPanel.style.display = 'none';
    if (callPanel) callPanel.style.display = 'block';
    if (btnRoster) { btnRoster.className = 'btn btn-sm btn-outline'; }
    if (btnCall) { btnCall.className = 'btn btn-sm btn-primary'; }
    renderCallStudentGrid();
  }
}

function renderCallStudentGrid() {
  const cls = STATE.rosterUnlockedClass;
  if (!cls) return;
  callSelectedClass = cls;
  const data = STUDENT_ROSTER[cls];
  if (!data) return;

  const grid = qs('#callStudentGrid');
  if (!grid) return;

  grid.innerHTML = data.students.map(s =>
    `<button class="call-student-btn ${callSelectedStudent && callSelectedStudent.no === s.no ? 'selected' : ''}" 
       onclick="selectCallStudent(${s.no},'${s.name.replace(/'/g,"\'")}')">
      <span class="call-student-no">${s.no}</span>
      <span class="call-student-name">${s.name}</span>
    </button>`
  ).join('');
}

function selectCallStudent(no, name) {
  callSelectedStudent = { no, name };
  renderCallStudentGrid();

  const area = qs('#callSelectedArea');
  if (area) area.style.display = 'block';

  const nameEl = qs('#callSelectedName');
  if (nameEl) nameEl.innerHTML = `<span style="color:var(--primary);">${callSelectedClass}반</span> ${no}번 <strong>${name}</strong> 학생`;

  // 빠른 메시지 버튼
  const msgEl = qs('#callQuickMsgs');
  if (msgEl) {
    msgEl.innerHTML = QUICK_MESSAGES.map(msg => {
      return `<button class="call-quick-btn" onclick="setCallMessage('${msg.replace(/'/g,"\'")}')">${msg}</button>`;
    }).join('');
  }

  // 입력 필드 포커스
  const input = qs('#callCustomMsg');
  if (input) { input.value = ''; input.focus(); }
}

function setCallMessage(msg) {
  const input = qs('#callCustomMsg');
  if (input) input.value = msg;
}

function sendCallMessage() {
  if (!callSelectedStudent) { showAlert('학생을 먼저 선택해주세요.'); return; }
  const input = qs('#callCustomMsg');
  const msg = (input?.value || '').trim();
  if (!msg) { showAlert('메시지를 입력해주세요.'); return; }

  const payload = {
    type: 'call',
    className: callSelectedClass,
    studentNo: callSelectedStudent.no,
    studentName: callSelectedStudent.name,
    message: msg,
    callerTeacher: callTeacherName || '',
    timestamp: Date.now()
  };

  // Firebase로 전송
  if (firebaseDB) {
    firebaseDB.ref('calls/' + callSelectedClass).set(payload);
  }
  // BroadcastChannel fallback
  try {
    const ch = new BroadcastChannel('student-call-' + callSelectedClass);
    ch.postMessage(payload);
    ch.close();
  } catch(e) {}

  // 로그 추가
  const logEl = qs('#callLog');
  if (logEl) {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    logEl.insertAdjacentHTML('afterbegin', `
      <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;margin-bottom:4px;background:var(--green-pale);border:1px solid var(--green);border-radius:var(--r-md);font-size:12px;">
        <i class="fas fa-check-circle" style="color:var(--green);"></i>
        <span style="color:var(--txt-light);min-width:40px;">${timeStr}</span>
        <strong style="color:var(--brown);">${callSelectedClass}반 ${callSelectedStudent.name}</strong>
        <span style="color:var(--txt-mid);">${msg}</span>
      </div>`);
  }

  // 입력 초기화
  if (input) input.value = '';
  showAlert(`${callSelectedClass}반 ${callSelectedStudent.name} 학생에게 호출 메시지를 전송했습니다.`);
}

// ── 키보드 이벤트 ──
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (qs('#teacherScheduleModal')?.classList.contains('open')) closeTeacherSchedulePopup();
    else { closeModal(); closeAlert(); }
  }
});

// ── 초기화 ──
window.addEventListener('DOMContentLoaded', () => {
  initDraggableModals();
  // 실시간 날짜/시간 시작
  updateDateTime();
  setInterval(updateDateTime, 1000);

  // blockSettings 로드
  loadBlockSettings();

  // 협의회 필터칩 생성
  const dayFilterEl = qs('#meetingDayFilters');
  if (dayFilterEl) {
    dayFilterEl.innerHTML = DAYS.map(d =>
      `<div class="filter-chip checked" data-value="${d}" onclick="toggleFilterChip(this)">${d}요일</div>`
    ).join('');
  }
  const periodFilterEl = qs('#meetingPeriodFilters');
  if (periodFilterEl) {
    periodFilterEl.innerHTML = PERIODS.map(p =>
      `<div class="filter-chip checked" data-value="${p}" onclick="toggleFilterChip(this)">${p}교시</div>`
    ).join('');
  }

  // 연결 상태 주기적 갱신
  setInterval(() => {
    const el = qs('#classConnectionStatus');
    if (el && STATE.rosterUnlockedClass) {
      const cls = STATE.rosterUnlockedClass;
      const tmp = document.createElement('div');
      tmp.innerHTML = renderConnectionStatus(cls);
      const newEl = tmp.firstElementChild;
      el.replaceWith(newEl);
    }
  }, 3000);

  // Firebase 초기화
  initFirebase();
  loadAdminOverrides();
  setTimeout(startHeartbeatListener, 1000);
  setTimeout(startSharedMemoListener, 1000);

  // 엔터키 지원
  qs('#contactPassword')?.addEventListener('keydown',e=>{if(e.key==='Enter')verifyContactPassword();});
  qs('#rosterPassword')?.addEventListener('keydown',e=>{if(e.key==='Enter')verifyRosterPassword();});

  // 첫 탭 렌더
  switchTab('home');
});
