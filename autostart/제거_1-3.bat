@echo off
chcp 65001 >nul
title 1학년 3반 교실 알림 제거
echo 1학년 3반 교실 알림 제거
echo.

set "CLS=1-3"

echo 프로세스 종료 중...
taskkill /f /im wscript.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo 시작 프로그램에서 제거 중...
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
del "%STARTUP%\ClassroomAlert_%CLS%.vbs" >nul 2>&1

echo 데이터 정리 중...
rmdir /s /q "%LOCALAPPDATA%\ClassroomAlert\%CLS%" >nul 2>&1

echo.
echo 제거 완료!
timeout /t 3
