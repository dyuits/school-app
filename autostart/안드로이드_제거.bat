@echo off
title Classroom Android Remove
echo Removing Classroom setup...

where adb >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] ADB not found.
    pause
    exit /b 1
)

adb devices | findstr /r "device$" >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] No device connected.
    pause
    exit /b 1
)

echo Stopping Chrome...
adb shell am force-stop com.android.chrome >nul 2>&1
echo   OK

echo Removing fullscreen mode...
adb shell settings put global policy_control null >nul 2>&1
echo   OK

echo Restoring screen timeout...
adb shell settings put system screen_off_timeout 300000 >nul 2>&1
echo   OK

echo Uninstalling APK...
adb uninstall com.classroom.autostart >nul 2>&1
echo   OK

echo.
echo [DONE] Removed.
pause
