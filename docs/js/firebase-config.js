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
    window.dispatchEvent(new CustomEvent('schoolapp:firebase-ready'));
  }
}

// 관리자 페이지의 학사일정과 동일한 단일 원본을 메인 앱에도 반영한다.
async function loadAdminOverrides() {
  if (!firebaseDB || typeof ACADEMIC_CALENDAR === 'undefined') return;
  try {
    const snap = await firebaseDB.ref('adminData/calendar').once('value');
    const calendar = snap.val();
    if (Array.isArray(calendar) && calendar.length) {
      ACADEMIC_CALENDAR.splice(0, ACADEMIC_CALENDAR.length, ...calendar);
      window.dispatchEvent(new CustomEvent('schoolapp:calendar-updated'));
    }
  } catch (error) {
    console.warn('관리자 학사일정 로드 실패, 기본 데이터를 사용합니다.', error);
  }
}
