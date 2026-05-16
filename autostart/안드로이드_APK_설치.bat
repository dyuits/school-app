@echo off
chcp 65001 >nul
title 교실알림 자동실행 APK 빌드 및 설치
echo ══════════════════════════════════════════════════
echo   교실알림 자동실행 APK 빌드 ^& 설치
echo ══════════════════════════════════════════════════
echo.
echo   이 스크립트는 다음을 수행합니다:
echo   1. APK 빌드 (Android Studio 또는 Gradle 필요)
echo   2. 전자칠판에 APK 설치 (ADB)
echo   3. 앱 실행
echo.

:: ── ADB 확인 ──
where adb >nul 2>&1
if %errorlevel% neq 0 (
    echo [오류] ADB가 설치되어 있지 않습니다.
    echo   https://developer.android.com/tools/releases/platform-tools 에서 다운로드하세요.
    pause
    exit /b 1
)

:: ── 디바이스 연결 확인 ──
echo [1/4] 전자칠판 연결 확인...
adb devices | findstr /r "device$" >nul 2>&1
if %errorlevel% neq 0 (
    echo [오류] 연결된 안드로이드 기기가 없습니다.
    echo   USB 연결 + USB 디버깅 켜기를 확인하세요.
    pause
    exit /b 1
)
echo    ✓ 전자칠판 연결됨
echo.

:: ── APK 확인 (이미 빌드된 APK가 있으면 바로 설치) ──
set "APK_PATH=%~dp0android-autostart\app\build\outputs\apk\debug\app-debug.apk"
set "APK_RELEASE=%~dp0android-autostart\app\build\outputs\apk\release\app-release-unsigned.apk"

if exist "%APK_PATH%" (
    echo [2/4] 빌드된 APK 발견 → 바로 설치합니다.
    goto :install
)
if exist "%APK_RELEASE%" (
    set "APK_PATH=%APK_RELEASE%"
    echo [2/4] 빌드된 APK 발견 → 바로 설치합니다.
    goto :install
)

:: ── APK 빌드 ──
echo [2/4] APK 빌드 중...
echo.

:: Gradle Wrapper 확인
if exist "%~dp0android-autostart\gradlew.bat" (
    echo    Gradle Wrapper 사용
    cd /d "%~dp0android-autostart"
    call gradlew.bat assembleDebug
    cd /d "%~dp0"
) else (
    :: 시스템 Gradle 확인
    where gradle >nul 2>&1
    if %errorlevel% neq 0 (
        echo [오류] Gradle이 설치되어 있지 않습니다.
        echo.
        echo   ═══ APK 빌드 방법 (택1) ═══
        echo.
        echo   방법 A: Android Studio 사용 (권장)
        echo     1. Android Studio 설치: https://developer.android.com/studio
        echo     2. android-autostart 폴더를 Android Studio에서 열기
        echo     3. Build → Build APK
        echo     4. 이 스크립트를 다시 실행 (자동으로 APK를 찾아 설치)
        echo.
        echo   방법 B: 명령줄 빌드
        echo     1. JDK 17 설치: https://adoptium.net/
        echo     2. Android SDK 설치 (cmdline-tools)
        echo     3. 환경변수 ANDROID_HOME 설정
        echo     4. cd android-autostart ^&^& gradlew assembleDebug
        echo     5. 이 스크립트를 다시 실행
        echo.
        pause
        exit /b 1
    )
    echo    시스템 Gradle 사용
    cd /d "%~dp0android-autostart"
    gradle assembleDebug
    cd /d "%~dp0"
)

if not exist "%APK_PATH%" (
    echo [오류] APK 빌드 실패. 위의 오류 메시지를 확인하세요.
    pause
    exit /b 1
)
echo    ✓ APK 빌드 완료

:install
:: ── APK 설치 ──
echo.
echo [3/4] APK 설치 중... (%APK_PATH%)
adb install -r "%APK_PATH%"
if %errorlevel% neq 0 (
    echo [오류] APK 설치 실패.
    echo   전자칠판에서 "알 수 없는 앱 설치" 허용이 필요할 수 있습니다.
    echo   → 설정 → 보안 → 알 수 없는 앱 설치 허용
    pause
    exit /b 1
)
echo    ✓ APK 설치 완료

:: ── 권한 설정 ──
echo.
echo [4/4] 권한 및 자동실행 설정 중...

:: 배터리 최적화 제외
adb shell dumpsys deviceidle whitelist +com.classroom.autostart >nul 2>&1
echo    ✓ 배터리 최적화 제외

:: 부팅 완료 권한 활성화
adb shell pm grant com.classroom.autostart android.permission.RECEIVE_BOOT_COMPLETED >nul 2>&1

:: 화면 꺼짐 방지
adb shell settings put system screen_off_timeout 2147483647 >nul 2>&1
echo    ✓ 화면 자동 꺼짐 비활성화

:: 충전 중 화면 켜짐 유지
adb shell settings put global stay_on_while_plugged_in 7 >nul 2>&1
echo    ✓ 충전 중 화면 켜짐 유지

:: 볼륨 최대
adb shell media volume --set 15 --stream 3 >nul 2>&1
adb shell media volume --set 15 --stream 1 >nul 2>&1
echo    ✓ 미디어 볼륨 최대

:: 앱 실행
echo.
echo 교실알림 자동실행 앱을 실행합니다...
adb shell am start -n com.classroom.autostart/.MainActivity >nul 2>&1
echo    ✓ 앱 실행됨

echo.
echo ══════════════════════════════════════════════════
echo   설치 완료!
echo ══════════════════════════════════════════════════
echo.
echo   전자칠판 화면에서:
echo   1. 학년/반 선택 후 [저장+실행] 터치
echo   2. Chrome에서 '화면을 터치하여 시작' 터치
echo.
echo   이후 자동으로:
echo   - 부팅 시 Chrome 교실알림 자동 실행
echo   - Chrome 종료 시 15초 내 자동 재실행
echo   - 배터리 최적화 제외 (백그라운드 유지)
echo.
echo   제거: adb uninstall com.classroom.autostart
echo.
pause
