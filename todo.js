/* ============================================================
   DAKBoard · Todo (Google Sheets, read-only mirror)
   - Reads tasks from a shared Google Sheet (no key, no login; CORS-ok)
   - Columns (header row, any order): 할일 / 담당자 / 우선순위 / 완료 / 완료일
   - Display only: completed sink to bottom & dim
   - priority(높음/⭐/p1) -> star ; assignee -> colored chip
   - Completed items with a past 완료일 auto-cleared at Sunday 00:00
   - Falls back to DEMO data when no sheet configured / fetch fails
   ============================================================ */
(function(){
  'use strict';

  const SHEET_KEY='dak.todo.sheetUrl';
  const NAMES_KEY='dak.todo.names';

  const PALETTE=[
    {bg:'#bfe1f6',fg:'#13334a'}, // blue
    {bg:'#f6cfe1',fg:'#4a1335'}, // pink
    {bg:'#cfe9d6',fg:'#143a22'}, // green
    {bg:'#efe2bf',fg:'#403213'}, // amber
    {bg:'#e0d4f6',fg:'#2c1a4a'}, // violet
  ];
  function getNames(){
    const v=localStorage.getItem(NAMES_KEY);
    return (v||'시윤,하나,공동').split(',').map(s=>s.trim()).filter(Boolean);
  }
  function colorFor(name){
    const i=getNames().indexOf(name);
    if(i>=0) return PALETTE[i%PALETTE.length];
    let h=0; for(let k=0;k<name.length;k++) h=(h*31+name.charCodeAt(k))>>>0;
    return PALETTE[h%PALETTE.length];
  }
  function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}

  /* ---------- DEMO data (normalized items) ---------- */
  const now=Date.now();
  const DEMO=[
    {who:'시윤', text:'중문 자석 도면 수정',                star:true,  done:false, completedAt:null},
    {who:null,  text:'이케아 구매 목록 : 뒷 베란다 철장 스탠드', star:false, done:false, completedAt:null},
    {who:'지안', text:'어린이집 준비물 챙기기',             star:false, done:false, completedAt:null},
    {who:null,  text:'재활용 분리수거 내놓기',              star:false, done:false, completedAt:null},
    {who:'시윤', text:'약 챙겨 먹기',                       star:false, done:true,  completedAt:now-2*3600*1000},
  ];

  /* ---------- render ---------- */
  function lastSundayMidnight(){
    const d=new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-d.getDay()); return d.getTime();
  }
  const CHECK=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 6"/></svg>`;
  const STAR =`<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 6.4 7 .6-5.3 4.6 1.6 6.9L12 17.3 5.7 20.5l1.6-6.9L2 9l7-.6z"/></svg>`;
  const MAX=7;
  let lastItems=DEMO;

  function render(items){
    lastItems=items;
    const el=document.getElementById('todo'); if(!el) return;
    const cutoff=lastSundayMidnight();
    let list=items.filter(t=> !t.done || (t.completedAt!=null && t.completedAt>=cutoff));
    list.sort((a,b)=> (a.done-b.done) || (b.star-a.star));
    if(!list.length){ el.innerHTML='<div class="empty">할 일이 없습니다 🎉</div>'; return; }
    const shown=list.slice(0,MAX), extra=list.length-shown.length;
    el.innerHTML = shown.map(t=>{
      const c=t.who?colorFor(t.who):null;
      const who=t.who?`<span class="who" style="background:${c.bg};color:${c.fg}">${esc(t.who)}</span>`:'';
      const star=(t.star&&!t.done)?`<span class="star">${STAR}</span>`:'';
      return `<div class="item${t.done?' done':''}"><span class="cb">${t.done?CHECK:''}</span>${star}<span class="txt">${esc(t.text)}${who}</span></div>`;
    }).join('') + (extra>0?`<div class="more">+${extra}개 더</div>`:'');
  }

  /* ---------- status chip ---------- */
  function setStatus(text,state){
    const t=document.getElementById('todoStatusText'); if(t)t.textContent=text;
    const d=document.querySelector('#todoStatus .dot'); if(d)d.className='dot'+(state==='live'?'':state==='err'?' err':' off');
  }

  /* ---------- CSV parsing ---------- */
  function parseCSV(text){
    const rows=[]; let row=[], field='', q=false;
    for(let i=0;i<text.length;i++){
      const c=text[i];
      if(q){
        if(c==='"'){ if(text[i+1]==='"'){field+='"';i++;} else q=false; }
        else field+=c;
      }else{
        if(c==='"') q=true;
        else if(c===',') { row.push(field); field=''; }
        else if(c==='\n'){ row.push(field); rows.push(row); row=[]; field=''; }
        else if(c==='\r'){}
        else field+=c;
      }
    }
    if(field.length||row.length){ row.push(field); rows.push(row); }
    return rows;
  }
  const COL={
    task:['할일','할 일','task','내용','일','content','title','제목'],
    who :['담당자','who','assignee','이름','name'],
    prio:['우선순위','priority','중요도','prio','p'],
    done:['완료','done','status','상태','체크','완료여부'],
    date:['완료일','completed','done_date','완료날짜','완료일자'],
  };
  function findCols(header){
    const norm=header.map(h=>(h||'').trim().toLowerCase());
    const idx={};
    for(const key in COL){ idx[key]=norm.findIndex(h=>COL[key].some(a=>a.toLowerCase()===h)); }
    return idx;
  }
  const STAR_RE=/^\s*(높음|상|high|p?1|★|⭐|중요|urgent|y|yes|true)\s*$/i;
  const DONE_RE=/^\s*(완료|done|y|yes|true|x|체크|✓|✔|o|1)\s*$/i;
  function fromCSV(text){
    // gviz/published returns CSV; if it's an HTML error page, bail
    if(/^\s*</.test(text)) return null;
    const rows=parseCSV(text).filter(r=>r.some(c=>(c||'').trim()!==''));
    if(rows.length<1) return [];
    const idx=findCols(rows[0]);
    if(idx.task<0) return null; // need at least a task column
    const items=[];
    for(let i=1;i<rows.length;i++){
      const r=rows[i];
      const text2=(r[idx.task]||'').trim();
      if(!text2) continue;
      const who=idx.who>=0?(r[idx.who]||'').trim()||null:null;
      const star=idx.prio>=0?STAR_RE.test(r[idx.prio]||''):false;
      const done=idx.done>=0?DONE_RE.test(r[idx.done]||''):false;
      let completedAt=null;
      if(idx.date>=0 && (r[idx.date]||'').trim()){
        const p=Date.parse((r[idx.date]||'').trim().replace(/\./g,'-').replace(/-+$/,''));
        if(!isNaN(p)) completedAt=p;
      }
      items.push({who, text:text2, star, done, completedAt});
    }
    return items;
  }

  /* ---------- normalize various sheet URLs -> candidate CSV endpoints ---------- */
  function csvCandidates(u){
    u=(u||'').trim();
    if(!u) return [];
    if(/output=csv|tqx=out:csv|format=csv/.test(u)) return [u];   // already a CSV endpoint
    const m=u.match(/\/spreadsheets\/d\/(?:e\/)?([a-zA-Z0-9-_]+)/);
    if(m){
      const id=m[1];
      const g=u.match(/[#&?]gid=(\d+)/); const gid=g?g[1]:null;
      const base=`https://docs.google.com/spreadsheets/d/${id}`;
      return [
        `${base}/gviz/tq?tqx=out:csv`+(gid?`&gid=${gid}`:''),
        `${base}/export?format=csv`+(gid?`&gid=${gid}`:''),
      ];
    }
    if(/^[a-zA-Z0-9-_]{20,}$/.test(u)) return [`https://docs.google.com/spreadsheets/d/${u}/gviz/tq?tqx=out:csv`];
    return [u];
  }

  /* ---------- load ---------- */
  async function load(){
    const raw=localStorage.getItem(SHEET_KEY)||'';
    const urls=csvCandidates(raw);
    if(!urls.length){ setStatus('데모 데이터 표시 중','off'); render(DEMO); return; }
    setStatus('불러오는 중…','off');
    let lastErr='불러오기 실패';
    for(const url of urls){
      try{
        const r=await fetch(url,{redirect:'follow'});
        if(!r.ok){ lastErr='HTTP '+r.status; continue; }
        const text=await r.text();
        const items=fromCSV(text);
        if(items===null){ lastErr='시트를 읽을 수 없습니다 (공유 설정 확인)'; continue; }
        render(items);
        setStatus('연결됨 · '+items.length+'개 항목','live');
        return;
      }catch(e){ lastErr=(e&&e.message)||'네트워크 오류'; }
    }
    render(DEMO);
    // CORS/redirect failure almost always = sheet isn't fully public
    const hint=/networkerror|failed|network|fetch/i.test(lastErr)
      ? '시트 접근 차단 — “웹에 게시 → CSV” 링크를 쓰세요'
      : lastErr;
    setStatus(hint+' · 데모 표시 중','err');
  }

  /* ---------- wire settings ---------- */
  function wire(){
    const sheetInput=document.getElementById('sheetUrl');
    const namesInput=document.getElementById('assigneeNames');
    if(sheetInput) sheetInput.value=localStorage.getItem(SHEET_KEY)||'';
    if(namesInput) namesInput.value=localStorage.getItem(NAMES_KEY)||'시윤, 하나, 공동';

    const loadBtn=document.getElementById('sheetLoad');
    if(loadBtn) loadBtn.addEventListener('click',()=>{
      localStorage.setItem(SHEET_KEY,(sheetInput.value||'').trim());
      load();
    });
    if(sheetInput) sheetInput.addEventListener('keydown',e=>{
      if(e.key==='Enter'){ localStorage.setItem(SHEET_KEY,(sheetInput.value||'').trim()); load(); }
    });
    if(namesInput) namesInput.addEventListener('input',()=>{
      localStorage.setItem(NAMES_KEY,namesInput.value);
      render(lastItems);
    });
  }

  /* ---------- init ---------- */
  function init(){
    wire();
    render(DEMO);
    if((localStorage.getItem(SHEET_KEY)||'').trim()) load();
    setInterval(load, 5*60*1000); // refresh + re-apply Sunday cleanup
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
  else init();
})();
