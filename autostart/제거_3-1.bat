@echo off
title Classroom 3-1 Remove
echo Removing Classroom 3-1...

taskkill /f /im wscript.exe >nul 2>&1
timeout /t 2 /nobreak >nul

set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
del "%STARTUP%\ClassroomAlert_3-1.vbs" >nul 2>&1
del "%STARTUP%\ClassroomAlert_*.*" >nul 2>&1

rmdir /s /q "%LOCALAPPDATA%\ClassroomAlert\3-1" >nul 2>&1

echo.
echo [OK] Classroom 3-1 removed.
timeout /t 3
