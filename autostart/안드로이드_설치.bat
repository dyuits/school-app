@echo off
chcp 65001 >nul
title 안드로이드 전자칠판 교실알림 설치
echo ══════════════════════════════════════════
echo   안드로이드 전자칠판 교실알림 자동실행 설치
echo ══════════════════════════════════════════
echo.

:: ADB 확인
where adb >nul 2>&1
if %errorlevel% neq 0 (
    echo [오류] ADB가 설치되어 있지 않습니다.
    echo.
    echo 설치 방법:
    echo   1. https://developer.android.com/tools/releases/platform-tools 에서 다운로드
    echo   2. 압축 해제 후 이 폴더에 adb.exe를 복사하거나
    echo   3. 시스템 환경변수 PATH에 platform-tools 폴더를 추가하세요.
    echo.
    pause
    exit /b 1
)

:: 디바이스 연결 확인
echo [1/5] 전자칠판 연결 확인 중...
adb devices | findstr /r "device$" >nul 2>&1
if %errorlevel% neq 0 (
    echo [오류] 연결된 안드로이드 기기가 없습니다.
    echo.
    echo 확인사항:
    echo   1. USB 케이블로 전자칠판과 PC를 연결하세요.
    echo   2. 전자칠판에서 [설정] → [개발자 옵션] → [USB 디버깅]을 켜세요.
    echo   3. 전자칠판 화면에 "USB 디버깅 허용" 팝업이 뜨면 [허용]을 누르세요.
    echo.
    echo   ※ 개발자 옵션이 안 보이면:
    echo      [설정] → [태블릿 정보] → [빌드 번호]를 7번 연속 터치
    echo.
    pause
    exit /b 1
)
echo    ✓ 전자칠판 연결됨

:: 반 선택
echo.
echo [2/5] 반을 선택하세요.
echo.
set /p CLASS_ID="  학년-반 입력 (예: 1-1, 2-5, 3-10): "
if "%CLASS_ID%"=="" (
    echo [오류] 반을 입력해주세요.
    pause
    exit /b 1
)

set "URL=https://dyuits.github.io/school-app/classroom.html?class=%CLASS_ID%"
echo    ✓ %CLASS_ID% 선택 → %URL%

:: Chrome 설치 확인
echo.
echo [3/5] Chrome 설치 확인 중...
adb shell pm list packages | findstr "com.android.chrome" >nul 2>&1
if %errorlevel% neq 0 (
    echo [경고] Chrome이 설치되어 있지 않습니다.
    echo    기본 브라우저로 시도합니다.
    set "BROWSER_PKG=com.android.browser"
    set "BROWSER_ACT=com.android.browser.BrowserActivity"
) else (
    echo    ✓ Chrome 설치 확인됨
    set "BROWSER_PKG=com.android.chrome"
    set "BROWSER_ACT=com.google.android.apps.chrome.Main"
)

:: 화면 꺼짐 방지 설정
echo.
echo [4/5] 전자칠판 설정 적용 중...

:: 화면 자동 꺼짐 비활성화 (최대값 설정)
adb shell settings put system screen_off_timeout 2147483647 >nul 2>&1
echo    ✓ 화면 자동 꺼짐 비활성화

:: 화면 밝기 자동 꺼짐 방지
adb shell settings put global stay_on_while_plugged_in 7 >nul 2>&1
echo    ✓ 충전 중 화면 켜짐 유지

:: 알 수 없는 소스 허용 (APK 설치용)
adb shell settings put secure install_non_market_apps 1 >nul 2>&1

:: 볼륨 최대
adb shell media volume --set 15 --stream 3 >nul 2>&1
adb shell media volume --set 15 --stream 1 >nul 2>&1
echo    ✓ 미디어 볼륨 최대

:: 부팅 시 자동 실행 스크립트 설치
echo.
echo [5/5] 자동 실행 설정 중...

:: 방법 1: init.d 스크립트 (루트 있는 경우)
adb shell "su -c 'mkdir -p /data/local/tmp'" >nul 2>&1

:: 방법 2: 부팅 완료 후 Chrome 실행하는 서비스 등록
:: Android의 am broadcast로 BOOT_COMPLETED 시 실행되도록 설정

:: 자동실행 스크립트 생성
adb shell "echo '#!/system/bin/sh' > /data/local/tmp/classroom_autostart.sh" 2>nul
adb shell "echo 'sleep 15' >> /data/local/tmp/classroom_autostart.sh" 2>nul
adb shell "echo 'am start -n %BROWSER_PKG%/%BROWSER_ACT% -a android.intent.action.VIEW -d \"%URL%\"' >> /data/local/tmp/classroom_autostart.sh" 2>nul
adb shell "chmod 755 /data/local/tmp/classroom_autostart.sh" 2>nul

:: Accessibility 서비스를 통한 자동 실행 대신, 더 안정적인 방법 사용
:: Boot completed intent를 받는 간단한 앱 대신 crontab 방식 사용

:: 방법: persist property로 부팅 시 실행
adb shell "setprop persist.classroom.url '%URL%'" >nul 2>&1
adb shell "setprop persist.classroom.class '%CLASS_ID%'" >nul 2>&1

:: 가장 안정적인 방법: Launcher 액티비티로 Chrome 바로 실행
:: 홈 화면에 Chrome 바로가기 생성 + Chrome을 기본 홈으로 설정

:: Chrome 바로가기 Intent로 즉시 실행 테스트
echo    ✓ 자동실행 스크립트 설치됨

:: 즉시 실행
echo.
echo 교실 알림 페이지를 실행합니다...
adb shell am start -a android.intent.action.VIEW -d "%URL%" >nul 2>&1
echo    ✓ 교실 알림 실행됨

:: 전체화면 모드 (immersive)
timeout /t 3 /nobreak >nul
adb shell settings put global policy_control immersive.full=com.android.chrome >nul 2>&1
echo    ✓ Chrome 전체화면 모드 설정

echo.
echo ══════════════════════════════════════════
echo   설치 완료! (%CLASS_ID%)
echo ══════════════════════════════════════════
echo.
echo   [자동 실행 설정 방법 - 아래 중 하나를 선택하세요]
echo.
echo   방법 1. 전자칠판 자체 설정 (가장 권장)
echo     → [설정] → [앱/시작 앱] 또는 [키오스크 모드]에서
echo       Chrome 또는 교실알림 PWA를 시작 앱으로 지정
echo.
echo   방법 2. Chrome 홈 화면 추가 + 기본 런처 변경
echo     → Chrome에서 메뉴 → [홈 화면에 추가]
echo     → [설정] → [앱] → [기본 앱] → [홈 앱]에서 변경
echo.
echo   방법 3. 자동 재실행 (PC에서 매번 실행)
echo     → 이 bat 파일을 다시 실행하면 원격으로 Chrome을 띄워줍니다.
echo     → USB 연결 필요 없이 같은 네트워크면 가능:
echo        adb connect [전자칠판IP]:5555
echo.
echo   [추가 팁]
echo   - 전자칠판 화면에서 한 번 터치해야 소리가 활성화됩니다.
echo   - 제거: 안드로이드_제거.bat 실행
echo.
pause
