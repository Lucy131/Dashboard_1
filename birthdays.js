/* ============================================================
   DAKBoard · Birthdays / Anniversaries (solar + Korean lunar)
   - User-entered birthdays, stored in localStorage 'dak.birthdays'
   - Each: { name, month, day, cal:'solar'|'lunar' }
   - Lunar entries are converted to the correct SOLAR date for each
     displayed year using a Korean lunar table (1900–2100).
   - Exposes window.getBirthdayEvents(start, days) -> { 'Y-M-D':[{...}] }
     which calendar.js merges into its grid (works in demo + live).
   ============================================================ */
(function(){
  'use strict';

  const KEY='dak.birthdays';

  /* ---------- Korean lunar table (1900–2100) ---------- */
  // Each entry packs leap-month + month-length info for one lunar year.
  const L=[
    0x04bd8,0x04ae0,0x0a570,0x054d5,0x0d260,0x0d950,0x16554,0x056a0,0x09ad0,0x055d2,//1900
    0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977,//1910
    0x04970,0x0a4b0,0x0b4b5,0x06a50,0x06d40,0x1ab54,0x02b60,0x09570,0x052f2,0x04970,//1920
    0x06566,0x0d4a0,0x0ea50,0x06e95,0x05ad0,0x02b60,0x186e3,0x092e0,0x1c8d7,0x0c950,//1930
    0x0d4a0,0x1d8a6,0x0b550,0x056a0,0x1a5b4,0x025d0,0x092d0,0x0d2b2,0x0a950,0x0b557,//1940
    0x06ca0,0x0b550,0x15355,0x04da0,0x0a5b0,0x14573,0x052b0,0x0a9a8,0x0e950,0x06aa0,//1950
    0x0aea6,0x0ab50,0x04b60,0x0aae4,0x0a570,0x05260,0x0f263,0x0d950,0x05b57,0x056a0,//1960
    0x096d0,0x04dd5,0x04ad0,0x0a4d0,0x0d4d4,0x0d250,0x0d558,0x0b540,0x0b5a0,0x195a6,//1970
    0x095b0,0x049b0,0x0a974,0x0a4b0,0x0b27a,0x06a50,0x06d40,0x0af46,0x0ab60,0x09570,//1980
    0x04af5,0x04970,0x064b0,0x074a3,0x0ea50,0x06b58,0x055c0,0x0ab60,0x096d5,0x092e0,//1990
    0x0c960,0x0d954,0x0d4a0,0x0da50,0x07552,0x056a0,0x0abb7,0x025d0,0x092d0,0x0cab5,//2000
    0x0a950,0x0b4a0,0x0baa4,0x0ad50,0x055d9,0x04ba0,0x0a5b0,0x15176,0x052b0,0x0a930,//2010
    0x07954,0x06aa0,0x0ad50,0x05b52,0x04b60,0x0a6e6,0x0a4e0,0x0d260,0x0ea65,0x0d530,//2020
    0x05aa0,0x076a3,0x096d0,0x04bd7,0x04ad0,0x0a4d0,0x1d0b6,0x0d250,0x0d520,0x0dd45,//2030
    0x0b5a0,0x056d0,0x055b2,0x049b0,0x0a577,0x0a4b0,0x0aa50,0x1b255,0x06d20,0x0ada0,//2040
    0x14b63,0x09370,0x049f8,0x04970,0x064b0,0x168a6,0x0ea50,0x06b20,0x1a6c4,0x0aae0,//2050
    0x0a2e0,0x0d2e3,0x0c960,0x0d557,0x0d4a0,0x0da50,0x05d55,0x056a0,0x0a6d0,0x055d4,//2060
    0x052d0,0x0a9b8,0x0a950,0x0b4a0,0x0b6a6,0x0ad50,0x055a0,0x0aba4,0x0a5b0,0x052b0,//2070
    0x0b273,0x06930,0x07337,0x06aa0,0x0ad50,0x14b55,0x04b60,0x0a570,0x054e4,0x0d160,//2080
    0x0e968,0x0d520,0x0daa0,0x16aa6,0x056d0,0x04ae0,0x0a9d4,0x0a2d0,0x0d150,0x0f252,//2090
    0x0d520//2100
  ];
  const BASE_YEAR=1900;
  function leapMonth(y){ return L[y-BASE_YEAR]&0xf; }                 // 0 = no leap
  function monthDays(y,m){ return (L[y-BASE_YEAR]&(0x10000>>m))?30:29; }
  function leapDays(y){ return leapMonth(y)?((L[y-BASE_YEAR]&0x10000)?30:29):0; }
  function lYearDays(y){
    let sum=348; // 12 * 29
    for(let i=0x8000;i>0x8;i>>=1) sum+=(L[y-BASE_YEAR]&i)?1:0;
    return sum+leapDays(y);
  }
  // lunar (year,month,day) [+ isLeap] -> solar Date
  function lunarToSolar(y,m,d,isLeap){
    if(y<BASE_YEAR||y>2100) return null;
    let offset=0;
    for(let i=BASE_YEAR;i<y;i++) offset+=lYearDays(i);
    const leap=leapMonth(y);
    for(let i=1;i<m;i++) offset+=monthDays(y,i);
    if(leap>0 && (m>leap)) offset+=leapDays(y);          // leap month already passed
    if(isLeap && leap===m) offset+=monthDays(y,m);       // target is the leap month itself
    // clamp day to month length
    const dim=(isLeap&&leap===m)?leapDays(y):monthDays(y,m);
    offset+=Math.min(d,dim)-1;
    return new Date(Date.UTC(1900,0,31)+offset*86400000);
  }

  /* ---------- storage ---------- */
  const SHEET_KEY='dak.bday.sheet';
  const CACHE_KEY='dak.bday.cache';
  function list(){
    try{ const v=JSON.parse(localStorage.getItem(KEY)||'[]'); return Array.isArray(v)?v:[]; }
    catch(_){ return []; }
  }
  function save(arr){ localStorage.setItem(KEY,JSON.stringify(arr)); }
  function sheetList(){
    try{ const v=JSON.parse(localStorage.getItem(CACHE_KEY)||'[]'); return Array.isArray(v)?v:[]; }
    catch(_){ return []; }
  }

  /* ---------- event text ---------- */
  function eventFor(b,year){
    const type=b.type||'생일';
    if(type==='기념일'){
      const emoji='🎉';
      if(b.year && year>b.year) return {text:(b.name||'')+' '+(year-b.year)+'주년', emoji};
      return {text:(b.name||'기념일')+' 기념일', emoji};
    }
    return {text:(b.name||'생일')+' 생일', emoji:'🎂'};
  }

  /* ---------- event generation (called by calendar.js) ---------- */
  window.getBirthdayEvents=function(start,days){
    const out={};
    const end=new Date(start); end.setDate(start.getDate()+days);
    const years=new Set([start.getFullYear(), end.getFullYear()]);
    const all=sheetList();
    for(const b of all){
      if(!b || !b.month || !b.day) continue;
      for(const y of years){
        let occ;
        if(b.cal==='lunar'){
          const u=lunarToSolar(y,b.month,b.day,false);
          if(!u) continue;
          occ=new Date(u.getUTCFullYear(),u.getUTCMonth(),u.getUTCDate());
        }else{
          occ=new Date(y,b.month-1,b.day);
        }
        if(occ>=start && occ<end){
          const k=`${occ.getFullYear()}-${occ.getMonth()+1}-${occ.getDate()}`;
          const e=eventFor(b,y);
          (out[k]=out[k]||[]).push({text:e.text, emoji:e.emoji, birthday:true});
        }
      }
    }
    return out;
  };

  /* ---------- Google Sheet (published CSV) ---------- */
  function csvUrl(u){
    u=(u||'').trim();
    if(!u) return '';
    if(/output=csv|tqx=out:csv|format=csv/.test(u)) return u;
    const m=u.match(/\/spreadsheets\/d\/(?:e\/)?([a-zA-Z0-9-_]+)/);
    if(m){ const g=u.match(/[#&?]gid=(\d+)/);
      return `https://docs.google.com/spreadsheets/d/${m[1]}/gviz/tq?tqx=out:csv`+(g?`&gid=${g[1]}`:''); }
    return u;
  }
  function parseCSV(text){
    const rows=[]; let row=[], f='', q=false;
    for(let i=0;i<text.length;i++){ const c=text[i];
      if(q){ if(c==='"'){ if(text[i+1]==='"'){f+='"';i++;} else q=false; } else f+=c; }
      else{ if(c==='"') q=true; else if(c===',') {row.push(f);f='';}
        else if(c==='\n'){row.push(f);rows.push(row);row=[];f='';}
        else if(c==='\r'){} else f+=c; } }
    if(f.length||row.length){ row.push(f); rows.push(row); }
    return rows;
  }
  const H={ type:['유형','종류','type','구분'], name:['이름','name','대상'],
    date:['날짜','일자','date','생일'], cal:['양력/음력','양력 / 음력','양력/음력','음양력','구분','solar/lunar','cal'] };
  function colIdx(header){
    const norm=header.map(h=>(h||'').trim().toLowerCase().replace(/\s+/g,''));
    const idx={};
    for(const key in H){ idx[key]=norm.findIndex(h=>H[key].some(a=>a.toLowerCase().replace(/\s+/g,'')===h)); }
    return idx;
  }
  function parseDate(s){
    const m=String(s).trim().match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})|(\d{1,2})\D+(\d{1,2})/);
    if(!m) return null;
    if(m[1]) return {year:+m[1], month:+m[2], day:+m[3]};
    return {year:null, month:+m[4], day:+m[5]};
  }
  function fromCSV(text){
    if(/^\s*</.test(text)) return null;
    const rows=parseCSV(text).filter(r=>r.some(c=>(c||'').trim()!==''));
    if(!rows.length) return [];
    const idx=colIdx(rows[0]);
    if(idx.name<0 || idx.date<0) return null;
    const out=[];
    for(let i=1;i<rows.length;i++){
      const r=rows[i];
      const name=(r[idx.name]||'').trim(); if(!name) continue;
      const d=parseDate(r[idx.date]||''); if(!d) continue;
      const calRaw=idx.cal>=0?(r[idx.cal]||'').trim():'';
      const cal=/음/.test(calRaw)?'lunar':'solar';
      const typeRaw=idx.type>=0?(r[idx.type]||'').trim():'';
      const type=/기념|주년|anniv/i.test(typeRaw)?'기념일':'생일';
      out.push({name, month:d.month, day:d.day, year:d.year, cal, type});
    }
    return out;
  }
  async function loadSheet(){
    const url=csvUrl(localStorage.getItem(SHEET_KEY)||'');
    if(!url){ setBStatus('시트 미연결','off'); return; }
    setBStatus('불러오는 중…','off');
    try{
      const r=await fetch(url,{redirect:'follow'});
      if(!r.ok) throw new Error('HTTP '+r.status);
      const items=fromCSV(await r.text());
      if(items===null) throw new Error('시트를 읽을 수 없습니다 (공유 설정 확인)');
      localStorage.setItem(CACHE_KEY, JSON.stringify(items));
      setBStatus('시트 연결됨 · '+items.length+'개', 'live');
      renderList(); refreshCal();
    }catch(e){
      setBStatus((e.message||'불러오기 실패')+' · 캐시 사용','err');
      renderList(); refreshCal();
    }
  }
  function setBStatus(text,state){
    const t=document.getElementById('bdayStatusText'); if(t)t.textContent=text;
    const d=document.querySelector('#bdayStatus .dot'); if(d)d.className='dot'+(state==='live'?'':state==='err'?' err':' off');
  }

  /* ---------- settings UI ---------- */
  let pendCal='solar';
  function fmt(b){
    const md=`${b.month}월 ${b.day}일`;
    return md;
  }
  function renderList(){
    const wrap=document.getElementById('bdayList'); if(!wrap) return;
    const sheet=sheetList();
    wrap.innerHTML=sheet.map(b=>`
      <div class="bday-row src">
        <span class="nm">${b.type==='기념일'?'🎉':'🎂'} ${esc(b.name||'')}</span>
        <span class="tag ${b.cal==='lunar'?'lunar':'solar'}">${b.cal==='lunar'?'음력':'양력'}</span>
        <span class="dt">${fmt(b)}</span>
      </div>`).join('');
  }
  function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
  function refreshCal(){ if(typeof window.refreshCalendar==='function') window.refreshCalendar(); }

  function fillSelects(){
    const mSel=document.getElementById('bdayMonth');
    const dSel=document.getElementById('bdayDay');
    if(mSel && !mSel.options.length){
      for(let m=1;m<=12;m++) mSel.add(new Option(m+'월',m));
    }
    if(dSel && !dSel.options.length){
      for(let d=1;d<=30;d++) dSel.add(new Option(d+'일',d));
    }
  }

  function wire(){
    renderList();
    // Google Sheet for birthdays
    const sheetInput=document.getElementById('bdaySheet');
    if(sheetInput) sheetInput.value=localStorage.getItem(SHEET_KEY)||'';
    const sheetBtn=document.getElementById('bdaySheetLoad');
    if(sheetBtn) sheetBtn.addEventListener('click',()=>{
      localStorage.setItem(SHEET_KEY,(sheetInput.value||'').trim());
      loadSheet();
    });
    if(sheetInput) sheetInput.addEventListener('keydown',e=>{
      if(e.key==='Enter'){ localStorage.setItem(SHEET_KEY,(sheetInput.value||'').trim()); loadSheet(); }
    });
  }

  /* ---------- seed from config.js (only if empty) ---------- */
  function seed(){
    try{
      const c=window.DAK_CONFIG;
      if(c && c.birthdaySheet && !localStorage.getItem(SHEET_KEY)){
        localStorage.setItem(SHEET_KEY, c.birthdaySheet);
      }
    }catch(_){}
  }

  function init(){
    seed(); wire(); refreshCal();
    if((localStorage.getItem(SHEET_KEY)||'').trim()) loadSheet();
    setInterval(()=>{ if((localStorage.getItem(SHEET_KEY)||'').trim()) loadSheet(); }, 30*60*1000);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
  else init();
})();
