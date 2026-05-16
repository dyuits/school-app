@echo off
title 2-6 Remove
echo 2학년 6반 제거 중...

taskkill /f /im wscript.exe >nul 2>&1
timeout /t 2 /nobreak >nul

set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
del "%STARTUP%\ClassroomAlert_2-6.vbs" >nul 2>&1
del "%STARTUP%\ClassroomAlert_*.*" >nul 2>&1

rmdir /s /q "%LOCALAPPDATA%\ClassroomAlert\2-6" >nul 2>&1

echo 제거 완료!
timeout /t 3
