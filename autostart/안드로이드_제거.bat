@echo off
chcp 65001 >nul
title 안드로이드 전자칠판 교실알림 제거
echo ══════════════════════════════════════════
echo   안드로이드 전자칠판 교실알림 제거
echo ══════════════════════════════════════════
echo.

where adb >nul 2>&1
if %errorlevel% neq 0 (
    echo [오류] ADB가 설치되어 있지 않습니다.
    pause
    exit /b 1
)

adb devices | findstr /r "device$" >nul 2>&1
if %errorlevel% neq 0 (
    echo [오류] 연결된 안드로이드 기기가 없습니다.
    echo USB 케이블을 연결하고 USB 디버깅을 켜주세요.
    pause
    exit /b 1
)

echo 자동실행 스크립트 제거 중...
adb shell "rm -f /data/local/tmp/classroom_autostart.sh" >nul 2>&1
echo    ✓ 자동실행 스크립트 제거

echo Chrome 전체화면 모드 해제 중...
adb shell settings put global policy_control null >nul 2>&1
echo    ✓ 전체화면 모드 해제

echo 화면 설정 복원 중...
adb shell settings put system screen_off_timeout 300000 >nul 2>&1
echo    ✓ 화면 자동 꺼짐 복원 (5분)

echo Chrome 종료 중...
adb shell am force-stop com.android.chrome >nul 2>&1
echo    ✓ Chrome 종료

echo.
echo 제거 완료!
echo.
pause
