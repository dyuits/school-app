@echo off
chcp 65001 >nul
title 1학년 5반 교실 알림 제거
echo 1학년 5반 교실 알림 제거
echo.

set "CLS=1-5"

echo 프로세스 종료 중...
powershell -Command "Get-Process powershell -ErrorAction SilentlyContinue | Where-Object {$_.CommandLine -like '*ClassroomAlert*'} | Stop-Process -Force" >nul 2>&1
taskkill /f /im wscript.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo 시작 프로그램에서 제거 중...
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
del "%STARTUP%\ClassroomAlert_1-5.bat" >nul 2>&1
del "%STARTUP%\ClassroomAlert_*.vbs" >nul 2>&1

echo 데이터 정리 중...
rmdir /s /q "%LOCALAPPDATA%\ClassroomAlert\1-5" >nul 2>&1

echo.
echo 제거 완료!
timeout /t 3
