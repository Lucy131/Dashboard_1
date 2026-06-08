@echo off
setlocal enabledelayedexpansion
REM ============================================================
REM  DAKBoard -> GitHub uploader (double-click to run)
REM  Reads github-token.txt (GH_USER / GH_TOKEN) if present.
REM  Place at: E:\02. ...\Dakboard_1\push.bat
REM ============================================================
cd /d "%~dp0"

set "REPO=https://github.com/Lucy131/Dashboard_1.git"
set "GH_USER="
set "GH_TOKEN="

if exist "github-token.txt" (
  for /f "usebackq tokens=1,* delims==" %%a in ("github-token.txt") do (
    if /i "%%a"=="GH_USER"  set "GH_USER=%%b"
    if /i "%%a"=="GH_TOKEN" set "GH_TOKEN=%%b"
  )
)
if defined GH_USER  set "GH_USER=%GH_USER: =%"
if defined GH_TOKEN set "GH_TOKEN=%GH_TOKEN: =%"

where git >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Git is not installed. Install from https://git-scm.com/download/win
  pause
  exit /b 1
)

if not exist ".git" git init
git add -A
git commit -m "DAKBoard update" >nul 2>nul
git branch -M main
git remote remove origin >nul 2>nul

if defined GH_TOKEN (
  git remote add origin https://!GH_USER!:!GH_TOKEN!@github.com/Lucy131/Dashboard_1.git
  echo [INFO] Using token from github-token.txt
) else (
  git remote add origin "%REPO%"
  echo [INFO] No token file - you will be asked for username + token
)

echo.
echo Uploading to GitHub...
git push -u origin main

echo.
if errorlevel 1 (
  echo [FAILED] Upload error - see messages above.
) else (
  echo [DONE] Upload OK. The Raspberry Pi will pull on its next cycle.
)
pause
