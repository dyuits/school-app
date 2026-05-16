@echo off
title Classroom 2-8 Remove
echo Removing Classroom 2-8...

taskkill /f /im wscript.exe >nul 2>&1
timeout /t 2 /nobreak >nul

set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
del "%STARTUP%\ClassroomAlert_2-8.vbs" >nul 2>&1
del "%STARTUP%\ClassroomAlert_*.*" >nul 2>&1

rmdir /s /q "%LOCALAPPDATA%\ClassroomAlert\2-8" >nul 2>&1

echo.
echo [OK] Classroom 2-8 removed.
timeout /t 3
