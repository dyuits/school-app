# 교실 호출 시스템 네이티브 전환 구현 베이스

## 이번 변경 범위
- 교실 화면에 네이티브 브리지 감지 추가
- Firebase heartbeat에 `source`, `audioReady` 메타데이터 추가
- 호출 처리 큐 추가
- 교사 화면에서 연결 출처와 오디오 준비 상태 표시
- Windows용 Electron 베이스 프로젝트 스캐폴드 추가
- Android용 구현 메모 추가

## 현재 상태
- 웹 버전은 계속 동작
- Electron/Android 네이티브 앱은 브리지 계약 기준을 먼저 고정한 상태
- 실제 네이티브 오디오/TTS 구현은 후속 단계에서 채우면 됨

## 배포 전략
- 기존 `autostart/`는 롤백용으로 유지
- 새 배포는 `electron-app` 설치본 중심으로 전환
- Android는 단일 앱 + 반 설정 저장 구조를 권장