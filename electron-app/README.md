# Electron 교실 알림 베이스

## 목적
- Windows 전자칠판에서 `classroom.html`을 브라우저 대신 앱으로 실행
- 자동실행, 트레이 상주, 닫기 방지, 오디오 정책 완화 기반 제공

## 실행
```bash
cd electron-app
npm install
npm start
```

## 현재 포함 사항
- `main.js`: 전체화면 창, 트레이, 자동실행, 절전 방지
- `preload.js`: 교실 화면에서 호출 가능한 네이티브 브리지
- `classroom.html` 연동용 `electronAPI`

## 다음 구현 대상
- 반 설정 저장
- 실제 알람 파일 재생
- Windows TTS 음성 선택 및 메시지 낭독
- NSIS 설치본 생성 파이프라인