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
