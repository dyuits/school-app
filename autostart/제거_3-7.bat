@echo off
title 3-7 Remove
echo 3학년 7반 제거 중...

taskkill /f /im wscript.exe >nul 2>&1
timeout /t 2 /nobreak >nul

set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
del "%STARTUP%\ClassroomAlert_3-7.vbs" >nul 2>&1
del "%STARTUP%\ClassroomAlert_*.*" >nul 2>&1

rmdir /s /q "%LOCALAPPDATA%\ClassroomAlert\3-7" >nul 2>&1

echo 제거 완료!
timeout /t 3
