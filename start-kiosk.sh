#!/bin/bash
# DAKBoard 키오스크 실행 스크립트
# 로컬 정적 서버(http://localhost:8000)의 DAKBoard.html을 전체화면 Chromium으로 띄웁니다.

# 화면 절전/블랭킹 끄기 (X11 세션에서만 동작, Wayland은 무시됨)
xset s off 2>/dev/null
xset -dpms 2>/dev/null
xset s noblank 2>/dev/null

# 마우스 커서 숨기기 (설치되어 있으면)
unclutter -idle 0 2>/dev/null &

# Chromium 실행 파일 이름이 배포판마다 다름 (chromium-browser 또는 chromium)
BROWSER=$(command -v chromium-browser || command -v chromium)

"$BROWSER" \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --check-for-update-interval=31536000 \
  --password-store=basic \
  --use-mock-keychain \
  --incognito \
  "http://localhost:8000/DAKBoard.html"
