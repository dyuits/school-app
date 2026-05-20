// Firebase Realtime Database 설정
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDF8OLuBylKToxAxKDfZAm9D1uBRlBjv4s",
  authDomain: "numeric-mile-356201.firebaseapp.com",
  databaseURL: "https://numeric-mile-356201-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "numeric-mile-356201",
  storageBucket: "numeric-mile-356201.firebasestorage.app",
  messagingSenderId: "610122506405",
  appId: "1:610122506405:web:450e216d82b1011061ed4c"
};

// Firebase 초기화 (compat SDK 사용 — script 태그 방식)
let firebaseDB = null;
function initFirebase() {
  if (typeof firebase !== 'undefined' && !firebaseDB) {
    firebase.initializeApp(FIREBASE_CONFIG);
    firebaseDB = firebase.database();
    console.log('Firebase 연결 완료');
  }
}

// 관리자 페이지에서 저장한 데이터를 앱에 반영
async function loadAdminOverrides() {
  if (!firebaseDB) return;
  try {
    const snap = await firebaseDB.ref('adminData').once('value');
    const d = snap.val();
    if (!d) return;

    // 학사일정 덮어쓰기
    if (d.calendar && Array.isArray(d.calendar)) {
      ACADEMIC_CALENDAR.splice(0, ACADEMIC_CALENDAR.length, ...d.calendar);
    }

    // 학생 명단 덮어쓰기
    if (d.roster) {
      Object.keys(d.roster).forEach(cls => {
        if (STUDENT_ROSTER[cls] && Array.isArray(d.roster[cls])) {
          STUDENT_ROSTER[cls].students = d.roster[cls];
        }
      });
    }

    // 교과 선생님 과목 덮어쓰기
    if (d.teachers && Array.isArray(d.teachers)) {
      d.teachers.forEach(({ name, subject }) => {
        if (SUBJECT_SUBSTITUTE_MAP[name]) {
          SUBJECT_SUBSTITUTE_MAP[name].subject = subject;
        }
      });
    }

    console.log('관리자 데이터 반영 완료');
  } catch(e) {
    console.log('관리자 데이터 로드 실패 (기본값 사용):', e.message);
  }
}
