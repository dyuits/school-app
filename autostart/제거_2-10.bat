@echo off
title 2학년 10반 교실 알림 제거
echo 2학년 10반 교실 알림 제거
echo.

echo 프로세스 종료 중...
taskkill /f /im wscript.exe >nul 2>&1
taskkill /f /fi "WINDOWTITLE eq *2-10*" >nul 2>&1
timeout /t 2 /nobreak >nul

echo 시작 프로그램에서 제거 중...
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
del "%STARTUP%\교실알림_2-10.vbs" >nul 2>&1
del "%STARTUP%\교실알림_*.vbs" >nul 2>&1

echo 데이터 폴더 정리 중...
rmdir /s /q "%LOCALAPPDATA%\교실알림\2-10" >nul 2>&1

echo 2학년 10반 교실 알림이 제거되었습니다.
timeout /t 3