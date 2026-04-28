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
  calendarMonth: new Date().getMonth() + 1,
  freeSelectedTeacher: null,
  teacherScheduleSelected: null,
  contactDept: 'all',
  contactUnlocked: false,
  rosterUnlocked: false,
  rosterSelectedClass: null,
  rosterUnlockedClass: null,
  classScheduleSelected: null,
  labSelected: null,
  memo: '',
};

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
  qs('#alertModal').classList.add('open');
}
function closeAlert() { qs('#alertModal').classList.remove('open'); }

// ── 결과 모달 ──
function openModal() { qs('#resultModal').classList.add('open'); }
function closeModal() { qs('#resultModal').classList.remove('open'); }

// ── 탭 전환 ──
function switchTab(name) {
  STATE.currentTab = name;
  qsa('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  qsa('.tab-panel').forEach(p => p.classList.toggle('active', p.id === name + 'Tab'));
  if (name === 'swap')          renderSwapTable();
  if (name === 'teacher')       renderTeacherScheduleTab();
  if (name === 'classSchedule') renderClassScheduleTab();
  if (name === 'lab')           renderLabTab();
  if (name === 'free')          renderFreeTab();
  if (name === 'meeting')       renderMeetingTab();
  if (name === 'calendar')      renderCalendarTab();
  if (name === 'roster')        renderRosterTab();
  if (name === 'contact')       renderContactTab();
  if (name === 'block')         renderBlockTab();
  if (name === 'util')          renderUtilTab();
}

// ═══════════════════════════════════════════════
// 셀 공통 헬퍼
// ═══════════════════════════════════════════════

// 셀값 파싱: "106 국어1" → {subject, classLabel, grade, classNum, isSelect, isMint, isOnline}
// teacher 매개변수: 해당 셀의 교사명 (MINT_TEACHERS 체크용)
function parseCellValue(v, teacher, slot) {
  if (!v) return { subject:'', classLabel:'', grade:null, classNum:null, isSelect:false, isMint:false, isOnline:false };
  const s = String(v).trim();
  let grade = null, classNum = null, isSelect = false, isMint = false, isOnline = false;

  // SELECT_CELLS 기반 선택과목 판정 (PDF 노란색 셀)
  if (slot && typeof SELECT_CELLS !== 'undefined' && SELECT_CELLS[teacher] && SELECT_CELLS[teacher].has(slot)) {
    isSelect = true;
  }

  // 시간강사/산학협력교사/체육순회 체크
  if (teacher && typeof MINT_TEACHERS !== 'undefined' && MINT_TEACHERS.has(teacher)) {
    isMint = true;
  }
  // MINT_CELLS 기반 셀 단위 민트 판정 (PDF 민트색 셀)
  if (slot && typeof MINT_CELLS !== 'undefined' && MINT_CELLS[teacher] && MINT_CELLS[teacher].has(slot)) {
    isMint = true;
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
        const blocked = isBlockedTime(teacher, day, period);
        const isChatech = isChatcheTime(teacher, day, period);
        const dayStartCls = pi === 0 ? 'day-start' : '';

        // 점심시간 처리 (교사별로 학년군에 맞게)
        const isLunchSlot = checkLunchSlot(teacher, gradeGroup, day, period);

        let cellClass = dayStartCls;
        let cellStyle = '';
        let cellContent = '';
        let clickable = '';
        let cellInfo = null;

        if (isLunchSlot && !val) {
          cellStyle = 'style="background:#fffcee;cursor:default;"';
          cellContent = `<span style="font-size:9.5px;color:#c8a000;font-style:italic;">점심</span>`;
        } else if (blocked) {
          cellStyle = 'style="background:var(--cell-blocked-bg);cursor:default;"';
          cellContent = `<span style="font-size:9.5px;color:#c07070;">불가</span>`;
        } else if (isChatech && !val) {
          cellStyle = 'style="background:var(--cell-chatech-bg);"';
          cellContent = `<span class="cell-chatech">창체</span>`;
          clickable = `onclick="onCellClick('${teacher}','${day}',${period})"`;
        } else if (val) {
          const info = parseCellValue(val, teacher, key);
          cellInfo = info;
          clickable = `onclick="onCellClick('${teacher}','${day}',${period})"`;
          if (info.isSelect) {
            cellStyle = 'style="background:var(--cell-select-bg);border-color:var(--cell-select-bd);"';
            cellContent = `<div class="cell-inner">
              <span class="cell-subject">${info.subject}</span>
              <span class="cell-class cell-select-badge">${info.classLabel}</span>
              <span style="font-size:7.5px;color:#b8860b;font-weight:700;margin-top:1px;">선택·교체불가</span>
            </div>`;
          } else if (info.isMint) {
            cellStyle = 'style="background:var(--cell-mint-bg);border-color:var(--cell-mint-bd);"';
            const mintLabel = teacher === '체육순회' ? '순회' : '강사';
            cellContent = `<div class="cell-inner">
              <span class="cell-subject">${info.subject}</span>
              <span class="cell-class" style="font-size:8px;color:var(--cell-mint-bd);">[${mintLabel}]${info.classLabel}</span>
            </div>`;
          } else {
            cellContent = `<div class="cell-inner">
              <span class="cell-subject">${info.subject}</span>
              <span class="cell-class">${info.classLabel}</span>
            </div>`;
          }
        }

        const cellTitle = cellInfo?.isSelect
          ? `${teacher} ${day}${period}교시 — 선택과목 (교체 불가, 대체만 가능)`
          : cellInfo?.isMint
            ? `${teacher} ${day}${period}교시 — 시간강사·산학협력 (교체 불가)`
          : cellInfo?.isOnline
            ? '온라인 수업 (교사 없음 — 교체·대체 불가)'
          : (teacher === '체육순회' ? '체육순회 수업 (교체·대체 불가)' : `${teacher} ${day}${period}교시`);

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

  const info = parseCellValue(val || '', teacher, key);

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

  const swapResults = findSwapCandidates(teacher, day, period, val);
  const subResults  = findSubstituteCandidates(teacher, day, period);

  swapResults.forEach(r => {
    const cell = qs(`#cell-${r.teacher.replace(/\s/g,'_')}-${r.day}-${r.period}`);
    if (cell) cell.classList.add('is-partner');
  });

  renderResultModal(teacher, day, period, val, swapResults, subResults);
  openModal();
}

// 교체(맞교환) 후보
// 교체 조건: 상대방이 '내가 가르치는 반'에 수업이 있고,
// 그 시간에 내가 공강이며, 내 수업 시간에 상대방이 공강인 경우
function findSwapCandidates(myTeacher, myDay, myPeriod, myVal) {
  const myInfo = parseCellValue(myVal, myTeacher, myDay + myPeriod);
  if (!myVal || myInfo.isSelect || !myInfo.grade || !myInfo.classNum) return [];

  const results = [];
  const myRow = TEACHER_SCHEDULE[myTeacher] || {};
  const seen = new Set(); // 중복 방지

  ALL_TEACHERS.forEach(other => {
    if (other === myTeacher) return;
    // 민트 교사(시간강사/산학협력교사)는 교체 대상 아님
    if (typeof MINT_TEACHERS !== 'undefined' && MINT_TEACHERS.has(other)) return;
    if (isBlockedTime(other, myDay, myPeriod)) return;
    if (isChatcheTime(other, myDay, myPeriod)) return;
    const otherRow = TEACHER_SCHEDULE[other] || {};
    // 상대방이 내 시간(myDay, myPeriod)에 수업이 있으면 교체 불가
    if (otherRow[myDay + myPeriod]) return;

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
        if (otherInfo.isSelect || otherInfo.isMint) return;

        // 상대방이 내 반(grade+classNum)에 수업하고 있고
        // 그 시간에 내가 공강이면 교체 가능
        if (otherInfo.grade === myInfo.grade && otherInfo.classNum === myInfo.classNum) {
          if (!myRow[d + p]) {
            const key = `${other}|${d}|${p}`;
            if (!seen.has(key)) {
              seen.add(key);
              results.push({
                teacher: other,
                day: d,
                period: p,
                subject: otherInfo.subject,
                theirClass: otherInfo.classLabel
              });
            }
          }
        }
      });
    });
  });
  return results;
}

