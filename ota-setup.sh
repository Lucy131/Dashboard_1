#!/bin/bash
# ============================================================
#  DAKBoard OTA 한-방 등록 스크립트
#  사용:  bash ota-setup.sh
#  - 이 폴더를 git 저장소로 만들고, 아래 REPO 로 push 합니다.
#  - 한 번만 실행하면 됩니다. 이후엔 자동 업데이트 타이머가 처리.
#  - 다른 저장소를 쓰려면:  bash ota-setup.sh <git-주소>
# ============================================================
set -e
APPDIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APPDIR"

# 기본 저장소 (필요하면 이 줄만 고치면 됩니다)
REPO="${1:-https://github.com/Lucy131/Dashboard_1.git}"

VER=$(grep -o '"version"[^,]*' version.json 2>/dev/null | head -1 | grep -o '[0-9][0-9.]*' || echo "init")

echo "▶ OTA 등록 시작 → $REPO  (버전 $VER)"

# git 준비
if [ ! -d .git ]; then git init -q; fi
git add -A
git commit -q -m "DAKBoard $VER" || echo "  (커밋할 변경 없음 — 계속)"
git branch -M main

# 원격 연결 (이미 있으면 교체)
if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$REPO"
else
  git remote add origin "$REPO"
fi

# 자격증명 영구 저장: 토큰을 '한 번만' 입력하면 이후 push/자동 pull 모두 재입력 불필요
git config --global credential.helper store

# 토큰 파일 자동 읽기: github-token.txt 에 GH_USER / GH_TOKEN 을 적어두면 입력 없이 진행
#   (이 파일은 .gitignore 에 있어 저장소에 올라가지 않습니다)
if [ -z "$GH_USER" ] && [ -f "$APPDIR/github-token.txt" ]; then
  GH_USER=$(grep -i '^GH_USER' "$APPDIR/github-token.txt" | head -1 | cut -d= -f2- | tr -d ' "\r')
  GH_TOKEN=$(grep -i '^GH_TOKEN' "$APPDIR/github-token.txt" | head -1 | cut -d= -f2- | tr -d ' "\r')
  [ -n "$GH_TOKEN" ] && echo "  github-token.txt 에서 토큰을 읽었습니다."
fi

# 환경변수 또는 토큰 파일로 받은 자격증명을 저장
if [ -n "$GH_USER" ] && [ -n "$GH_TOKEN" ]; then
  HOST=$(echo "$REPO" | sed -E 's#https://([^/]+)/.*#\1#')
  printf 'https://%s:%s@%s\n' "$GH_USER" "$GH_TOKEN" "$HOST" > "$HOME/.git-credentials"
  chmod 600 "$HOME/.git-credentials"
  echo "  자격증명 저장됨 (재입력 없이 진행)"
fi

echo "▶ GitHub 로 업로드 (최초 1회만 사용자명 + Personal Access Token 입력 → 이후 자동 저장)…"
git push -u origin main

echo ""
echo "✅ OTA 등록 완료!"
echo "   - 토큰이 저장되어 다음부터는 재입력 없이 자동으로 받아옵니다."
echo "   - 이후 파이는 매일 새벽 4:30 + 부팅 2분 후 자동으로 새 버전을 받아옵니다."
echo "   - 설정창 하단에서 '지금 업데이트'로 즉시 적용도 가능합니다."
echo "   - 자동 업데이트 타이머가 아직 없다면:  bash install.sh  를 한 번 실행하세요."
