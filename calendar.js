/* ============================================================
   DAKBoard · Calendar (Google Calendar, read-only)
   - 6-week rolling grid from Sunday of the current week
   - Events from a PUBLIC Google Calendar via API key (no OAuth)
   - Korean public holidays auto-loaded from Google's holiday
     calendar with the same key, shown in red
   - Event color by assignee (title prefix "이름 …"), consistent
     with the Todo name palette (localStorage 'dak.todo.names')
   - Falls back to DEMO events when no key configured / fetch fails
   ============================================================ */
(function(){
  'use strict';

  const KEY_KEY='dak.cal.key';
  const ID_KEY ='dak.cal.id';
  const NAMES_KEY='dak.todo.names';
  const HOLIDAY_CAL='ko.south_korea#holiday@group.v.calendar.google.com';

  // 설정값은 config.js → localStorage 로 주입됩니다 (코드에 키를 박지 않음)
  function getKey(){ return (localStorage.getItem(KEY_KEY)||'').trim(); }
  function getId(){ return (localStorage.getItem(ID_KEY)||'').trim(); }

  const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const PALETTE=[
    {bg:'#bfe1f6',fg:'#13334a'}, // blue
    {bg:'#f6cfe1',fg:'#4a1335'}, // pink
    {bg:'#cfe9d6',fg:'#143a22'}, // green
    {bg:'#efe2bf',fg:'#403213'}, // amber
    {bg:'#e0d4f6',fg:'#2c1a4a'}, // violet
  ];
  const NEUTRAL={bg:'#d8dde6',fg:'#2a2f3a'};
  const MAXPC=3; // events per cell

  function getNames(){
    const v=localStorage.getItem(NAMES_KEY);
    return (v||'시윤,하나,공동').split(',').map(s=>s.trim()).filter(Boolean);
  }
  // "[이름] 일정" → {who:'이름', text:'일정'} ; 대괄호 없으면 who=null
  function parseTitle(title){
    const m=String(title).match(/^\s*[\[\(\uff3b]\s*([^\]\)\uff3d]+?)\s*[\]\)\uff3d]\s*(.*)$/);
    if(m) return {who:m[1].trim(), text:(m[2].trim()||m[1].trim())};
    return {who:null, text:String(title)};
  }
  function colorFor(name){
    const names=getNames(); const i=names.indexOf(name);
    if(i>=0) return PALETTE[i%PALETTE.length];
    let h=0; for(let k=0;k<name.length;k++) h=(h*31+name.charCodeAt(k))>>>0;
    return PALETTE[h%PALETTE.length];
  }
  function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}

  /* ---------- DEMO fallback events ---------- */
  const DEMO={
    '2026-6-10':[{text:'[시윤] 급여일'}],
    '2026-6-11':[{text:'[하나] 생일'}],
    '2026-6-15':[{text:'[공동] 차량 할부 인출일'}],
    '2026-7-10':[{text:'[시윤] 급여일'}],
    '2026-7-15':[{text:'[공동] 차량 할부 인출일'}],
    '2026-7-17':[{text:'제헌절', holiday:true}],
  };

  /* ---------- grid ---------- */
  function gridStart(){
    const t=new Date(); const d=new Date(t.getFullYear(),t.getMonth(),t.getDate());
    d.setDate(d.getDate()-d.getDay()); return d;
  }
  function keyOf(d){ return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`; }

  let lastMap=DEMO;
  function render(map){
    lastMap=map;
    const grid=document.getElementById('calGrid'); if(!grid) return;
    const start=gridStart();
    const today=new Date(); today.setHours(0,0,0,0);
    // working copy + merge birthdays (solar + lunar) from birthdays.js
    const work={};
    for(const k in map) work[k]=map[k].slice();
    if(typeof window.getBirthdayEvents==='function'){
      try{
        const b=window.getBirthdayEvents(start,42);
        for(const k in b){ (work[k]=work[k]||[]).push.apply(work[k],b[k]); }
      }catch(_){}
    }
    if(typeof window.getRecurringEvents==='function'){
      try{
        const rc=window.getRecurringEvents(start,42);
        for(const k in rc){ (work[k]=work[k]||[]).push.apply(work[k],rc[k]); }
      }catch(_){}
    }
    let html='';
    for(let i=0;i<42;i++){
      const d=new Date(start); d.setDate(start.getDate()+i);
      const key=keyOf(d);
      const isToday=d.getTime()===today.getTime();
      const first=d.getDate()===1;
      const label=(i===0||first)?`<span class="mon">${MON[d.getMonth()]}</span> ${d.getDate()}`:`${d.getDate()}`;
      const all=work[key]||[];
      // holidays first, then birthdays, then others
      all.sort((a,b)=> (b.holiday?2:b.birthday?1:0)-(a.holiday?2:a.birthday?1:0));
      const shown=all.slice(0,MAXPC), extra=all.length-shown.length;
      let evs=shown.map(e=>{
        if(e.holiday) return `<div class="ev red">${esc(e.text)}</div>`;
        if(e.birthday) return `<div class="ev bday">${e.emoji||'\uD83C\uDF82'} ${esc(e.text)}</div>`;
        const p=parseTitle(e.text);
        const c=p.who?colorFor(p.who):NEUTRAL;
        return `<div class="ev" style="background:${c.bg};color:${c.fg}">${esc(p.text)}</div>`;
      }).join('');
      if(extra>0) evs+=`<div class="ev-more">+${extra}</div>`;
      html+=`<div class="cell${isToday?' today':''}"><span class="dnum">${label}${isToday?'<span class="today-tag">Today</span>':''}</span>${evs}</div>`;
    }
    grid.innerHTML=html;
  }
  // let birthdays.js trigger a re-render after edits
  window.refreshCalendar=function(){ render(lastMap); };

  /* ---------- status ---------- */
  function setStatus(text,state){
    const t=document.getElementById('calStatusText'); if(t)t.textContent=text;
    const d=document.querySelector('#calStatus .dot'); if(d)d.className='dot'+(state==='live'?'':state==='err'?' err':' off');
  }

  /* ---------- Google Calendar fetch ---------- */
  function rangeISO(){
    const s=gridStart();
    const e=new Date(s); e.setDate(s.getDate()+42);
    return {min:s.toISOString(), max:e.toISOString()};
  }
  async function fetchCal(key,calId,min,max){
    const u=`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`
      +`?key=${encodeURIComponent(key)}&singleEvents=true&orderBy=startTime`
      +`&timeMin=${encodeURIComponent(min)}&timeMax=${encodeURIComponent(max)}&maxResults=250`;
    const r=await fetch(u);
    if(!r.ok){ let m='HTTP '+r.status; try{const j=await r.json(); if(j.error&&j.error.message)m=j.error.message;}catch(_){} throw new Error(m); }
    const j=await r.json();
    return j.items||[];
  }
  // place an event onto every grid date it spans
  function addEvent(map,startD,endExclusive,text,holiday){
    const gs=gridStart(); const ge=new Date(gs); ge.setDate(gs.getDate()+42);
    let d=new Date(startD); d.setHours(0,0,0,0);
    const end=new Date(endExclusive);
    while(d<end){
      if(d>=gs && d<ge){ const k=keyOf(d); (map[k]=map[k]||[]).push({text,holiday}); }
      d.setDate(d.getDate()+1);
    }
  }
  function ingest(map,items,holiday){
    for(const ev of items){
      if(ev.status==='cancelled') continue;
      const text=ev.summary||'(제목 없음)';
      if(ev.start&&ev.start.date){
        // all-day; end.date is exclusive
        const s=new Date(ev.start.date+'T00:00');
        const e=ev.end&&ev.end.date?new Date(ev.end.date+'T00:00'):new Date(s.getTime()+86400000);
        addEvent(map,s,e,text,holiday);
      }else if(ev.start&&ev.start.dateTime){
        const s=new Date(ev.start.dateTime);
        const day=new Date(s.getFullYear(),s.getMonth(),s.getDate());
        addEvent(map,day,new Date(day.getTime()+86400000),text,holiday);
      }
    }
  }

  async function load(){
    const key=getKey();
    const calId=getId();
    if(!key||!calId){ setStatus('데모 일정 표시 중','off'); render(DEMO); return; }
    setStatus('불러오는 중…','off');
    const {min,max}=rangeISO();
    const map={};
    let n=0, holErr=false;
    try{
      const items=await fetchCal(key,calId,min,max);
      ingest(map,items,false); n=items.length;
    }catch(e){
      render(DEMO);
      setStatus((e.message||'불러오기 실패')+' · 데모 표시 중','err');
      return;
    }
    // Korean holidays (best-effort; uses same key)
    try{
      const hol=await fetchCal(key,HOLIDAY_CAL,min,max);
      ingest(map,hol,true);
    }catch(_){ holErr=true; }
    render(map);
    setStatus('연결됨 · '+n+'개 일정'+(holErr?' (공휴일 로드 실패)':' · 공휴일 포함'),'live');
  }

  /* ---------- wire ---------- */
  function wire(){
    const k=document.getElementById('calKey');
    const id=document.getElementById('calId');
    if(k) k.value=localStorage.getItem(KEY_KEY)||'';
    if(id) id.value=localStorage.getItem(ID_KEY)||'';
    const btn=document.getElementById('calLoad');
    if(btn) btn.addEventListener('click',()=>{
      localStorage.setItem(KEY_KEY,(k.value||'').trim());
      localStorage.setItem(ID_KEY,(id.value||'').trim());
      load();
    });
    const onEnter=e=>{ if(e.key==='Enter') btn&&btn.click(); };
    if(k) k.addEventListener('keydown',onEnter);
    if(id) id.addEventListener('keydown',onEnter);
  }

  /* ---------- init ---------- */
  function init(){
    wire();
    render(DEMO);
    if(getKey() && getId()) load();
    setInterval(load, 15*60*1000);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
  else init();
})();
