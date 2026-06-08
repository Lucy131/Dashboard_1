#!/bin/bash
# ============================================================
#  DAKBoard OTA 업데이트
#  - 이 폴더가 git 저장소면 최신 버전을 받아 화면을 새로고침합니다.
#  - config.js(개인 설정)는 .gitignore 로 보호되어 덮어쓰이지 않습니다.
#  사용: bash update.sh      (또는 systemd 타이머가 매일 자동 실행)
# ============================================================
set -e
APPDIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APPDIR"

if [ ! -d .git ]; then
  echo "ℹ️  아직 git 저장소가 아닙니다. OTA를 쓰려면 README의 'OTA 자동 업데이트' 설정을 먼저 하세요."
  exit 0
fi

echo "▶ 업데이트 확인 중..."
git fetch --quiet origin
LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse @{u} 2>/dev/null || echo "$LOCAL")

if [ "$LOCAL" = "$REMOTE" ]; then
  echo "✅ 이미 최신 버전입니다."
  exit 0
fi

echo "▶ 새 버전 발견 → 적용 중..."
git pull --quiet --ff-only || { echo "⚠️ 자동 병합 실패(로컬 수정 충돌). 수동 확인 필요."; exit 1; }

# 화면은 페이지가 스스로 새 버전을 감지해 자동 새로고침합니다(최대 10분).
# (크로미움을 강제 종료하지 않음 — 타이머가 디스플레이 없이 실행될 때 검은 화면 방지)
echo "✅ 업데이트 완료. 화면은 곧 자동으로 새로고침됩니다."
