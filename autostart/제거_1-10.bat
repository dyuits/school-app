@echo off
title Classroom 1-10 Remove
echo Removing Classroom 1-10...

taskkill /f /im wscript.exe >nul 2>&1
timeout /t 2 /nobreak >nul

set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
del "%STARTUP%\ClassroomAlert_1-10.vbs" >nul 2>&1
del "%STARTUP%\ClassroomAlert_*.*" >nul 2>&1

rmdir /s /q "%LOCALAPPDATA%\ClassroomAlert\1-10" >nul 2>&1

echo.
echo [OK] Classroom 1-10 removed.
timeout /t 3
