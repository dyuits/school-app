(function(){
  const HOMEROOM=['김도연','박종찬','강부열','강혜민','양찬호','황혜인','백은정','장진혁','이상희','고지은','현은심','오소연','김지선','김민권','김현정','송진호','김지연','안미진','고지수','김보민','김민지','오재영','오재원','김민정','임홍재','강향아','송준한','김윤주','김제령','임수진'];
  const PERIOD2=['김재현','조설아','김연아','공은표','오승철','강진석','김영주','이순규','이상분','정성현','강창규','강승표','홍원정','김한주','김수정','김대현','고세권','김태환','김두산','현은심','양정원','오소영','김희경','현창식','김형우','문원호','김영조','송주연','박정민','산학'];
  const PERIOD3=[...PERIOD2.slice(0,19),'강창규',...PERIOD2.slice(20)];
  const DAYS=[{
    date:'2026-09-02',title:'9월 학력평가',day:'수요일',
    periods:[
      {period:'1교시',subject:'국어',duration:'80분',time:'08:40~10:00',teachers:HOMEROOM},
      {period:'2교시',subject:'수학',duration:'100분',time:'10:20~12:00',teachers:PERIOD2},
      {period:'3교시',subject:'영어',duration:'70분',time:'1학년 13:30~14:40 · 2·3학년 13:10~14:20',gradeTimes:{1:'13:30~14:40',2:'13:10~14:20',3:'13:10~14:20'},teachers:PERIOD3},
      {period:'4교시',subject:'한국사·탐구',duration:'',time:'학년별 시간 확인',gradeTimes:{1:'탐구1 15:25~16:05 · 탐구2 16:10~16:50',2:'한국사 14:50~15:20 · 탐구1 15:35~16:05 · 탐구2 16:07~16:37',3:'한국사 14:50~15:20 · 탐구1 15:35~16:05 · 탐구2 16:07~16:37'},teachers:HOMEROOM}
    ]
  }];
  const S={date:DAYS[0]?.date||'',query:''};
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const className=index=>`${Math.floor(index/10)+1}-${index%10+1}`;
  const normalized=value=>String(value||'').replace(/\s/g,'').toLowerCase();
  const queries=()=>S.query.split(/[,\s]+/).map(normalized).filter(Boolean);
  const matches=value=>{const q=queries();return !q.length||q.some(term=>normalized(value).includes(term));};
  const displayDate=value=>{const d=new Date(`${value}T00:00:00`);return `${d.getMonth()+1}월 ${d.getDate()}일`};
  function assignmentTime(period,index){const grade=Math.floor(index/10)+1;return period.gradeTimes?.[grade]||period.time;}
  function searchResults(day){const q=queries();if(!q.length)return'';const rows=[];day.periods.forEach(period=>period.teachers.forEach((teacher,index)=>{if(matches(teacher))rows.push({teacher,room:className(index),period:period.period,subject:period.subject,time:assignmentTime(period,index)});}));return `<section class="exam-search-results"><h3><i class="fas fa-magnifying-glass"></i> 검색 결과 <span>${rows.length}건</span></h3>${rows.length?`<div>${rows.map(row=>`<article><strong>${esc(row.teacher)}</strong><b>${esc(row.period)} · ${esc(row.subject)}</b><span>${esc(row.room)} 고사실</span><time>${esc(row.time)}</time></article>`).join('')}</div>`:'<p>일치하는 감독 배정이 없습니다.</p>'}</section>`;}
  function periodCard(period){const queryActive=queries().length>0;return `<section class="exam-period-card"><header><div><span>${esc(period.period)}</span><h3>${esc(period.subject)} ${period.duration?`<small>${esc(period.duration)}</small>`:''}</h3></div><time>${esc(period.time)}</time></header><div class="exam-grade-groups">${[1,2,3].map(grade=>`<div class="exam-grade-group"><div class="exam-grade-heading"><b>${grade}학년</b>${period.gradeTimes?.[grade]?`<span>${esc(period.gradeTimes[grade])}</span>`:''}</div><div class="exam-room-grid">${period.teachers.slice((grade-1)*10,grade*10).map((teacher,offset)=>{const room=`${grade}-${offset+1}`,match=matches(teacher);return `<article class="exam-room ${queryActive?(match?'is-match':'is-muted'):''}"><span>${room}</span><strong>${esc(teacher)}</strong></article>`;}).join('')}</div></div>`).join('')}</div></section>`;}
  function render(){const root=document.getElementById('examSupervisionRoot');if(!root)return;if(!DAYS.length){root.innerHTML='<div class="exam-empty"><i class="fas fa-calendar-xmark"></i><p>등록된 시험 감독 일정이 없습니다.</p></div>';return;}const day=DAYS.find(item=>item.date===S.date)||DAYS[0];S.date=day.date;root.innerHTML=`<div class="exam-shell"><header class="exam-hero"><div><span class="exam-kicker">EXAM SUPERVISION</span><h2><i class="fas fa-clipboard-user"></i> 감독시간표</h2><p>시험이 있는 날짜만 표시됩니다. 교사 이름을 검색하면 해당 감독 시간과 고사실을 바로 확인할 수 있습니다.</p></div><div class="exam-date-badge"><strong>${displayDate(day.date)}</strong><span>${esc(day.day)}</span></div></header><div class="exam-controls"><div class="exam-date-tabs">${DAYS.map(item=>`<button class="${item.date===day.date?'active':''}" onclick="selectExamSupervisionDate('${item.date}')"><span>${displayDate(item.date)}</span><small>${esc(item.title)}</small></button>`).join('')}</div><label class="exam-search"><i class="fas fa-search"></i><input value="${esc(S.query)}" oninput="searchExamSupervision(this.value)" placeholder="교사 이름 검색 (쉼표로 여러 명 검색)" autocomplete="off"><button type="button" onclick="searchExamSupervision('')" aria-label="검색 초기화"><i class="fas fa-times"></i></button></label></div>${searchResults(day)}<div class="exam-day-title"><div><h2>${esc(day.title)}</h2><p>${displayDate(day.date)} (${esc(day.day)})</p></div><span>총 ${day.periods.length}개 교시</span></div><div class="exam-period-list">${day.periods.map(periodCard).join('')}</div><p class="exam-source-note"><i class="fas fa-circle-info"></i> 2026년 9월 학력평가 감독표 기준 · 변경 사항은 일과 담당선생님에게 확인해 주세요.</p></div>`;}
  window.renderExamSupervision=render;
  window.selectExamSupervisionDate=date=>{S.date=date;render();};
  window.searchExamSupervision=value=>{S.query=String(value||'');render();requestAnimationFrame(()=>{const input=document.querySelector('.exam-search input');if(input){input.focus();input.setSelectionRange(input.value.length,input.value.length);}});};
})();
