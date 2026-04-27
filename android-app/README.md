# Android 교실 알림 베이스 설계 메모

## 권장 구조
- `MainActivity`: WebView로 `classroom.html` 렌더링
- `ClassroomNativeBridge`: JavaScript 인터페이스 제공
- `AlarmPlayer`: 네이티브 알람음 재생
- `KoreanTtsManager`: 한국어 TTS 재생
- `BootReceiver`: 부팅 후 자동 시작
- `ClassroomForegroundService`: 상주 서비스

## WebView 설정 초안
- JavaScript 활성화
- `mediaPlaybackRequiresUserGesture = false`
- `addJavascriptInterface()`로 `ClassroomNativeBridge` 주입

## JavaScript 브리지 계약
- `primeAudio()`
- `playAlert(type, volume)`
- `speakText(text, options)`
- `getRuntimeInfo() -> { source: 'android-webview' }`

## 다음 구현 대상
- 실제 Android Studio 프로젝트 생성
- 부팅 후 자동실행과 포그라운드 서비스 연결
- 전자칠판 기기별 배터리 최적화 예외 가이드 정리