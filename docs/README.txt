GitHub Pages 배포 방법
=======================

1. 이 프로젝트를 GitHub 저장소에 push 합니다.
2. 저장소 Settings → Pages 메뉴로 이동합니다.
3. Build and deployment 의 Source 를 "Deploy from a branch"로 선택합니다.
4. Branch 는 배포할 브랜치(main 등), Folder 는 "/docs" 를 선택합니다.
5. 저장 후 배포가 완료되면 다음과 같은 주소가 생성됩니다.
   - https://dyuits.github.io/school-app/

주요 페이지
-----------
- 메인 안내: /index.html
- 교실 알림: /classroom.html
- 반별 직접 실행 예시: /classroom.html?class=1-1
- QR 코드 생성: /qr.html
- 설치 안내: /setup.html

전자칠판 설치 순서
------------------
1. 전자칠판에서 /classroom.html 또는 반별 URL에 접속합니다.
2. 반 선택 화면에서 해당 반을 선택합니다.
3. 화면을 한 번 터치하여 소리를 활성화합니다.
   (브라우저 오디오 정책 해제 — 이 단계를 거쳐야 첫 호출부터 알림음이 울립니다)
4. Chrome 메뉴에서 "홈 화면에 추가"를 실행하면 앱처럼 사용 가능합니다.

QR 코드 페이지 사용법
--------------------
1. /qr.html 페이지를 엽니다.
2. 상단 입력칸에 GitHub Pages 기본 URL을 입력합니다.
   예: https://dyuits.github.io/school-app
3. "QR 생성"을 누르면 30개 반의 QR 코드가 생성됩니다.
4. "인쇄" 버튼으로 바로 출력할 수 있습니다.

참고 사항
---------
- Firebase 설정은 기존 classroom HTML과 동일한 값을 사용합니다.
- 네트워크가 끊기면 연결 상태를 표시하고 자동 재연결을 시도합니다.
- Wake Lock 미지원 브라우저에서는 기기 설정에서 절전 시간을 늘려주세요.
- 처음 접속 후 반드시 화면을 한 번 터치해야 소리가 활성화됩니다.
