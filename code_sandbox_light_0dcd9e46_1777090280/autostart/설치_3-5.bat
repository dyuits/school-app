@echo off
title 3학년 5반 교실 알림 설치
echo 3학년 5반 교실 알림 설치
echo.

set "CHROME="
for %%p in ("%ProgramFiles%\Google\Chrome\Application\chrome.exe" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" "%LocalAppData%\Google\Chrome\Application\chrome.exe") do if exist %%p set "CHROME=%%~p"
if "%CHROME%"=="" (echo Chrome을 찾을 수 없습니다. ^& pause ^& exit /b 1)

for %%i in ("%~dp0..\classroom\3-5.html") do set "HTML=%%~fi"
if not exist "%HTML%" (echo 파일을 찾을 수 없습니다. ^& pause ^& exit /b 1)
set "URL=%HTML:\=/%"
set "URL=file:///%URL%"

set "USERDATA=%LOCALAPPDATA%\교실알림\3-5"
if not exist "%USERDATA%" mkdir "%USERDATA%"

:: 기존 감시 프로세스(wscript.exe) 종료
taskkill /f /im wscript.exe >nul 2>&1
timeout /t 2 /nobreak >nul

:: 시작 프로그램 폴더
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
del "%STARTUP%\교실알림_*.vbs" >nul 2>&1
set "VBS=%STARTUP%\교실알림_3-5.vbs"

:: ======================================================
:: VBS 감시 스크립트 생성
:: 로직: 30초마다 WMI로 chrome.exe 프로세스 확인
::   해당 user-data-dir의 Chrome 실행 중 → 대기
::   Chrome 종료됨 → 재실행 → 20초 대기
:: 중복 실행 방지: WMI 프로세스 확인 후에만 실행하므로 절대 중복 없음
:: ======================================================
> "%VBS%" echo Set oShell = CreateObject("WScript.Shell")
>> "%VBS%" echo Dim sChrome, sURL, sUserData
>> "%VBS%" echo sChrome = "%CHROME%"
>> "%VBS%" echo sURL = "%URL%"
>> "%VBS%" echo sUserData = oShell.ExpandEnvironmentStrings("%%LOCALAPPDATA%%") ^& "\교실알림\3-5"
>> "%VBS%" echo Function IsRunning()
>> "%VBS%" echo   Dim oWMI, procs, p
>> "%VBS%" echo   Set oWMI = GetObject("winmgmts:\\\\.\oot\\cimv2")
>> "%VBS%" echo   Set procs = oWMI.ExecQuery("SELECT CommandLine FROM Win32_Process WHERE Name='chrome.exe'")
>> "%VBS%" echo   IsRunning = False
>> "%VBS%" echo   For Each p In procs
>> "%VBS%" echo     If Not IsNull(p.CommandLine) Then
>> "%VBS%" echo       If InStr(p.CommandLine, "교실알림\3-5") ^> 0 Then IsRunning = True
>> "%VBS%" echo     End If
>> "%VBS%" echo   Next
>> "%VBS%" echo End Function
>> "%VBS%" echo WScript.Sleep 10000
>> "%VBS%" echo Do While True
>> "%VBS%" echo   If Not IsRunning() Then
>> "%VBS%" echo     oShell.Run Chr(34) ^& sChrome ^& Chr(34) ^& " --app=" ^& Chr(34) ^& sURL ^& Chr(34) ^& " --user-data-dir=" ^& Chr(34) ^& sUserData ^& Chr(34) ^& " --autoplay-policy=no-user-gesture-required --disable-background-timer-throttling --no-first-run --start-minimized --window-position=-32000,-32000", 0, False
>> "%VBS%" echo     WScript.Sleep 20000
>> "%VBS%" echo   Else
>> "%VBS%" echo     WScript.Sleep 30000
>> "%VBS%" echo   End If
>> "%VBS%" echo Loop

:: Chrome 실행 (최소화)
start "" "%CHROME%" "--app=%URL%" "--user-data-dir=%USERDATA%" --autoplay-policy=no-user-gesture-required --disable-background-timer-throttling --no-first-run --start-minimized --window-position=-32000,-32000

:: VBS 감시 스크립트 즉시 실행 (숨김/백그라운드)
start "" wscript.exe //nologo "%VBS%"

echo.
echo 설치 완료!
echo - PC 재시작 시 VBS가 자동 실행되어 Chrome을 감시합니다
echo - 제거: 제거_3-5.bat
timeout /t 3
