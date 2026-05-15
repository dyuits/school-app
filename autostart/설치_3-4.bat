@echo off
chcp 65001 >nul
title 3학년 4반 교실 알림 설치
echo 3학년 4반 교실 알림 설치
echo.

:: 기존 프로세스 종료
echo 기존 프로세스 정리 중...
taskkill /f /im wscript.exe >nul 2>&1
powershell -Command "Get-Process powershell | Where-Object {$_.CommandLine -like '*교실알림*'} | Stop-Process -Force" >nul 2>&1
timeout /t 2 /nobreak >nul

:: 시작 프로그램 폴더
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
del "%STARTUP%\교실알림_*.vbs" >nul 2>&1
del "%STARTUP%\교실알림_*.bat" >nul 2>&1

:: PS1 스크립트를 로컬에 복사
set "INSTALL_DIR=%LOCALAPPDATA%\교실알림"
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
copy /y "%~dp0교실알림.ps1" "%INSTALL_DIR%\교실알림.ps1" >nul

:: 시작 프로그램 등록 (BAT → PowerShell 실행)
set "STARTUP_BAT=%STARTUP%\교실알림_3-4.bat"
> "%STARTUP_BAT%" echo @echo off
>> "%STARTUP_BAT%" echo start "" /min powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File "%INSTALL_DIR%\교실알림.ps1" -CLS "3-4"

:: 즉시 실행
start "" /min powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File "%INSTALL_DIR%\교실알림.ps1" -CLS "3-4"

echo.
echo 설치 완료!
echo - 시스템 트레이(시계 옆)에 교실알림 아이콘이 표시됩니다.
echo - 트레이 아이콘 더블클릭: 창 보기
echo - 트레이 아이콘 우클릭: 메뉴 (창 보기/숨기기/종료)
echo - Chrome을 닫아도 자동으로 재실행됩니다.
echo - PC 재시작 시 자동으로 시작됩니다.
echo - 제거: 제거_3-4.bat
timeout /t 5
