/* ============================================================
   DAKBoard 설정 견본 (config.example.js)
   ------------------------------------------------------------
   이 파일은 "견본"입니다. 실제 값은 여기 적지 말고,
   이 파일을 복사해 config.js 로 만든 뒤 그 안에 채우세요.
     cp config.example.js config.js   (또는 install.sh 가 자동 복사)
   config.js 는 .gitignore 로 보호되어 GitHub 에 올라가지 않습니다.
   ============================================================ */
window.DAK_CONFIG = {

  // 🌤️  날씨 위치
  weather: {
    name: "서울",
    sub:  "대한민국",
    lat:  37.5665,
    lon:  126.978
  },

  // ✅  할 일 (Google Sheets "웹에 게시 → CSV" 링크)
  todo: {
    sheetUrl: "",                 // 예: https://docs.google.com/.../pub?gid=0&single=true&output=csv
    names:    "시윤, 하나, 공동"    // 담당자 색상 순서 (쉼표 구분)
  },

  // 📅  캘린더 (Google Calendar · 공개 캘린더 + API 키)
  calendar: {
    apiKey: "",                   // Google Cloud → Calendar API → API 키
    id:     ""                    // 캘린더 설정 → 캘린더 통합 → 캘린더 ID
  },

  // 🎂  생일·기념일 시트 (게시 CSV). 머리글: 유형 · 이름 · 날짜 · 양력/음력
  birthdaySheet: "",

  // 🔁  반복 일정(규칙) 시트 (게시 CSV). 머리글: 제목 · 규칙
  recurringSheet: "",

  // 🖥️  화면 표시  mode: "auto" | "manual",  zoom: 1 = 100%
  display: { mode: "auto", w: 0, h: 0, zoom: 1 }
};

/* ---- 아래는 건드리지 마세요: 위 값을 화면에 적용하는 코드 ---- */
(function seedConfig(){
  try{
    var c = window.DAK_CONFIG || {};
    function seed(key, val){
      if(val!=null && val!=="" && !localStorage.getItem(key)){
        localStorage.setItem(key, val);
      }
    }
    if(c.weather && c.weather.lat!=null){
      seed('dak.loc', JSON.stringify({
        name:c.weather.name, sub:c.weather.sub, lat:c.weather.lat, lon:c.weather.lon
      }));
    }
    if(c.todo){
      seed('dak.todo.sheetUrl', c.todo.sheetUrl);
      seed('dak.todo.names',    c.todo.names);
    }
    if(c.calendar){
      seed('dak.cal.key', c.calendar.apiKey);
      seed('dak.cal.id',  c.calendar.id);
    }
  }catch(e){ /* localStorage 불가 환경에서도 화면은 동작 */ }
})();
