@echo off
title Classroom APK Install
echo ==========================================
echo   Classroom Auto-Start APK Install
echo ==========================================
echo.

where adb >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] ADB not found.
    echo   Download: https://developer.android.com/tools/releases/platform-tools
    pause
    exit /b 1
)

echo [1/4] Checking device...
adb devices | findstr /r "device$" >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] No Android device connected.
    echo   1. Connect USB cable
    echo   2. Enable USB Debugging on the device
    pause
    exit /b 1
)
echo   OK - Device connected
echo.

set "APK_PATH=%~dp0android-autostart\app\build\outputs\apk\debug\app-debug.apk"
set "APK_RELEASE=%~dp0android-autostart\app\build\outputs\apk\release\app-release-unsigned.apk"

if exist "%APK_PATH%" (
    echo [2/4] APK found - installing...
    goto :install
)
if exist "%APK_RELEASE%" (
    set "APK_PATH=%APK_RELEASE%"
    echo [2/4] APK found - installing...
    goto :install
)

echo [ERROR] APK not found. Build it first:
echo.
echo   1. Install Android Studio: https://developer.android.com/studio
echo   2. Open folder: android-autostart
echo   3. Build - Build APK
echo   4. Run this script again
echo.
pause
exit /b 1

:install
echo [3/4] Installing APK...
adb install -r "%APK_PATH%"
if %errorlevel% neq 0 (
    echo [ERROR] Install failed.
    echo   Settings - Security - Allow unknown apps
    pause
    exit /b 1
)
echo   OK - APK installed

echo.
echo [4/4] Setting permissions...

adb shell dumpsys deviceidle whitelist +com.classroom.autostart >nul 2>&1
echo   OK - Battery optimization disabled

adb shell settings put system screen_off_timeout 2147483647 >nul 2>&1
echo   OK - Screen timeout disabled

adb shell settings put global stay_on_while_plugged_in 7 >nul 2>&1
echo   OK - Stay awake while charging

adb shell media volume --set 15 --stream 3 >nul 2>&1
adb shell media volume --set 15 --stream 1 >nul 2>&1
echo   OK - Volume max

echo.
echo Launching app...
adb shell am start -n com.classroom.autostart/.MainActivity >nul 2>&1
echo   OK - App launched

echo.
echo ==========================================
echo   DONE!
echo ==========================================
echo.
echo   On the smart board:
echo   1. Select grade/class - tap [Save+Run]
echo   2. In Chrome - tap "Start" screen
echo   3. Done. Auto-starts on reboot.
echo.
echo   Remove: adb uninstall com.classroom.autostart
echo.
pause
