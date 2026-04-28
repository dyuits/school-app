@echo off
title 1학년 6반 교실 알림 설치
echo 1학년 6반 교실 알림 설치
echo.

set "CHROME="
for %%p in ("%ProgramFiles%\Google\Chrome\Application\chrome.exe" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" "%LocalAppData%\Google\Chrome\Application\chrome.exe") do if exist %%p set "CHROME=%%~p"
if "%CHROME%"=="" (echo Chrome을 찾을 수 없습니다. ^& pause ^& exit /b 1)

for %%i in ("%~dp0..\classroom\1-6.html") do set "HTML=%%~fi"
if not exist "%HTML%" (echo 파일을 찾을 수 없습니다. ^& pause ^& exit /b 1)
set "URL=%HTML:\=/%"
set "URL=file:///%URL%"

set "USERDATA=%LOCALAPPDATA%\교실알림\1-6"
if not exist "%USERDATA%" mkdir "%USERDATA%"

:: 기존 감시 프로세스(wscript.exe) 종료
taskkill /f /im wscript.exe >nul 2>&1
timeout /t 2 /nobreak >nul

:: 시작 프로그램 폴더
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
del "%STARTUP%\교실알림_*.vbs" >nul 2>&1
set "VBS=%STARTUP%\교실알림_1-6.vbs"

:: ======================================================
:: VBS 감시 스크립트 생성
:: 로직: 10초마다 lockfile 존재 확인 (Chrome이 user-data-dir에 생성)
::   lockfile 있음 = Chrome 실행 중 → 대기
::   lockfile 없음 → 3초 후 재확인 → 여전히 없으면 재실행 → 15초 대기
:: 중복 실행 방지: lockfile 더블체크 + 15초 대기로 절대 중복 없음
:: ======================================================
> "%VBS%" echo Set oShell = CreateObject("WScript.Shell")
>> "%VBS%" echo Set fso = CreateObject("Scripting.FileSystemObject")
>> "%VBS%" echo Dim sChrome, sURL, sUserData, sLock, sParent
>> "%VBS%" echo sChrome = "%CHROME%"
>> "%VBS%" echo sURL = "%URL%"
>> "%VBS%" echo sParent = oShell.ExpandEnvironmentStrings("%%LOCALAPPDATA%%") ^& "\교실알림"
>> "%VBS%" echo sUserData = sParent ^& "\1-6"
>> "%VBS%" echo sLock = sUserData ^& "\lockfile"
>> "%VBS%" echo If Not fso.FolderExists(sParent) Then fso.CreateFolder(sParent)
>> "%VBS%" echo If Not fso.FolderExists(sUserData) Then fso.CreateFolder(sUserData)
>> "%VBS%" echo WScript.Sleep 2000
>> "%VBS%" echo Do While True
>> "%VBS%" echo   If Not fso.FileExists(sLock) Then
>> "%VBS%" echo     WScript.Sleep 3000
>> "%VBS%" echo     If Not fso.FileExists(sLock) Then
>> "%VBS%" echo       oShell.Run Chr(34) ^& sChrome ^& Chr(34) ^& " --app=" ^& Chr(34) ^& sURL ^& Chr(34) ^& " --user-data-dir=" ^& Chr(34) ^& sUserData ^& Chr(34) ^& " --autoplay-policy=no-user-gesture-required --disable-background-timer-throttling --no-first-run --start-minimized --window-position=-32000,-32000", 7, False
>> "%VBS%" echo       WScript.Sleep 15000
>> "%VBS%" echo     End If
>> "%VBS%" echo   Else
>> "%VBS%" echo     On Error Resume Next
>> "%VBS%" echo     If oShell.AppActivate("[CALL]") Then
>> "%VBS%" echo       oShell.Run Chr(34) ^& sChrome ^& Chr(34) ^& " --user-data-dir=" ^& Chr(34) ^& sUserData ^& Chr(34), 3, False
>> "%VBS%" echo       WScript.Sleep 1000
>> "%VBS%" echo     End If
>> "%VBS%" echo     If oShell.AppActivate("[HIDE]") Then
>> "%VBS%" echo       WScript.Sleep 200
>> "%VBS%" echo       oShell.SendKeys "%% "
>> "%VBS%" echo       WScript.Sleep 300
>> "%VBS%" echo       oShell.SendKeys "n"
>> "%VBS%" echo     End If
>> "%VBS%" echo     On Error GoTo 0
>> "%VBS%" echo   End If
>> "%VBS%" echo   WScript.Sleep 3000
>> "%VBS%" echo Loop


:: VBS 감시 스크립트 즉시 실행 (숨김/백그라운드)
start "" wscript.exe //nologo "%VBS%"

echo.
echo 설치 완료!
echo - PC 재시작 시 VBS가 자동 실행되어 Chrome을 감시합니다
echo - 제거: 제거_1-6.bat
timeout /t 3
