# DAKBoard · 라즈베리 파이 키오스크 설치 가이드

부팅하면 자동으로 전체화면 대시보드가 뜨도록 설정합니다. (DAKBoard처럼)

이 폴더 구성
```
DAKBoard_app/
├─ DAKBoard.html        ← 메인 화면
├─ config.js            ← ⭐ 설정 파일 (위치·시트·캘린더 — 이 파일만 고치면 됨)
├─ todo.js              ← 할 일(구글 시트)
├─ calendar.js          ← 캘린더(구글 캘린더 + 공휴일)
├─ photos/              ← 배경 슬라이드쇼 사진
├─ install.sh           ← 원-커맨드 설치
├─ update.sh            ← OTA 업데이트
├─ start-kiosk.sh       ← 키오스크 실행 스크립트
└─ dakboard-server.service ← 자동 실행용 서버
```

전제: **Raspberry Pi OS (Desktop 버전)** 설치 + 인터넷 연결(Wi‑Fi/유선). 화면은 **세로(9:16)** 로 쓰는 디자인입니다.

---

## ⚡ 빠른 설치 (원-커맨드)
표준 Raspberry Pi OS를 깐 뒤, 이 폴더를 파이에 복사하고 폴더 안에서:
```bash
bash install.sh
```
→ 패키지·한글폰트 설치, 로컬서버 자동실행, 부팅 시 키오스크 자동실행, 절전 끄기까지 한 번에 처리합니다.
남는 건 **화면 세로 회전(수동)** 과 `sudo reboot` 뿐입니다.

> 아래 2)~5) 는 install.sh 가 자동으로 하는 일을 수동으로 하거나 문제를 점검할 때 참고하세요.

---

## 🔧 설정 파일 (config.js)
위치·할 일 시트·캘린더 값은 **`config.js`** 한 파일에 모여 있습니다. 이 파일을 텍스트 편집기로 열어 수정하면 됩니다:
```js
window.DAK_CONFIG = {
  weather:  { name:"서울", sub:"대한민국", lat:37.5665, lon:126.978 },
  todo:     { sheetUrl:"…/pub?output=csv", names:"시윤, 하나, 공동" },
  calendar: { apiKey:"…", id:"…@group.calendar.google.com" }
};
```
- 처음 부팅 시 이 값으로 자동 채워집니다 — 화면에서 손으로 입력할 필요가 없습니다.
- 화면의 ⚙ 에서 바꾼 값은 브라우저에 저장되어 **우선** 적용됩니다. 파일 값으로 되돌리려면 ⚙ 의 값을 지우세요.
- 이 파일은 OTA 업데이트로 **덮어쓰이지 않습니다**(개인 설정 보호).

---

## 1) 파일 복사
이 `DAKBoard_app` 폴더를 라즈베리 파이의 홈에 둡니다. 예: `/home/pi/DAKBoard_app`
(사용자명이 pi가 아니면 아래 경로의 `pi`를 모두 본인 사용자명으로 바꾸세요.)

```bash
# 예: USB나 scp로 옮긴 뒤
ls /home/pi/DAKBoard_app   # DAKBoard.html 등이 보이면 OK
chmod +x /home/pi/DAKBoard_app/start-kiosk.sh
```

필요 패키지 설치:
```bash
sudo apt update
sudo apt install -y chromium-browser unclutter python3 fonts-noto-cjk
# (Bookworm 등에서 chromium-browser가 없으면) sudo apt install -y chromium
```

> **한글 폰트:** 화면은 온라인이면 Google Fonts의 **Noto Sans KR 웹폰트**를 자동으로 불러와 한글이 깨지지 않습니다. 위 `fonts-noto-cjk` 설치는 **오프라인/웹폰트 로드 실패 시 대비용**(시스템 한글 폰트)이니 함께 설치해 두는 것을 권장합니다.

---

## 2) 로컬 서버를 부팅 시 자동 실행
구글 캘린더/시트를 안정적으로 불러오려면 `file://` 대신 `http://localhost` 로 띄우는 것이 좋습니다.

```bash
sudo cp /home/pi/DAKBoard_app/dakboard-server.service /etc/systemd/system/
# 파일 안의 User= / WorkingDirectory= 가 본인 사용자·경로와 맞는지 확인/수정
sudo nano /etc/systemd/system/dakboard-server.service

sudo systemctl daemon-reload
sudo systemctl enable --now dakboard-server.service
# 확인: 브라우저에서 http://localhost:8000/DAKBoard.html 가 열리면 성공
```

