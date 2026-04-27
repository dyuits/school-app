@echo off
title 3학년 1반 교실 알림 설치
echo 3학년 1반 교실 알림 설치
echo.

set "CHROME="
for %%p in ("%ProgramFiles%\Google\Chrome\Application\chrome.exe" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" "%LocalAppData%\Google\Chrome\Application\chrome.exe") do if exist %%p set "CHROME=%%~p"
if "%CHROME%"=="" (echo Chrome을 찾을 수 없습니다. ^& pause ^& exit /b 1)

for %%i in ("%~dp0..\classroom\3-1.html") do set "HTML=%%~fi"
if not exist "%HTML%" (echo 파일을 찾을 수 없습니다. ^& pause ^& exit /b 1)
set "URL=%HTML:\=/%"
set "URL=file:///%URL%"

set "USERDATA=%LOCALAPPDATA%\교실알림\3-1"
if not exist "%USERDATA%" mkdir "%USERDATA%"

:: 기존 감시 프로세스(wscript.exe) 종료
taskkill /f /im wscript.exe >nul 2>&1
timeout /t 2 /nobreak >nul

:: 시작 프로그램 폴더
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
del "%STARTUP%\교실알림_*.vbs" >nul 2>&1
set "VBS=%STARTUP%\교실알림_3-1.vbs"

:: ======================================================
:: VBS 감시 스크립트 생성
:: 로직: Chrome을 실행하고 종료될 때까지 대기 (bWaitOnReturn=True)
::   Chrome 종료되면 5초 후 재실행
::   WMI/lockfile 사용 안 함 - 학교 PC 호환
:: 중복 실행 방지: Run의 True 파라미터가 프로세스 종료까지 대기하므로 절대 중복 없음
:: ======================================================
> "%VBS%" echo Set oShell = CreateObject("WScript.Shell")
>> "%VBS%" echo Dim sChrome, sURL, sUserData
>> "%VBS%" echo sChrome = "%CHROME%"
>> "%VBS%" echo sURL = "%URL%"
>> "%VBS%" echo sUserData = oShell.ExpandEnvironmentStrings("%%LOCALAPPDATA%%") ^& "\교실알림\3-1"
>> "%VBS%" echo WScript.Sleep 10000
>> "%VBS%" echo Do While True
>> "%VBS%" echo   oShell.Run Chr(34) ^& sChrome ^& Chr(34) ^& " --app=" ^& Chr(34) ^& sURL ^& Chr(34) ^& " --user-data-dir=" ^& Chr(34) ^& sUserData ^& Chr(34) ^& " --autoplay-policy=no-user-gesture-required --disable-background-timer-throttling --no-first-run --start-minimized --window-position=-32000,-32000", 7, True
>> "%VBS%" echo   WScript.Sleep 5000
>> "%VBS%" echo Loop

:: Chrome 실행 (최소화)
start "" "%CHROME%" "--app=%URL%" "--user-data-dir=%USERDATA%" --autoplay-policy=no-user-gesture-required --disable-background-timer-throttling --no-first-run --start-minimized --window-position=-32000,-32000

:: VBS 감시 스크립트 즉시 실행 (숨김/백그라운드)
start "" wscript.exe //nologo "%VBS%"

echo.
echo 설치 완료!
echo - PC 재시작 시 VBS가 자동 실행되어 Chrome을 감시합니다
echo - 제거: 제거_3-1.bat
timeout /t 3