// 대체 후보 (공강 선생님 중 같은 교과)
function findSubstituteCandidates(myTeacher, day, period) {
  // 창체 시간인 경우: 비담임 교사 명단에서 해당 시간 공강인 교사를 대체 후보로 반환
  if (isChatcheTime(myTeacher, day, period)) {
    const results = [];
    const key = day + period;
    CHANGCHE_AVAILABLE_TEACHERS.forEach(candidate => {
      if (isBlockedTime(candidate, day, period)) return;
      const candRow = TEACHER_SCHEDULE[candidate] || {};
      if (!(candRow[key] || '').trim()) {
        results.push({ teacher: candidate, subject: '창체' });
      }
    });
    return results;
  }

  const subMap = SUBJECT_SUBSTITUTE_MAP[myTeacher];
  if (!subMap || subMap.canSubFor.length === 0) return [];

  const results = [];
  subMap.canSubFor.forEach(candidate => {
    if (isBlockedTime(candidate, day, period)) return;
    if (isChatcheTime(candidate, day, period)) return;
    const candRow = TEACHER_SCHEDULE[candidate] || {};
    if (!(candRow[day + period] || '').trim()) {
      results.push({ teacher: candidate, subject: subMap.subject });
    }
  });
  return results;
}

// 결과 모달 – 차단됨(시간강사/산학협력교사 등)
function renderResultModal_blocked(teacher, day, period, val, msg) {
  const info = parseCellValue(val || '', teacher);
  const dayNames = {월:'월요일',화:'화요일',수:'수요일',목:'목요일',금:'금요일'};
  const periodTime = PERIOD_TIMES[period]?.time || '';

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
      <div class="result-my-teacher">${teacher} 선생님</div>
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
function renderResultModal(teacher, day, period, val, swapRes, subRes) {
  const info      = parseCellValue(val || '', teacher, day + period);
  const isChatech = isChatcheTime(teacher, day, period) && !val;
  const lessonName = isChatech ? '창의적 체험활동(창체)' : (info.subject || val || '-');
  const dayNames = {월:'월요일',화:'화요일',수:'수요일',목:'목요일',금:'금요일'};
  const periodTime = PERIOD_TIMES[period]?.time || '';
  const homeroomCls = TEACHER_TO_CLASS[teacher];

  // ── 선택 수업 박스 ──
  qs('#modalMyLesson').innerHTML = `
    <div class="result-my-lesson ${info.isSelect ? 'select' : 'normal'}">
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
      <div class="result-my-teacher">${teacher} 선생님${homeroomCls ? ' · ' + homeroomCls + '반 담임' : ''}</div>
      ${info.isSelect ? '<div class="result-rule-badge select"><i class="fas fa-palette"></i> 선택과목 (노란색) — 대체만 가능, 교체 불가</div>' : ''}
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

  if (isChatech) {
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
      const rPeriodTime = PERIOD_TIMES[r.period]?.time || '';
      html += `
        <div class="result-card swap">
          <div class="result-card-num swap">${i + 1}</div>
          <div class="result-card-info">
            <div class="result-card-name">${r.teacher} 선생님
              ${TEACHER_TO_CLASS[r.teacher] ? `<span style="font-size:10.5px;font-weight:400;color:var(--txt-light);margin-left:4px;">${TEACHER_TO_CLASS[r.teacher]}담임</span>` : ''}
            </div>
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
    const subMap = SUBJECT_SUBSTITUTE_MAP[teacher];
    const subj = subMap ? subMap.subject : '';
    html += `<div class="result-empty-msg"><i class="fas fa-search"></i>
      ${subj ? `[${subj}] 교과 중 이 시간에 공강인 선생님이 없습니다.` : '대체 가능한 선생님이 없습니다.'}
    </div>`;
  } else {
    subRes.forEach((r, i) => {
      html += `
        <div class="result-card sub">
          <div class="result-card-check">✓</div>
          <div class="result-card-info">
            <div class="result-card-name">${r.teacher} 선생님
              ${TEACHER_TO_CLASS[r.teacher] ? `<span style="font-size:10.5px;font-weight:400;color:var(--txt-light);margin-left:4px;">${TEACHER_TO_CLASS[r.teacher]}담임</span>` : ''}
            </div>
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
        const rt = PERIOD_TIMES[r.period]?.time || '';
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
function renderTeacherScheduleTab() { renderTeacherListPanel(); }

function renderTeacherListPanel() {
  const rawSearch = (qs('#teacherScheduleSearch')?.value || '').trim();
  const searchTerms = rawSearch ? rawSearch.split(/[,\s]+/).map(s => s.trim().toLowerCase()).filter(Boolean) : [];
  const listEl = qs('#teacherScheduleList');
  if (!listEl) return;

  const filtered = ALL_TEACHERS.filter(t => !searchTerms.length || searchTerms.some(s => t.toLowerCase().includes(s)));
  if (!filtered.length) {
    listEl.innerHTML = `<div style="padding:14px;text-align:center;color:var(--txt-light);font-size:12px;">검색 결과 없음</div>`;
    return;
  }

  listEl.innerHTML = filtered.map(t => {
    const active = STATE.teacherScheduleSelected === t ? 'active' : '';
    const homeroomCls = TEACHER_TO_CLASS[t] || '';
    return `<button class="side-btn-item ${active}" onclick="selectTeacherSchedule('${t}')">
      <span>${t} 선생님</span>
      ${homeroomCls ? `<span class="side-btn-sub">${homeroomCls} 담임</span>` : ''}
    </button>`;
  }).join('');
}

function selectTeacherSchedule(teacher) {
  STATE.teacherScheduleSelected = teacher;
  renderTeacherListPanel();
  renderTeacherDetailTable(teacher);
}

function renderTeacherDetailTable(teacher) {
  const panel = qs('#teacherDetailPanel');
  if (!panel) return;
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

  panel.innerHTML = `
    <div class="teacher-detail-header">
      <div class="teacher-avatar">👤</div>
      <div>
        <div style="font-size:17px;font-weight:800;">${teacher} 선생님</div>
        <div style="font-size:12.5px;opacity:.85;margin-top:3px;">
          ${isHR ? cls + '반 담임 · ' : ''}${subMap ? subMap.subject : ''} 교과
        </div>
        <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">
          <span class="badge ${gradeGroup==='3'?'badge-orange':'badge-blue'}">${gradeGroup==='3'?'3학년 일과':'1·2학년 일과'}</span>
          <span class="badge badge-green">공강 ${freeCount}교시</span>
        </div>
      </div>
    </div>
    <div style="overflow-x:auto;padding:12px;">
      <table class="teacher-detail-table" style="min-width:500px;">
        <thead>
          <tr>
            <th style="width:80px;">교시</th>
            ${DAYS.map(d=>`<th>${d}요일</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${PERIODS.map(p => {
            let lunchRow = '';
            if (p === lunchAfter + 1) {
              lunchRow = `<tr>
                <td class="period-label" style="font-size:9.5px;color:#b8860b;">점심</td>
                ${DAYS.map(()=>`<td style="background:#fff8ea;font-size:10px;color:#b8860b;text-align:center;padding:6px;">${lunchLabel}</td>`).join('')}
              </tr>`;
            }
            const row = `<tr>
              <td class="period-label">
                <div style="font-weight:700;font-size:12px;">${PERIOD_TIMES[p].label}</div>
                <div style="font-size:9.5px;color:var(--txt-light);">${PERIOD_TIMES[p].time}</div>
              </td>
              ${DAYS.map(d => {
                const key = d + p;
                const val = sch[key] || '';
                const isChatech = isChatcheTime(teacher, d, p);
                const blocked = isBlockedTime(teacher, d, p);
                if (isChatech && !val) return `<td style="background:var(--cell-chatech-bg);color:var(--cell-chatech-tx);font-size:11px;font-weight:700;">창체</td>`;
                if (blocked) return `<td style="background:var(--cell-blocked-bg);font-size:10px;color:#c07070;">교체불가</td>`;
                if (!val) return `<td></td>`;
                const info = parseCellValue(val, teacher, key);
                let tdStyle = '';
                let clickFn = `onclick="onCellClick('${teacher}','${d}',${p})"`;
                if (info.isSelect) {
                  tdStyle = 'background:var(--cell-select-bg);border:1px solid var(--cell-select-bd);cursor:pointer;';
                  return `<td style="${tdStyle}" ${clickFn} title="선택과목 (교체 불가, 대체만 가능)">
                    <div class="cell-inner">
                      <span style="font-size:11.5px;font-weight:700;">${info.subject}</span>
                      <span style="font-size:10px;color:var(--txt-mid);">${info.classLabel}</span>
                    </div>
                  </td>`;
                } else if (info.isMint) {
                  tdStyle = 'background:var(--cell-mint-bg);border:1px solid var(--cell-mint-bd);cursor:pointer;';
                  return `<td style="${tdStyle}" ${clickFn} title="시간강사·산학협력 (교체 불가)">
                    <div class="cell-inner">
                      <span style="font-size:11.5px;font-weight:700;">${info.subject}</span>
                      <span style="font-size:10px;color:var(--cell-mint-tx);">${info.classLabel}</span>
                    </div>
                  </td>`;
                } else if (info.isOnline) {
                  tdStyle = 'background:#e8f5e9;border:1px solid #81c784;cursor:default;';
                  clickFn = '';
                  return `<td style="${tdStyle}" title="온라인 수업 (교사 없음)">
                    <div class="cell-inner">
                      <span style="font-size:10px;font-weight:700;color:#2e7d32;">온라인</span>
                      <span style="font-size:9.5px;color:#388e3c;">${info.classLabel}</span>
                    </div>
                  </td>`;
                } else {
                  tdStyle = 'cursor:pointer;';
                }
                return `<td style="${tdStyle}" ${clickFn}>
                  <div class="cell-inner">
                    <span style="font-size:11.5px;font-weight:700;">${info.subject}</span>
                    <span style="font-size:10px;color:var(--txt-mid);">${info.classLabel}</span>
                  </div>
                </td>`;
              }).join('')}
            </tr>`;
            return lunchRow + row;
          }).join('')}
        </tbody>
      </table>
    </div>`;
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
        <span class="meeting-btn-name">${t} 선생님</span>
        <span class="meeting-btn-meta">${grpBadge}${selected ? '<span class="meeting-check">✓</span>' : ''}</span>
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
        // 1·2학년 교사만
        const g12 = teachers.filter(t => getTeacherGradeGroup(t) === '12');
        if (g12.length > 0 && g12.every(t => !isBlockedTime(t,day,period) && !isChatcheTime(t,day,period) && !(TEACHER_SCHEDULE[t]||{})[day+period])) {
          available.push({ day, period, type:'4A', note:'1·2학년 기준' });
        }
        // 3학년 교사만
        const g3 = teachers.filter(t => getTeacherGradeGroup(t) === '3');
        if (g3.length > 0 && g3.every(t => !isBlockedTime(t,day,period) && !isChatcheTime(t,day,period) && !(TEACHER_SCHEDULE[t]||{})[day+period])) {
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
    <button class="btn btn-dark btn-sm" onclick="copyMeetingResult()"><i class="fas fa-print"></i> 인쇄</button>
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
  function getCellInfo(day, period, subset) {
    const grp = subset || teachers;
    let teachingCount = 0; let freeTeachers = [];
    grp.forEach(t => {
      const val = (TEACHER_SCHEDULE[t]||{})[day + period];
      const ch  = isChatcheTime(t, day, period);
      const bl  = isBlockedTime(t, day, period);
      if (val || ch || bl) teachingCount++; else freeTeachers.push(t);
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
      const g12 = teachers.filter(t => getTeacherGradeGroup(t) !== '3');
      const g3  = teachers.filter(t => getTeacherGradeGroup(t) === '3');

      if (g12.length > 0) {
        html += `<tr><td class="meeting-td-period">
          <span class="meeting-period-num">4</span>
          <span class="meeting-period-sub">11:40</span>
          <span class="meeting-period-grade">1·2학년</span>
        </td>`;
        DAYS.forEach(day => {
          const isAllFree = free4A.has(day + '4A');
          const info = getCellInfo(day, 4, g12);
          html += buildMeetingCell(isAllFree, info.teachingCount, info.freeTeachers, info.total);
        });
        html += `</tr>`;
      }
      if (g3.length > 0) {
        html += `<tr><td class="meeting-td-period">
          <span class="meeting-period-num">4</span>
          <span class="meeting-period-sub">12:40</span>
          <span class="meeting-period-grade">3학년</span>
        </td>`;
        DAYS.forEach(day => {
          const isAllFree = free4B.has(day + '4B');
          const info = getCellInfo(day, 4, g3);
          html += buildMeetingCell(isAllFree, info.teachingCount, info.freeTeachers, info.total);
        });
        html += `</tr>`;
      }
    } else {
      const timeLabel = PERIOD_TIMES[p]?.time?.split('~')[0]?.trim() || '';
      html += `<tr><td class="meeting-td-period">
        <span class="meeting-period-num">${p}</span>
        <span class="meeting-period-sub">${timeLabel}</span>
      </td>`;
      DAYS.forEach(day => {
        const isAllFree = freeSet.has(day + p);
        const info = getCellInfo(day, p, null);
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
      <div class="mtd-check">✅</div>
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
      const allFree = teachers.every(t => !isBlockedTime(t,d,p) && !isChatcheTime(t,d,p) && !(TEACHER_SCHEDULE[t]||{})[d+p]);
      if (allFree) text += `○ ${d}요일 ${p}교시 - 전체 공강\n`;
    });
  });
  copyToClipboard(text, null);
}

// ═══════════════════════════════════════════════
// 학사일정 탭 (달력형)
// ═══════════════════════════════════════════════
function renderCalendarTab() {
  const monthList = qs('#calendarMonthList');
  const content   = qs('#calendarContent');
  if (!monthList || !content) return;

  const months = [...new Set(ACADEMIC_CALENDAR.map(e => parseInt(e.date.split('-')[1])))].sort((a,b)=>a-b);
  const labels = ['','1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
  
  // 버튼식 월 선택 (cal-month-list 스타일)
  monthList.innerHTML = `<div class="cal-month-list">` +
    months.map(m => {
      const cnt = ACADEMIC_CALENDAR.filter(e => parseInt(e.date.split('-')[1]) === m).length;
      return `<button class="cal-month-btn ${m === STATE.calendarMonth ? 'active' : ''}" onclick="selectCalendarMonth(${m})">
        ${labels[m]} <span style="font-size:10px;opacity:0.7;font-weight:400;">(${cnt})</span>
      </button>`;
    }).join('') +
  `</div>`;

  renderCalendarGrid(STATE.calendarMonth);
}

function selectCalendarMonth(m) {
  STATE.calendarMonth = m;
  renderCalendarTab();
}

function renderCalendarGrid(month) {
  const content = qs('#calendarContent');
  if (!content) return;

  const year = 2026;
  const firstDay = new Date(year, month - 1, 1);
  const lastDay  = new Date(year, month, 0);
  const startDow = firstDay.getDay(); // 0=일
  const totalDays = lastDay.getDate();
  const today = new Date();

  // 이달 이벤트 맵
  const eventMap = {};
  ACADEMIC_CALENDAR.forEach(ev => {
    const d = ev.date.split('-');
    if (parseInt(d[1]) === month) {
      const key = parseInt(d[2]);
      if (!eventMap[key]) eventMap[key] = [];
      eventMap[key].push(ev);
    }
  });

  const DAY_LABELS = ['일','월','화','수','목','금','토'];

  let html = `<div style="display:flex;align-items:center;justify-content:center;gap:8px;padding:10px 16px;border-bottom:1px solid var(--border-lt);background:var(--sky-pale);">
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
  const monthEvents = ACADEMIC_CALENDAR.filter(e => parseInt(e.date.split('-')[1]) === month);
  if (monthEvents.length > 0) {
    html += `<div style="border-top:2px solid var(--border-lt);padding:12px 14px;">
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
  const months = [...new Set(ACADEMIC_CALENDAR.map(e => parseInt(e.date.split('-')[1])))].sort((a,b)=>a-b);
  const idx = months.indexOf(STATE.calendarMonth);
  const newIdx = idx + dir;
  if (newIdx >= 0 && newIdx < months.length) {
    STATE.calendarMonth = months[newIdx];
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
  // 연락처에 등록된 전화번호 뒷 4자리와 일치하는지 확인
  const matched = STAFF_CONTACTS.some(c => {
    if (!c.phone || c.phone === '-') return false;
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
      <div class="contact-ext"><i class="fas fa-phone"></i> 내선 ${c.ext}</div>
      ${c.phone && c.phone !== '-' ? `<div class="contact-phone"><i class="fas fa-mobile-alt" style="margin-right:3px;"></i>${c.phone}</div>` : ''}
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
      const displayName = name.replace(/\([^)]+\)/, '').trim();
      return `<button class="side-btn-item ${active}" data-lab="${name}" onclick="selectLab('${name}')">
        <span>${displayName}</span>
        ${roomLabel ? `<span class="side-btn-room">${roomLabel}</span>` : ''}
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
    btn.classList.toggle('active', btn.dataset.lab === labName);
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

  let html = `
    <div class="card-header" style="border-radius:var(--r-lg) var(--r-lg) 0 0;">
      <i class="fas fa-flask"></i> ${labName} 주간 시간표
    </div>
    <div style="overflow-x:auto;padding:14px;">
      <table class="schedule-table lab-table" style="min-width:580px;">
        <thead>
          <tr>
            <th class="teacher-th" style="min-width:62px;">교시</th>
            ${DAYS.map(d=>`<th class="day-header" style="min-width:100px;">${d}요일</th>`).join('')}
          </tr>
        </thead>
        <tbody>`;

  // 실습실에 등장하는 교사 목록 수집 → 색상 매핑
  const labTeachers = new Set();
  DAYS.forEach(d => PERIODS.forEach(p => {
    const cell = (sched[d]||{})[p] || '';
    if (cell) {
      const tm = cell.match(/[가-힣]{2,4}$/);
      if (tm) labTeachers.add(tm[0]);
    }
  }));
  const labTeacherArr = [...labTeachers].sort((a,b) => a.localeCompare(b,'ko'));
  const labColors = [
    {bg:'#EBF5FF',bd:'#90BEE8',tx:'#1A4A7A'},
    {bg:'#FFF4E6',bd:'#F0C070',tx:'#7A4A00'},
    {bg:'#F0E8FF',bd:'#B896E6',tx:'#5A2A8A'},
    {bg:'#E8F8EE',bd:'#80CCA0',tx:'#1A6040'},
    {bg:'#FFF0F0',bd:'#E8A0A0',tx:'#8A2020'},
    {bg:'#FFF8CC',bd:'#D4B840',tx:'#6A5000'},
    {bg:'#E8F0F8',bd:'#88B0D0',tx:'#2A4A6A'},
    {bg:'#FCE8F0',bd:'#D090B0',tx:'#7A2050'},
    {bg:'#F0FAF0',bd:'#90C890',tx:'#2A6A2A'},
    {bg:'#F8F0E8',bd:'#C8A880',tx:'#5A4020'},
    {bg:'#E8F0FF',bd:'#80A8E0',tx:'#1A3A7A'},
    {bg:'#FFF0FA',bd:'#E0A0D0',tx:'#6A2060'},
  ];
  const teacherColorMap = {};
  labTeacherArr.forEach((t, i) => {
    teacherColorMap[t] = labColors[i % labColors.length];
  });

  // 범례
  html += `<div style="display:flex;flex-wrap:wrap;gap:6px;padding:10px 14px;border-bottom:1px solid var(--border-lt);background:var(--bg-soft);">`;
  labTeacherArr.forEach(t => {
    const c = teacherColorMap[t];
    html += `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:${c.bg};color:${c.tx};border:1.5px solid ${c.bd};">${t}</span>`;
  });
  html += `</div>`;

  PERIODS.forEach(p => {
    html += `<tr>
      <td class="teacher-td" style="text-align:center;font-weight:700;font-size:12px;padding:8px;">
        ${p}교시<br><span style="font-size:10px;color:var(--txt-light);font-weight:400;">${PERIOD_TIMES[p]?.time||''}</span>
      </td>`;
    DAYS.forEach(d => {
      const cell = (sched[d]||{})[p] || '';
      if (cell) {
        const tm = cell.match(/[가-힣]{2,4}$/);
        const tName = tm ? tm[0] : '';
        const c = teacherColorMap[tName] || {bg:'var(--yellow-pale)',bd:'var(--border)',tx:'var(--brown)'};
        // 과목·반·교사 분리 표시
        const parts = cell.replace(/\s*(전상실|컴그실|만콘실|영상실|창구실|사행실|회계실)\s*/g,' ').trim().split(' ');
        const roomClass = parts[0] || '';
        const subj = parts[1] || '';
        const teacher = parts[2] || tName;
        html += `<td style="background:${c.bg};border:1.5px solid ${c.bd};padding:6px 4px;text-align:center;vertical-align:middle;" title="${cell}">
          <div style="font-size:11.5px;font-weight:700;color:${c.tx};line-height:1.3;">${subj || roomClass}</div>
          <div style="font-size:9.5px;color:${c.tx};opacity:0.7;">${roomClass}${teacher && teacher !== subj ? ' · '+teacher : ''}</div>
        </td>`;
      } else {
        html += `<td class="lab-cell-empty">-</td>`;
      }
    });
    html += `</tr>`;
  });
  html += `</tbody></table></div>`;
  wrap.innerHTML = html;
}

// ═══════════════════════════════════════════════
// 학급별 시간표 탭
// ═══════════════════════════════════════════════
function renderClassScheduleTab() {
  renderClassScheduleList();
}

function renderClassScheduleList() {
  const listEl = qs('#classScheduleList');
  if (!listEl) return;
  const searchVal = (qs('#classScheduleSearch')?.value || '').toLowerCase();
  const allClasses = Object.keys(CLASS_SCHEDULE);
  const classes = allClasses.filter(c => !searchVal || c.includes(searchVal));

  if (!classes.length) {
    listEl.innerHTML = `<div style="padding:14px;text-align:center;color:var(--txt-light);font-size:12px;">검색 결과 없음</div>`;
    return;
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
      const active = STATE.classScheduleSelected === cls ? 'active' : '';
      const teacher = HOMEROOM_TEACHERS[cls] || '';
      html += `<button class="side-btn-item ${active}" onclick="selectClassSchedule('${cls}')">
        <span>${cls}반</span>
        ${teacher ? `<span class="side-btn-sub">담임 ${teacher}</span>` : ''}
      </button>`;
    });
  });

  listEl.innerHTML = html;
}

function selectClassSchedule(cls) {
  STATE.classScheduleSelected = cls;
  renderClassScheduleList();
  renderClassScheduleDetail(cls);
}

function renderClassScheduleDetail(cls) {
  const panel = qs('#classScheduleDetail');
  if (!panel) return;
  const sched = CLASS_SCHEDULE[cls];
  const teacher = HOMEROOM_TEACHERS[cls] || '미지정';
  if (!sched) {
    panel.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>시간표 데이터가 없습니다</h3></div>`;
    return;
  }

  // 학년 파악
  const grade = parseInt(cls.split('-')[0]);
  const isGrade3 = grade === 3;

  let html = `<div class="card-header" style="border-radius:var(--r-lg) var(--r-lg) 0 0;">
    <i class="fas fa-th"></i> ${cls}반 주간 시간표
    <span style="margin-left:8px;font-size:11px;font-weight:400;color:var(--txt-light);">담임: ${teacher} 선생님</span>
  </div>
  <div style="overflow-x:auto;padding:16px;">
    <table class="schedule-table" style="min-width:600px;">
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
      html += `<tr style="background:#fff8ea;">
        <td style="text-align:center;font-size:11px;color:#b8860b;font-style:italic;">점심</td>
        <td colspan="5" style="text-align:center;font-size:11px;color:#b8860b;font-style:italic;">11:30 ~ 13:40 (점심시간)</td>
      </tr>`;
    } else if (!isGrade3 && p === 5) {
      html += `<tr style="background:#fff8ea;">
        <td style="text-align:center;font-size:11px;color:#b8860b;font-style:italic;">점심</td>
        <td colspan="5" style="text-align:center;font-size:11px;color:#b8860b;font-style:italic;">12:30 ~ 13:40 (점심시간)</td>
      </tr>`;
    }

    html += `<tr>
      <td style="text-align:center;font-weight:700;font-size:12px;padding:8px;">${p}교시<br><span style="font-size:10px;color:var(--txt-light);font-weight:400;">${PERIOD_TIMES[p]?.time||''}</span></td>`;

    DAYS.forEach(d => {
      const key = d + p;
      const val = sched[key] || '';
      let cellStyle = 'padding:8px;text-align:center;font-size:12px;';
      let content = '';

      if (val === '창체') {
        cellStyle += 'background:var(--cell-chatech-bg);color:var(--cell-chatech-tx);font-weight:600;';
        content = '🌸 창체';
      } else if (val) {
        // "교과 교사명" 형식 파싱
        const parts = val.split(' ');
        const subj = parts[0] || '';
        const tname = parts[1] || '';
        content = `<div style="font-weight:700;color:var(--txt-dark);font-size:12px;">${subj}</div><div style="font-size:10.5px;color:var(--txt-mid);">${tname}</div>`;
      } else {
        cellStyle += 'color:var(--txt-muted);';
        content = '-';
      }
      html += `<td style="${cellStyle}">${content}</td>`;
    });
    html += `</tr>`;
  });

  html += `</tbody></table></div>`;
  panel.innerHTML = html;
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
  const connected = isClassConnected(cls);
  const dotColor = connected ? '#3da86a' : '#e05050';
  const dotLabel = connected ? '교실 연결됨' : '교실 미연결';
  html += `<div id="classConnectionStatus" style="margin-top:14px;padding:10px 14px;background:${connected ? '#e8f8ee' : '#fff0f0'};border:1.5px solid ${dotColor};border-radius:var(--r-md);display:flex;align-items:center;gap:8px;font-size:12px;">
    <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${dotColor};"></span>
    <strong style="color:${dotColor};">${dotLabel}</strong>
    <span style="color:var(--txt-light);">— classroom/${cls}.html 파일을 교실 전자칠판에서 열어두세요</span>
  </div>`;

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
  const memo = qs('#memoArea');
  if (memo && !memo.value) {
    try { memo.value = localStorage.getItem('memo') || ''; } catch(e) {}
  }
  renderTodayStatus();
  renderTodayCalendar();
  renderHomeroomList();
  renderSubjectGroups();
}

function saveMemo() {
  try {
    localStorage.setItem('memo', qs('#memoArea')?.value || '');
    showAlert('메모가 저장되었습니다! 💾');
  } catch(e) {}
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
    { subj:"국어",   cls:"badge-blue",   teachers:["황혜인","강승표","김연아","홍민영","김보민","오재원","홍원정"] },
    { subj:"수학",   cls:"badge-purple",  teachers:["공은표","강혜민","김한주","오소영","오재영","고지수"] },
    { subj:"영어",   cls:"badge-green",   teachers:["조설아","김희경","김민지","김도연","김지선","송진호"] },
    { subj:"사회",   cls:"badge-orange",  teachers:["강창규","안미진","양찬호","김민권","양정원","현은심","이상희","김대현","강부열","김민정"] },
    { subj:"과학",   cls:"badge-blue",    teachers:["박종찬","오승철","현창식","장진혁","김현정"] },
    { subj:"체육",   cls:"badge-green",   teachers:["고세권","김재현","김형우"] },
    { subj:"정보",   cls:"badge-purple",  teachers:["김영주","문원호","임수진","박정민","오소연","김태환","고대홍","백은정","이상분","송주연","임홍재","김영조"] },
    { subj:"상업",   cls:"badge-orange",  teachers:["고대홍","백은정","김지연","송주연","임홍재","김영조","강향아","김태환","김유리"] },
    { subj:"미술",   cls:"badge-red",     teachers:["고지은","김윤주","김제령","백경민"] },
    { subj:"디자인", cls:"badge-blue",    teachers:["김윤주","송준한","김제령","박정민","문원호","임수진","오소연","이상분"] },
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
// 교실 연결 상태 모니터링 (하트비트)
// ═══════════════════════════════════════════════
const connectedClasses = {};  // { "1-1": timestamp, ... }

// Firebase 하트비트 수신
function startHeartbeatListener() {
  if (!firebaseDB) return;
  firebaseDB.ref('heartbeat').on('value', (snap) => {
    const data = snap.val() || {};
    Object.keys(data).forEach(cls => {
      connectedClasses[cls] = data[cls].ts || 0;
    });
  });
}

// BroadcastChannel fallback (같은 PC 테스트용)
try {
  const heartbeatChannel = new BroadcastChannel('heartbeat');
  heartbeatChannel.onmessage = (e) => {
    if (e.data && e.data.type === 'alive' && e.data.cls) {
      connectedClasses[e.data.cls] = Date.now();
    }
  };
} catch(e) {}

function isClassConnected(cls) {
  const last = connectedClasses[cls];
  return last && (Date.now() - last < 10000); // 10초 이내 하트비트
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
  if (e.key === 'Escape') { closeModal(); closeAlert(); }
});

// ── 초기화 ──
window.addEventListener('DOMContentLoaded', () => {
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
      const conn = isClassConnected(cls);
      const dc = conn ? '#3da86a' : '#e05050';
      el.style.background = conn ? '#e8f8ee' : '#fff0f0';
      el.style.borderColor = dc;
      el.innerHTML = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${dc};"></span><strong style="color:${dc};">${conn ? '교실 연결됨' : '교실 미연결'}</strong><span style="color:var(--txt-light);">— classroom/${cls}.html 파일을 교실 전자칠판에서 열어두세요</span>`;
    }
  }, 3000);

  // Firebase 초기화
  initFirebase();
  setTimeout(startHeartbeatListener, 1000);

  // 엔터키 지원
  qs('#contactPassword')?.addEventListener('keydown',e=>{if(e.key==='Enter')verifyContactPassword();});
  qs('#rosterPassword')?.addEventListener('keydown',e=>{if(e.key==='Enter')verifyRosterPassword();});

  // 첫 탭 렌더
  switchTab('swap');
});
