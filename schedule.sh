#!/bin/bash
# ============================================================
#  DAKBoard 화면 자동 켜기/끄기 스케줄 등록
#  사용:  bash schedule.sh <켜는시각> <끄는시각>
#  예:    bash schedule.sh 07:00 23:00     (07시 켜고, 23시 끔)
#  - cron 에 등록합니다. 다시 실행하면 시간만 갱신됩니다.
#  - 해제:  bash schedule.sh off
# ============================================================
APPDIR="$(cd "$(dirname "$0")" && pwd)"
chmod +x "$APPDIR/screen.sh"

# 기존 DAKBoard 스케줄 줄 제거
clean() { crontab -l 2>/dev/null | grep -v "# dakboard-screen"; }

if [ "$1" = "off" ] || [ "$1" = "disable" ]; then
  clean | crontab -
  echo "✅ 화면 자동 켜기/끄기 스케줄을 해제했습니다."
  exit 0
fi

ON="${1:-07:00}"
OFF="${2:-23:00}"

# HH:MM → 분/시 추출
on_h=${ON%%:*};  on_m=${ON##*:}
off_h=${OFF%%:*}; off_m=${OFF##*:}

if ! [[ "$on_h" =~ ^[0-9]+$ && "$on_m" =~ ^[0-9]+$ && "$off_h" =~ ^[0-9]+$ && "$off_m" =~ ^[0-9]+$ ]]; then
  echo "사용법: bash schedule.sh 07:00 23:00   (켜는시각  끄는시각)"
  exit 1
fi

{
  clean
  echo "$on_m $on_h * * * $APPDIR/screen.sh on   # dakboard-screen"
  echo "$off_m $off_h * * * $APPDIR/screen.sh off  # dakboard-screen"
} | crontab -

echo "✅ 등록 완료:  매일 $ON 켜짐 / $OFF 꺼짐"
echo "   확인:  crontab -l"
echo "   해제:  bash schedule.sh off"
echo "   지금 테스트:  bash screen.sh off   /   bash screen.sh on"
