@echo off
chcp 65001 >nul
title 3학년 3반 교실 알림 설치
echo 3학년 3반 교실 알림 설치
echo.

set "CLS=3-3"

:: 기존 프로세스 종료
taskkill /f /im wscript.exe >nul 2>&1
powershell -Command "Get-Process powershell -ErrorAction SilentlyContinue | Where-Object {$_.CommandLine -like '*ClassroomAlert*'} | Stop-Process -Force" >nul 2>&1
timeout /t 2 /nobreak >nul

:: 시작 프로그램 폴더 정리
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
del "%STARTUP%\ClassroomAlert_*.bat" >nul 2>&1
del "%STARTUP%\ClassroomAlert_*.vbs" >nul 2>&1

:: PS1 스크립트 복사
set "INSTALL_DIR=%LOCALAPPDATA%\ClassroomAlert"
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
copy /y "%~dp0ClassroomAlert.ps1" "%INSTALL_DIR%\ClassroomAlert.ps1" >nul

:: 시작 프로그램 등록
set "STARTUP_BAT=%STARTUP%\ClassroomAlert_3-3.bat"
> "%STARTUP_BAT%" echo @echo off
>> "%STARTUP_BAT%" echo start "" /min powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File "%INSTALL_DIR%\ClassroomAlert.ps1" -CLS "3-3"

:: 즉시 실행
start "" /min powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File "%INSTALL_DIR%\ClassroomAlert.ps1" -CLS "3-3"

echo.
echo 설치 완료!
echo - 트레이 아이콘 더블클릭: 창 보기
echo - 트레이 아이콘 우클릭: 메뉴
echo - Chrome 닫아도 자동 재실행
echo - PC 재시작 시 자동 실행
timeout /t 5
