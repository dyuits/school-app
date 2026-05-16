@echo off
title 1-1 Remove
echo 1학년 1반 제거 중...

taskkill /f /im wscript.exe >nul 2>&1
timeout /t 2 /nobreak >nul

set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
del "%STARTUP%\ClassroomAlert_1-1.vbs" >nul 2>&1
del "%STARTUP%\ClassroomAlert_*.*" >nul 2>&1

rmdir /s /q "%LOCALAPPDATA%\ClassroomAlert\1-1" >nul 2>&1

echo 제거 완료!
timeout /t 3
