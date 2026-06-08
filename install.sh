#!/bin/bash
# ============================================================
#  DAKBoard 원-커맨드 설치 스크립트 (Raspberry Pi OS)
#  사용법:  이 폴더 안에서  bash install.sh
#  하는 일: 패키지·한글폰트 설치 → 로컬서버 자동실행 등록
#           → 부팅 시 Chromium 키오스크 자동실행 등록
#           → 화면 절전 끄기.  (화면 세로 회전만 수동)
# ============================================================
set -e
APPDIR="$(cd "$(dirname "$0")" && pwd)"
USER_NAME="$(whoami)"
echo "▶ DAKBoard 설치: $APPDIR  (사용자: $USER_NAME)"

# 1) 필요한 패키지 + 한글 폰트
echo "▶ 패키지 설치 중..."
sudo apt update
sudo apt install -y unclutter python3 fonts-noto-cjk fonts-noto-color-emoji || true
if ! command -v chromium-browser >/dev/null && ! command -v chromium >/dev/null; then
  sudo apt install -y chromium-browser || sudo apt install -y chromium || true
fi
chmod +x "$APPDIR/start-kiosk.sh"

# 2) 로컬 정적 서버를 systemd 서비스로 등록 (부팅 시 자동)
echo "▶ 로컬 서버 서비스 등록..."
sudo tee /etc/systemd/system/dakboard-server.service >/dev/null <<EOF
[Unit]
Description=DAKBoard local static server
After=network.target

[Service]
User=$USER_NAME
WorkingDirectory=$APPDIR
ExecStart=/usr/bin/python3 $APPDIR/server.py 8000
Restart=always

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now dakboard-server.service

# OTA 업데이트가 비밀번호·재부팅 없이 서버를 재시작할 수 있도록 허용
sudo tee /etc/sudoers.d/dakboard-restart >/dev/null <<EOF
$USER_NAME ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart dakboard-server.service, /bin/systemctl restart dakboard-server.service, /sbin/reboot, /usr/sbin/reboot
EOF
sudo chmod 440 /etc/sudoers.d/dakboard-restart

# 3) 부팅 시 Chromium 키오스크 자동실행 (labwc / wayfire / LXDE 모두 대응)
echo "▶ 키오스크 자동실행 등록..."
# labwc (Bookworm 기본)
mkdir -p "$HOME/.config/labwc"
grep -q start-kiosk.sh "$HOME/.config/labwc/autostart" 2>/dev/null || \
  echo "$APPDIR/start-kiosk.sh &" >> "$HOME/.config/labwc/autostart"
# wayfire (구형 Bookworm/Pi4)
if [ -f "$HOME/.config/wayfire.ini" ]; then
  grep -q start-kiosk.sh "$HOME/.config/wayfire.ini" 2>/dev/null || \
    printf "\n[autostart]\ndakboard = %s/start-kiosk.sh\n" "$APPDIR" >> "$HOME/.config/wayfire.ini"
fi
# LXDE (Bullseye / X11)
if [ -d "$HOME/.config/lxsession/LXDE-pi" ] || [ -f /etc/xdg/lxsession/LXDE-pi/autostart ]; then
  LXAUTO="$HOME/.config/lxsession/LXDE-pi/autostart"
  mkdir -p "$(dirname "$LXAUTO")"
  if ! grep -q start-kiosk.sh "$LXAUTO" 2>/dev/null; then
    {
      echo "@xset s off"
      echo "@xset -dpms"
      echo "@xset s noblank"
      echo "@$APPDIR/start-kiosk.sh"
    } >> "$LXAUTO"
  fi
fi

# 4) 개인 설정 파일 준비 (없으면 예시에서 복사)
if [ ! -f "$APPDIR/config.js" ] && [ -f "$APPDIR/config.example.js" ]; then
  cp "$APPDIR/config.example.js" "$APPDIR/config.js"
  echo "▶ config.js 생성됨 (개인 설정은 이 파일에서 수정)"
fi

# 5) OTA 자동 업데이트 타이머 (git 저장소일 때만 의미 있음)
echo "▶ 자동 업데이트 타이머 등록..."
chmod +x "$APPDIR/update.sh"
sudo tee /etc/systemd/system/dakboard-update.service >/dev/null <<EOF
[Unit]
Description=DAKBoard OTA update
After=network-online.target

[Service]
Type=oneshot
User=$USER_NAME
WorkingDirectory=$APPDIR
ExecStart=/bin/bash $APPDIR/update.sh
EOF
sudo tee /etc/systemd/system/dakboard-update.timer >/dev/null <<EOF
[Unit]
Description=Run DAKBoard OTA update daily

[Timer]
OnBootSec=2min
OnCalendar=*-*-* 04:30:00
Persistent=true

[Install]
WantedBy=timers.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now dakboard-update.timer

echo ""
echo "✅ 설치 완료!"
echo "   - 지금 바로 확인:  브라우저에서 http://localhost:8000/DAKBoard.html"
echo "   - 남은 1가지(수동):  화면을 '세로'로 회전"
echo "       기본 설정 → Screen Configuration → Orientation → right/left"
echo "   - 그런 다음:  sudo reboot   → 부팅 시 자동으로 전체화면 대시보드가 뜹니다."
echo ""
echo "   설정은 config.js 파일에 보관됩니다(또는 ⚙ 에서 입력)."
echo "   OTA: 이 폴더를 git 저장소로 연결하면 매일 새벽 4:30·부팅 2분 후 자동 업데이트됩니다."
echo "        (자세한 건 README 의 'OTA 자동 업데이트' 참고)"
