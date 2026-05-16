@echo off
chcp 65001 >nul
title 3학년 3반 교실 알림 설치
echo 3학년 3반 교실 알림 설치
echo.

set "CLS=3-3"
set "URL=https://dyuits.github.io/school-app/classroom/3-3.html"

set "CHROME="
for %%p in ("%ProgramFiles%\Google\Chrome\Application\chrome.exe" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" "%LocalAppData%\Google\Chrome\Application\chrome.exe") do if exist %%p set "CHROME=%%~p"
if "%CHROME%"=="" (echo Chrome not found & pause & exit /b 1)

set "USERDATA=%LOCALAPPDATA%\ClassroomAlert\%CLS%"
if not exist "%USERDATA%" mkdir "%USERDATA%"

:: 기존 프로세스 종료
taskkill /f /im wscript.exe >nul 2>&1
powershell -Command "Stop-Process -Name powershell -Force -ErrorAction SilentlyContinue" >nul 2>&1
timeout /t 2 /nobreak >nul

:: 시작 프로그램 폴더 정리
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
del "%STARTUP%\ClassroomAlert_*.*" >nul 2>&1

:: PS1 복사
set "INSTALL_DIR=%LOCALAPPDATA%\ClassroomAlert"
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
copy /y "%~dp0ClassroomAlert.ps1" "%INSTALL_DIR%\ClassroomAlert.ps1" >nul 2>&1

:: 시작 프로그램 등록 (VBS로 PowerShell 실행 - 창 숨김)
set "VBS=%STARTUP%\ClassroomAlert_3-3.vbs"
> "%VBS%" echo Set s = CreateObject("WScript.Shell")
>> "%VBS%" echo s.Run "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File " ^& Chr(34) ^& s.ExpandEnvironmentStrings("%%LOCALAPPDATA%%") ^& "\ClassroomAlert\ClassroomAlert.ps1" ^& Chr(34) ^& " -CLS 3-3", 0, False

:: 즉시 실행
start "" wscript.exe //nologo "%VBS%"

echo.
echo 설치 완료!
echo - 시스템 트레이(시계 옆)에 아이콘이 표시됩니다.
echo - 아이콘 더블클릭: 창 보기
echo - 아이콘 우클릭: 메뉴
echo - Chrome 닫아도 자동 재실행
echo - PC 재시작 시 자동 실행
echo - 제거: 제거_3-3.bat
timeout /t 5
