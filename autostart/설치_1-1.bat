@echo off
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" /v TaskbarGlomLevel /t REG_DWORD /d 0 /f >nul 2>&1
title Classroom 1-1 Install
echo Installing Classroom 1-1...

set "CHROME="
for %%p in ("%ProgramFiles%\Google\Chrome\Application\chrome.exe" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" "%LocalAppData%\Google\Chrome\Application\chrome.exe") do if exist %%p set "CHROME=%%~p"
if "%CHROME%"=="" (echo Chrome not found & pause & exit /b 1)

set "URL=https://dyuits.github.io/school-app/classroom/1-1.html"
set "USERDATA=%LOCALAPPDATA%\ClassroomAlert\1-1"

taskkill /f /im wscript.exe >nul 2>&1
timeout /t 3 /nobreak >nul
del "%LOCALAPPDATA%\ClassroomAlert\watcher_*.lock" >nul 2>&1

rmdir /s /q "%USERDATA%" >nul 2>&1
mkdir "%USERDATA%"

set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
del "%STARTUP%\ClassroomAlert_*.*" >nul 2>&1
set "VBS=%STARTUP%\ClassroomAlert_1-1.vbs"

> "%VBS%" echo Set oShell = CreateObject("WScript.Shell")
>> "%VBS%" echo Set fso = CreateObject("Scripting.FileSystemObject")
>> "%VBS%" echo sChrome = "%CHROME%"
>> "%VBS%" echo sURL = "%URL%"
>> "%VBS%" echo sParent = oShell.ExpandEnvironmentStrings("%%LOCALAPPDATA%%") ^& "\ClassroomAlert"
>> "%VBS%" echo sUserData = sParent ^& "\1-1"
>> "%VBS%" echo sLock = sUserData ^& "\lockfile"
>> "%VBS%" echo If Not fso.FolderExists(sParent) Then fso.CreateFolder(sParent)
>> "%VBS%" echo If Not fso.FolderExists(sUserData) Then fso.CreateFolder(sUserData)
>> "%VBS%" echo sLockFile = sParent ^& "\watcher_1-1.lock"
>> "%VBS%" echo If fso.FileExists(sLockFile) Then WScript.Quit
>> "%VBS%" echo fso.CreateTextFile(sLockFile, True).Close
>> "%VBS%" echo WScript.Sleep 2000
>> "%VBS%" echo For vv=1 To 50 : oShell.SendKeys Chr(175) : Next
>> "%VBS%" echo Do While True
>> "%VBS%" echo   If Not fso.FileExists(sLock) Then
>> "%VBS%" echo     WScript.Sleep 3000
>> "%VBS%" echo     If Not fso.FileExists(sLock) Then
>> "%VBS%" echo       If fso.FolderExists(sUserData ^& "\Default") Then
>> "%VBS%" echo         On Error Resume Next
>> "%VBS%" echo         fso.DeleteFile sUserData ^& "\Default\Preferences", True
>> "%VBS%" echo         On Error GoTo 0
>> "%VBS%" echo       End If
>> "%VBS%" echo       oShell.Run Chr(34) ^& sChrome ^& Chr(34) ^& " --disable-popup-blocking --window-position=-32000,-32000 --window-size=1,1 --autoplay-policy=no-user-gesture-required --disable-background-timer-throttling --no-first-run --app=" ^& Chr(34) ^& sURL ^& Chr(34) ^& " --user-data-dir=" ^& Chr(34) ^& sUserData ^& Chr(34), 1, False
>> "%VBS%" echo       WScript.Sleep 15000
>> "%VBS%" echo     End If
>> "%VBS%" echo   End If
>> "%VBS%" echo   WScript.Sleep 3000
>> "%VBS%" echo Loop

start "" wscript.exe //nologo "%VBS%"

echo.
echo [OK] Classroom 1-1 installed.
echo - Auto-start on boot: YES
echo - Auto-restart Chrome: YES
echo - Remove: run remove_1-1.bat
timeout /t 3
