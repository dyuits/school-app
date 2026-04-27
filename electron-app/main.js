'use strict';
/**
 * main.js — Electron 메인 프로세스
 *
 * 기능:
 *  - classroom.html 전체화면 로드 (autoplay 정책 완전 비활성화)
 *  - 시스템 트레이 상주 + 닫기 방지 (X → 숨김)
 *  - 로그인 시 자동 실행
 *  - 화면 절전 방지
 *  - 반 설정 저장/로드 (electron-store, fallback: JSON 파일)
 *  - IPC: audio:play-alert → audio-synth.js (PCM 합성음)
 *  - IPC: tts:speak       → tts-win.js (PowerShell SpeechSynthesizer)
 *  - IPC: tts:list-voices → 설치된 한국어 음성 목록 반환
 *  - IPC: config:get/set  → 반 설정 저장/로드
 */

const path = require('path');
const fs   = require('fs');
const {
  app, BrowserWindow, Tray, Menu, ipcMain,
  nativeImage, shell, powerSaveBlocker
} = require('electron');

const { playAlert }              = require('./audio-synth');
const { speakText, listKoreanVoices } = require('./tts-win');

// ─── 설정 파일 경로 (electron-store 미사용 시 fallback) ───────────────────────
const CONFIG_PATH = path.join(app.getPath('userData'), 'classroom-config.json');

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch (_) {
    return {};
  }
}

function saveConfig(data) {
  try {
    fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.warn('[Config] 저장 실패:', e.message);
  }
}

// ─── 전역 상태 ────────────────────────────────────────────────────────────────
let mainWindow  = null;
let tray        = null;
let blockerId   = null;
let appConfig   = loadConfig();

// ─── 트레이 아이콘 ─────────────────────────────────────────────────────────────
function buildTrayIcon() {
  // 16×16 빈 투명 이미지 (아이콘 파일 없어도 Tray가 오류 안 냄)
  const empty = nativeImage.createEmpty();
  // 실제 배포 시 icons/tray.png 를 추가하면 됨
  const iconPath = path.join(__dirname, 'icons', 'tray.png');
  return fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : empty;
}

// ─── BrowserWindow ─────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width:            1440,
    height:           900,
    autoHideMenuBar:  true,
    fullscreen:       true,
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
      // 자동재생 정책 완전 해제 — 이것이 핵심 차이점
      autoplayPolicy:   'no-user-gesture-required',
    },
  });

  // 반 설정이 있으면 쿼리 파라미터로 전달
  const cls     = appConfig.classroom || '';
  const htmlPath = path.join(__dirname, '..', 'classroom.html');
  const loadUrl  = cls
    ? `file://${htmlPath}?class=${encodeURIComponent(cls)}`
    : `file://${htmlPath}`;

  mainWindow.loadURL(loadUrl);

  // X 버튼 → 트레이로 숨김 (완전 종료 아님)
  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ─── 트레이 ────────────────────────────────────────────────────────────────────
function createTray() {
  tray = new Tray(buildTrayIcon());
  tray.setToolTip('교실 알림');

  const updateMenu = () => {
    const cls = appConfig.classroom || '미설정';
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: `현재 반: ${cls}`, enabled: false },
      { type: 'separator' },
      { label: '창 열기',           click: () => mainWindow?.show() },
      { label: '화면 새로고침',      click: () => mainWindow?.webContents?.reload() },
      { type: 'separator' },
      {
        label: '음성 테스트',
        click: async () => {
          await speakText('안녕하세요. 교실 알림 테스트입니다.', {
            rate: -1, volume: 0.9
          });
        }
      },
      {
        label: '알람 테스트',
        click: async () => { await playAlert('dingdong', 0.8); }
      },
      { type: 'separator' },
      {
        label: '종료',
        click: () => { app.isQuiting = true; app.quit(); }
      },
    ]));
  };

  updateMenu();
  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus(); });

  return { updateMenu };
}

// ─── IPC 핸들러 ────────────────────────────────────────────────────────────────
function setupIpc() {
  // ── 알람음 재생 ──────────────────────────────────────────────────────────────
  ipcMain.handle('audio:play-alert', async (_event, { type, volume }) => {
    await playAlert(type, volume);
    return true;
  });

  // ── 오디오 준비 (primeAudio 호출용) ─────────────────────────────────────────
  ipcMain.handle('audio:prime', async () => {
    // Electron에서는 메인 프로세스 오디오가 독립적 → 항상 준비됨
    return true;
  });

  // ── TTS 낭독 ─────────────────────────────────────────────────────────────────
  ipcMain.handle('tts:speak', async (_event, { text, options }) => {
    await speakText(text, options);
    return true;
  });

  // ── 설치된 음성 목록 조회 ────────────────────────────────────────────────────
  ipcMain.handle('tts:list-voices', async () => {
    return await listKoreanVoices();
  });

  // ── 반 설정 로드 ─────────────────────────────────────────────────────────────
  ipcMain.handle('config:get', (_event, key) => {
    return key ? appConfig[key] : appConfig;
  });

  // ── 반 설정 저장 ─────────────────────────────────────────────────────────────
  ipcMain.handle('config:set', (_event, key, value) => {
    appConfig[key] = value;
    saveConfig(appConfig);
    return true;
  });
}

// ─── 앱 초기화 ─────────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  // 로그인 시 자동 실행 등록
  app.setLoginItemSettings({ openAtLogin: true });

  // 화면 절전 방지
  blockerId = powerSaveBlocker.start('prevent-display-sleep');

  setupIpc();
  createWindow();
  createTray();
});

app.on('window-all-closed', (event) => {
  // macOS 기본 동작 방지 + Windows에서도 트레이 상주 유지
  event.preventDefault();
});

app.on('before-quit', () => {
  app.isQuiting = true;
  if (blockerId != null && powerSaveBlocker.isStarted(blockerId)) {
    powerSaveBlocker.stop(blockerId);
  }
});

// 두 번째 인스턴스 실행 방지
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}