---

## 3) 부팅 시 Chromium 키오스크 자동 실행

### 방법 A — Raspberry Pi OS **Bookworm** (Wayland/labwc, Pi 4·5 기본)
```bash
mkdir -p ~/.config/labwc
nano ~/.config/labwc/autostart
```
아래 한 줄 추가:
```
/home/pi/DAKBoard_app/start-kiosk.sh &
```
(Wayfire를 쓰는 경우엔 `~/.config/wayfire.ini` 의 `[autostart]` 섹션에
`dakboard = /home/pi/DAKBoard_app/start-kiosk.sh` 를 추가)

### 방법 B — 구버전 **Bullseye** (X11/LXDE)
```bash
nano ~/.config/lxsession/LXDE-pi/autostart
```
아래 내용 추가:
```
@xset s off
@xset -dpms
@xset s noblank
@/home/pi/DAKBoard_app/start-kiosk.sh
```

설정 후 재부팅:
```bash
sudo reboot
```

---

## 4) 화면 세로(Portrait) 회전
이 디자인은 세로 화면용입니다. 모니터를 세로로 두고 회전시키세요.

- **가장 쉬움:** 데스크톱 메뉴 → **기본 설정 → Screen Configuration**(화면 설정) → 해당 디스플레이 우클릭 → **Orientation → right(또는 left)** → 적용.
- 또는 `sudo raspi-config` → Display 옵션에서 회전.

---

## 5) 화면이 꺼지지 않게(절전 끄기)
- 데스크톱: **기본 설정 → Raspberry Pi Configuration → Display → Screen Blanking: Off**
- `start-kiosk.sh` 에 이미 `xset` 절전 해제가 들어 있습니다(X11 기준).

---

## 6) 설정값 입력 (최초 1회)
화면 우측 상단 **⚙ 설정** 에서:
- **위치**(날씨) — 도시 검색
- **할 일** — 구글 시트 "웹에 게시 → CSV" 링크
- **캘린더** — 이미 API 키·캘린더 ID가 내장되어 자동 연결됩니다(바꾸려면 여기서)

값은 브라우저에 저장되어 다음 부팅에도 유지됩니다.
(단, `--incognito` 로 띄우면 매번 초기화되니, 설정을 유지하려면 `start-kiosk.sh` 에서 `--incognito` 를 빼세요.)

---

## 7) 🔄 OTA 자동 업데이트 (선택)
이 폴더를 **GitHub 저장소**에 연결해두면, 새 버전을 push 했을 때 파이가 **자동으로 받아 적용**합니다. (매일 새벽 4:30 + 부팅 2분 후)

**최초 1회 설정:**
```bash
cd ~/DAKBoard_app
git init && git add . && git commit -m "initial"
git branch -M main
git remote add origin https://github.com/<사용자>/<저장소>.git
git push -u origin main
```
- `config.js`(개인 설정)는 `.gitignore` 에 있어 **올라가지도, 덮어쓰이지도 않습니다.**
- `install.sh` 를 실행했다면 자동 업데이트 타이머가 이미 등록돼 있습니다.
  (수동: `sudo systemctl enable --now dakboard-update.timer`)

**배포:** 새 버전을 저장소에 push → 파이가 다음 주기에 `git pull` → 화면 자동 새로고침.
즉시 적용은 파이에서 `bash ~/DAKBoard_app/update.sh`.

**확인:** `systemctl list-timers | grep dakboard`

> git 연결을 안 하면 OTA는 비활성이고, 기존처럼 새 zip으로 파일을 덮어써 업데이트하면 됩니다.

---

## 문제 해결
- **화면이 안 뜸:** `http://localhost:8000/DAKBoard.html` 가 브라우저에서 열리는지 먼저 확인 → 안 되면 2)의 서버 서비스 상태 점검: `systemctl status dakboard-server`
- **날씨/일정이 데모로만 나옴:** 인터넷 연결 확인. 캘린더는 공개 설정 + API 키 필요(설정창 안내 참고).
- **사진이 안 보임:** `photos/` 폴더가 `DAKBoard.html` 과 같은 위치에 있는지 확인.
- **Chromium 실행 안 됨:** 실행 파일명이 `chromium` 인지 `chromium-browser` 인지 확인(`command -v chromium`).
