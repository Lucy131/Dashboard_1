/* ============================================================
   DAKBoard · Recurring events (rule-based, Google Sheet)
   - For complex repeats that aren't fixed dates, e.g.
     "매월 마지막 평일"(last weekday), "매월 25일", "매월 마지막 금요일",
     "매주 월요일", "매월 말일".
   - Sheet columns (header row): 제목 · 규칙 · (담당자, optional)
       제목: "[하나] 월급날"  규칙: "매월 마지막 평일"
   - Title may use [이름] brackets → colored by assignee (calendar.js).
   - Exposes window.getRecurringEvents(start, days) → {'Y-M-D':[{text}]}
     which calendar.js merges into the grid.
   ============================================================ */
(function(){
  'use strict';
  const SHEET_KEY='dak.recur.sheet';
  const CACHE_KEY='dak.recur.cache';
  const WD={'일':0,'월':1,'화':2,'수':3,'목':4,'금':5,'토':6};

  function rules(){
    try{ const v=JSON.parse(localStorage.getItem(CACHE_KEY)||'[]'); return Array.isArray(v)?v:[]; }
    catch(_){ return []; }
  }

  /* ---------- date helpers ---------- */
  function lastDayOfMonth(y,m){ return new Date(y,m+1,0).getDate(); }
  function lastWeekdayOfMonth(y,m){
    let d=new Date(y,m+1,0);
    while(d.getDay()===0||d.getDay()===6) d.setDate(d.getDate()-1);
    return d.getDate();
  }
  function firstWeekdayOfMonth(y,m){
    let d=new Date(y,m,1);
    while(d.getDay()===0||d.getDay()===6) d.setDate(d.getDate()+1);
    return d.getDate();
  }
  function nthWeekdayOfMonth(y,m,wd,n){ // n: 1..5 or 'last'
    if(n==='last'){
      let d=new Date(y,m+1,0);
      while(d.getDay()!==wd) d.setDate(d.getDate()-1);
      return d.getDate();
    }
    let d=new Date(y,m,1), c=0;
    while(d.getMonth()===m){
      if(d.getDay()===wd){ c++; if(c===n) return d.getDate(); }
      d.setDate(d.getDate()+1);
    }
    return null;
  }

  /* ---------- rule matcher ---------- */
  const NTH={'첫':1,'첫째':1,'1째':1,'둘째':2,'2째':2,'셋째':3,'3째':3,'넷째':4,'4째':4,'다섯째':5,'5째':5,'마지막':'last'};
  function matches(rule,d){
    const r=String(rule).replace(/\s+/g,'');
    if(!r) return false;
    const y=d.getFullYear(), m=d.getMonth(), dom=d.getDate(), dow=d.getDay();
    // 매주 X요일
    let mm=r.match(/매주(일|월|화|수|목|금|토)요일/);
    if(mm) return dow===WD[mm[1]];
    // N번째 X요일 (첫째~마지막)
    mm=r.match(/(첫째|첫|1째|둘째|2째|셋째|3째|넷째|4째|다섯째|5째|마지막)(일|월|화|수|목|금|토)요일/);
    if(mm){
      const t=nthWeekdayOfMonth(y,m,WD[mm[2]],NTH[mm[1]]);
      return t!=null && dom===t;
    }
    // 마지막/첫 평일(영업일)
    if(/마지막평일|마지막영업일|월말평일/.test(r)) return dom===lastWeekdayOfMonth(y,m);
    if(/첫평일|첫영업일|첫째평일|월초평일/.test(r)) return dom===firstWeekdayOfMonth(y,m);
    // 말일 / 마지막 날
    if(/말일|마지막날/.test(r)) return dom===lastDayOfMonth(y,m);
    // 매월 N일 (N>말일이면 말일로 clamp)
    mm=r.match(/(\d{1,2})일/);
    if(mm){ const n=+mm[1]; return dom===Math.min(n,lastDayOfMonth(y,m)); }
    return false;
  }

  /* ---------- event generation (called by calendar.js) ---------- */
  window.getRecurringEvents=function(start,days){
    const out={}; const list=rules();
    if(!list.length) return out;
    for(let i=0;i<days;i++){
      const d=new Date(start); d.setDate(start.getDate()+i);
      const key=`${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
      for(const it of list){
        if(it.rule && matches(it.rule,d)){
          (out[key]=out[key]||[]).push({text:it.text});
        }
      }
    }
    return out;
  };

  /* ---------- sheet (published CSV) ---------- */
  function csvUrl(u){
    u=(u||'').trim(); if(!u) return '';
    if(/output=csv|tqx=out:csv|format=csv/.test(u)) return u;
    const m=u.match(/\/spreadsheets\/d\/(?:e\/)?([a-zA-Z0-9-_]+)/);
    if(m){ const g=u.match(/[#&?]gid=(\d+)/);
      return `https://docs.google.com/spreadsheets/d/${m[1]}/gviz/tq?tqx=out:csv`+(g?`&gid=${g[1]}`:''); }
    return u;
  }
  function parseCSV(text){
    const rows=[]; let row=[],f='',q=false;
    for(let i=0;i<text.length;i++){ const c=text[i];
      if(q){ if(c==='"'){ if(text[i+1]==='"'){f+='"';i++;} else q=false; } else f+=c; }
      else{ if(c==='"') q=true; else if(c===',') {row.push(f);f='';}
        else if(c==='\n'){row.push(f);rows.push(row);row=[];f='';}
        else if(c==='\r'){} else f+=c; } }
    if(f.length||row.length){ row.push(f); rows.push(row); }
    return rows;
  }
  const H={ title:['제목','일정','이름','내용','title','name'],
            rule:['규칙','반복','주기','rule','repeat'],
            who:['담당자','who','assignee'] };
  function colIdx(header){
    const norm=header.map(h=>(h||'').trim().toLowerCase().replace(/\s+/g,''));
    const idx={}; for(const k in H){ idx[k]=norm.findIndex(h=>H[k].some(a=>a.toLowerCase().replace(/\s+/g,'')===h)); }
    return idx;
  }
  function fromCSV(text){
    if(/^\s*</.test(text)) return null;
    const rows=parseCSV(text).filter(r=>r.some(c=>(c||'').trim()!==''));
    if(!rows.length) return [];
    const idx=colIdx(rows[0]);
    if(idx.title<0 || idx.rule<0) return null;
    const out=[];
    for(let i=1;i<rows.length;i++){
      const r=rows[i];
      let title=(r[idx.title]||'').trim(); const rule=(r[idx.rule]||'').trim();
      if(!title||!rule) continue;
      if(idx.who>=0){ const w=(r[idx.who]||'').trim(); if(w && !/^\s*[\[\(\uff3b]/.test(title)) title=`[${w}] ${title}`; }
      out.push({text:title, rule});
    }
    return out;
  }
  function setStatus(text,state){
    const t=document.getElementById('recurStatusText'); if(t)t.textContent=text;
    const d=document.querySelector('#recurStatus .dot'); if(d)d.className='dot'+(state==='live'?'':state==='err'?' err':' off');
  }
  function refreshCal(){ if(typeof window.refreshCalendar==='function') window.refreshCalendar(); }

  async function load(){
    const url=csvUrl(localStorage.getItem(SHEET_KEY)||'');
    if(!url){ setStatus('시트 미연결','off'); return; }
    setStatus('불러오는 중…','off');
    try{
      const r=await fetch(url,{redirect:'follow'});
      if(!r.ok) throw new Error('HTTP '+r.status);
      const items=fromCSV(await r.text());
      if(items===null) throw new Error('시트를 읽을 수 없습니다 (머리글 확인)');
      localStorage.setItem(CACHE_KEY, JSON.stringify(items));
      setStatus('시트 연결됨 · '+items.length+'개 규칙','live');
      refreshCal();
    }catch(e){
      setStatus((e.message||'불러오기 실패')+' · 캐시 사용','err');
      refreshCal();
    }
  }

  function wire(){
    const inp=document.getElementById('recurSheet');
    if(inp) inp.value=localStorage.getItem(SHEET_KEY)||'';
    const btn=document.getElementById('recurLoad');
    if(btn) btn.addEventListener('click',()=>{ localStorage.setItem(SHEET_KEY,(inp.value||'').trim()); load(); });
    if(inp) inp.addEventListener('keydown',e=>{ if(e.key==='Enter'){ localStorage.setItem(SHEET_KEY,(inp.value||'').trim()); load(); } });
  }
  function seed(){
    try{ const c=window.DAK_CONFIG;
      if(c && c.recurringSheet && !localStorage.getItem(SHEET_KEY)) localStorage.setItem(SHEET_KEY,c.recurringSheet);
    }catch(_){}
  }
  function init(){ seed(); wire(); refreshCal();
    if((localStorage.getItem(SHEET_KEY)||'').trim()) load();
    setInterval(()=>{ if((localStorage.getItem(SHEET_KEY)||'').trim()) load(); }, 30*60*1000);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
  else init();
})();
