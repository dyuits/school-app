const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'docs', 'js', 'afterschool.js'), 'utf8');
const staleId = 'after-stale-local';
const storage = new Map([
  ['schoolAppAfterSchoolAttendanceV1', JSON.stringify({
    [staleId]: {
      id: staleId,
      subject: '삭제된 예전 출석부',
      uploader: '김영주',
      teacher: '김영주',
      accessPin: '1234',
      students: [{ name: '테스트', grade: 1, classNo: 1, number: 1 }],
      dates: []
    }
  })],
  ['schoolAppAfterSchoolAttendanceV1:current', staleId]
]);
const root = { innerHTML: '' };
const windowMock = { addEventListener() {} };
const firebaseDB = {
  ref() {
    return {
      on(_event, callback) { callback({ val: () => null }); },
      remove() { return Promise.resolve(); },
      set() { return Promise.resolve(); }
    };
  }
};
const context = {
  window: windowMock,
  document: {
    getElementById(id) { return id === 'afterSchoolAttendanceRoot' ? root : null; },
    querySelector() { return null; }
  },
  localStorage: {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); }
  },
  firebaseDB,
  STAFF_CONTACTS: [],
  console,
  alert() {},
  confirm() { return false; },
  prompt() { return null; },
  setTimeout,
  clearTimeout,
  Date,
  Math,
  Object,
  Array,
  String,
  Number,
  RegExp,
  Map,
  Set,
  JSON
};

vm.runInNewContext(source, context, { filename: 'afterschool.js' });
windowMock.renderAfterSchoolAttendance();

assert(!root.innerHTML.includes('삭제된 예전 출석부'), '원격 목록이 빈 뒤에도 삭제된 로컬 목록이 표시됨');
assert(root.innerHTML.includes('내 방과후 출석부 만들기'), '전체 삭제 후 새 출석부 등록 화면이 표시되지 않음');
assert.deepStrictEqual(JSON.parse(storage.get('schoolAppAfterSchoolAttendanceV1')), {}, '삭제된 로컬 목록이 정리되지 않음');

console.log('after-school remote deletion regression: ok');
