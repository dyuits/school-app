'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ── 오디오 ──────────────────────────────────────────────────────────────────
  // 알람음 재생: 메인 프로세스 PCM 합성 → speaker → 브라우저 autoplay 정책 무관
  playAlert:    (type, volume)  => ipcRenderer.invoke('audio:play-alert', { type, volume }),
  primeAudio:   ()              => ipcRenderer.invoke('audio:prime'),

  // ── TTS ─────────────────────────────────────────────────────────────────────
  // Windows OS 내장 TTS (PowerShell SpeechSynthesizer)로 한국어 낭독
  speakText:    (text, options) => ipcRenderer.invoke('tts:speak', { text, options }),
  // 설치된 한국어 음성 목록 조회 (설정 UI용)
  listVoices:   ()              => ipcRenderer.invoke('tts:list-voices'),

  // ── 반 설정 ─────────────────────────────────────────────────────────────────
  configGet:    (key)           => ipcRenderer.invoke('config:get', key),
  configSet:    (key, value)    => ipcRenderer.invoke('config:set', key, value),

  // ── 런타임 식별 ──────────────────────────────────────────────────────────────
  getRuntimeInfo: () => ({ source: 'electron' }),
});
