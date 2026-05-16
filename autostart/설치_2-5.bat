@echo off
title 2-5 Install
echo 2학년 5반 설치 중...

set "CHROME="
for %%p in ("%ProgramFiles%\Google\Chrome\Application\chrome.exe" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" "%LocalAppData%\Google\Chrome\Application\chrome.exe") do if exist %%p set "CHROME=%%~p"
if "%CHROME%"=="" (echo Chrome not found & pause & exit /b 1)

set "URL=https://dyuits.github.io/school-app/classroom/2-5.html"
set "USERDATA=%LOCALAPPDATA%\ClassroomAlert\2-5"
if not exist "%USERDATA%" mkdir "%USERDATA%"

taskkill /f /im wscript.exe >nul 2>&1
timeout /t 2 /nobreak >nul

set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
del "%STARTUP%\ClassroomAlert_*.*" >nul 2>&1
set "VBS=%STARTUP%\ClassroomAlert_2-5.vbs"

> "%VBS%" echo Set oShell = CreateObject("WScript.Shell")
>> "%VBS%" echo Set fso = CreateObject("Scripting.FileSystemObject")
>> "%VBS%" echo sChrome = "%CHROME%"
>> "%VBS%" echo sURL = "%URL%"
>> "%VBS%" echo sParent = oShell.ExpandEnvironmentStrings("%%LOCALAPPDATA%%") ^& "\ClassroomAlert"
>> "%VBS%" echo sUserData = sParent ^& "\2-5"
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

start "" wscript.exe //nologo "%VBS%"

echo OK! 제거: 제거_2-5.bat
timeout /t 3
