@echo off
title Classroom ADB Setup
echo ==========================================
echo   Classroom ADB Quick Setup
echo ==========================================
echo.

where adb >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] ADB not found.
    echo   Download: https://developer.android.com/tools/releases/platform-tools
    pause
    exit /b 1
)

echo Checking device...
adb devices | findstr /r "device$" >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] No Android device connected.
    echo   1. Connect USB cable
    echo   2. Enable USB Debugging
    pause
    exit /b 1
)
echo   OK - Device connected
echo.

set /p CLS="Enter class (e.g. 1-1, 2-5, 3-10): "
if "%CLS%"=="" (echo [ERROR] No class entered. & pause & exit /b 1)

set "URL=https://dyuits.github.io/school-app/classroom.html?class=%CLS%"
echo   URL: %URL%

echo.
echo Setting up device...

adb shell settings put system screen_off_timeout 2147483647 >nul 2>&1
echo   OK - Screen timeout disabled

adb shell settings put global stay_on_while_plugged_in 7 >nul 2>&1
echo   OK - Stay awake while charging

adb shell media volume --set 15 --stream 3 >nul 2>&1
adb shell media volume --set 15 --stream 1 >nul 2>&1
echo   OK - Volume max

echo.
echo Launching Chrome...
adb shell am start -a android.intent.action.VIEW -d "%URL%" >nul 2>&1
echo   OK - Chrome launched

adb shell settings put global policy_control immersive.full=com.android.chrome >nul 2>&1
echo   OK - Fullscreen mode

echo.
echo ==========================================
echo   DONE! (Class: %CLS%)
echo ==========================================
echo.
echo   Remove: run android_remove.bat
echo.
pause
