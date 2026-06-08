#!/bin/bash
# ============================================================
#  DAKBoard 화면 켜기/끄기 (디스플레이 전원)
#  사용:  bash screen.sh off   |   bash screen.sh on
#  - Wayland(wlr-randr) / 펌웨어(vcgencmd) / X11(xset) 순서로 시도
#  - cron 에서 호출되도록 디스플레이 환경변수를 직접 세팅
# ============================================================
ACT="${1:-on}"
export XDG_RUNTIME_DIR="/run/user/$(id -u)"

# 1) Wayland (Raspberry Pi OS Bookworm: labwc / wayfire)
if command -v wlr-randr >/dev/null 2>&1; then
  for wd in $(ls "$XDG_RUNTIME_DIR" 2>/dev/null | grep -E '^wayland-[0-9]+$'); do
    export WAYLAND_DISPLAY="$wd"
    OUT=$(wlr-randr 2>/dev/null | awk 'NR==1{print $1; exit}')
    if [ -n "$OUT" ]; then
      if [ "$ACT" = "off" ]; then wlr-randr --output "$OUT" --off; else wlr-randr --output "$OUT" --on; fi
      exit 0
    fi
  done
fi

# 2) 펌웨어 (구형 스택 / KMS 일부)
if command -v vcgencmd >/dev/null 2>&1; then
  if [ "$ACT" = "off" ]; then vcgencmd display_power 0; else vcgencmd display_power 1; fi
  exit 0
fi

# 3) X11 DPMS (Bullseye 등)
if command -v xset >/dev/null 2>&1; then
  export DISPLAY="${DISPLAY:-:0}"
  if [ "$ACT" = "off" ]; then
    xset dpms force off
  else
    xset dpms force on; xset s reset
  fi
  exit 0
fi

echo "[screen.sh] 디스플레이 제어 도구를 찾지 못했습니다 (wlr-randr/vcgencmd/xset)."
exit 1
