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

# 서버 코드(server.py)나 서비스가 바뀌었을 수 있으니 서버를 재시작
# (install.sh 가 sudoers 에 NOPASSWD 를 등록해 둠 → 비밀번호·재부팅 불필요)
sudo systemctl restart dakboard-server.service 2>/dev/null || true

# 화면은 페이지가 스스로 새 버전을 감지해 자동 새로고침합니다(최대 10분).
echo "✅ 업데이트 완료. 서버 재시작 + 화면 자동 새로고침."
