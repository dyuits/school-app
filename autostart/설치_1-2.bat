@echo off
chcp 65001 >nul
title 1학년 2반 교실 알림 설치
echo 1학년 2반 교실 알림 설치
echo.

set "CHROME="
for %%p in ("%ProgramFiles%\Google\Chrome\Application\chrome.exe" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" "%LocalAppData%\Google\Chrome\Application\chrome.exe") do if exist %%p set "CHROME=%%~p"
if "%CHROME%"=="" (echo Chrome을 찾을 수 없습니다. & pause & exit /b 1)

set "URL=https://dyuits.github.io/school-app/classroom/1-2.html"
set "CLS=1-2"

set "USERDATA=%LOCALAPPDATA%\ClassroomAlert\%CLS%"
if not exist "%USERDATA%" mkdir "%USERDATA%"

:: 기존 프로세스 종료
taskkill /f /im wscript.exe >nul 2>&1
timeout /t 2 /nobreak >nul

:: 시작 프로그램 폴더
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
del "%STARTUP%\ClassroomAlert_*.vbs" >nul 2>&1
set "VBS=%STARTUP%\ClassroomAlert_%CLS%.vbs"

:: VBS 감시 스크립트 생성
> "%VBS%" echo Set oShell = CreateObject("WScript.Shell")
>> "%VBS%" echo Set fso = CreateObject("Scripting.FileSystemObject")
>> "%VBS%" echo Dim sChrome, sURL, sUserData, sLock, sParent
>> "%VBS%" echo sChrome = "%CHROME%"
>> "%VBS%" echo sURL = "%URL%"
>> "%VBS%" echo sParent = oShell.ExpandEnvironmentStrings("%%LOCALAPPDATA%%") ^& "\ClassroomAlert"
>> "%VBS%" echo sUserData = sParent ^& "\1-2"
>> "%VBS%" echo sLock = sUserData ^& "\lockfile"
>> "%VBS%" echo If Not fso.FolderExists(sParent) Then fso.CreateFolder(sParent)
>> "%VBS%" echo If Not fso.FolderExists(sUserData) Then fso.CreateFolder(sUserData)
>> "%VBS%" echo WScript.Sleep 2000
>> "%VBS%" echo For vv=1 To 50 : oShell.SendKeys Chr(175) : Next
>> "%VBS%" echo Do While True
>> "%VBS%" echo   If Not fso.FileExists(sLock) Then
>> "%VBS%" echo     WScript.Sleep 3000
>> "%VBS%" echo     If Not fso.FileExists(sLock) Then
>> "%VBS%" echo       oShell.Run Chr(34) ^& sChrome ^& Chr(34) ^& " --disable-popup-blocking --window-position=32000,32000 --window-size=800,600 --autoplay-policy=no-user-gesture-required --disable-background-timer-throttling --no-first-run --app=" ^& Chr(34) ^& sURL ^& Chr(34) ^& " --user-data-dir=" ^& Chr(34) ^& sUserData ^& Chr(34), 1, False
>> "%VBS%" echo       WScript.Sleep 15000
>> "%VBS%" echo     End If
>> "%VBS%" echo   End If
>> "%VBS%" echo   WScript.Sleep 3000
>> "%VBS%" echo Loop

:: VBS 즉시 실행
start "" wscript.exe //nologo "%VBS%"

echo.
echo 설치 완료!
echo - PC 재시작 시 자동 실행됩니다.
echo - Chrome을 닫아도 자동으로 다시 실행됩니다.
echo - 제거: 제거_1-2.bat
timeout /t 3
