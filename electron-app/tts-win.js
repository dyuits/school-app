'use strict';
/**
 * tts-win.js
 * Windows OS 내장 TTS (System.Speech.Synthesis.SpeechSynthesizer) 래퍼.
 * PowerShell을 통해 차분한 한국어 목소리로 교사 메시지를 낭독합니다.
 *
 * 우선 음성 우선순위:
 *   1. Microsoft Heami Desktop   (Windows 11 한국어 고품질)
 *   2. Microsoft Heami           (Windows 10 한국어)
 *   3. 설정에서 지정한 voiceName
 *   4. OS 기본 음성 (fallback)
 *
 * Windows 이외 플랫폼에서는 조용히 성공 처리하여 웹 TTS fallback으로 넘어갑니다.
 */

const { execFile } = require('child_process');

// Windows 한국어 음성 우선순위 목록
const KO_VOICE_PRIORITY = [
  'Microsoft Heami Desktop',
  'Microsoft Heami',
];

/**
 * PowerShell 인라인 스크립트 생성
 * @param {string} text
 * @param {string|null} voiceName  명시적 음성 이름 (없으면 우선순위 자동 선택)
 * @param {number} rate            -5 ~ 5 (느림↔빠름), 기본 -1 (약간 느리고 차분)
 * @param {number} volume          0 ~ 1
 * @returns {string}
 */
function buildPsScript(text, voiceName, rate, volume) {
  // 주입 방지: 싱글쿼트·백틱 이스케이프, 길이 제한
  const safe = text
    .replace(/[^\uAC00-\uD7A3\u0020-\u007Ea-zA-Z0-9\s,.!?-]/g, ' ')
    .replace(/'/g, "''")
    .replace(/`/g, '``')
    .slice(0, 200);

  const psRate   = Math.max(-10, Math.min(10, Math.round(rate != null ? rate : -1)));
  const psVolume = Math.max(0,   Math.min(100, Math.round((volume != null ? volume : 0.9) * 100)));

  const lines = [
    'Add-Type -AssemblyName System.Speech',
    '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer',
    `$s.Rate   = ${psRate}`,
    `$s.Volume = ${psVolume}`,
  ];

  // 음성 선택: 명시적 → 우선순위 목록 → fallback (오류 무시)
  const candidates = voiceName
    ? [voiceName, ...KO_VOICE_PRIORITY]
    : KO_VOICE_PRIORITY;

  // PowerShell 내에서 순서대로 시도
  const selectBlock = candidates
    .map(v => `try { $s.SelectVoice('${v.replace(/'/g, "''")}'); $voiceSet = $true } catch {}`)
    .join('; ');

  lines.push(`$voiceSet = $false; ${selectBlock}`);
  lines.push(`$s.Speak('${safe}')`);
  lines.push('$s.Dispose()');

  return lines.join('; ');
}

/**
 * 텍스트를 한국어 TTS로 읽습니다.
 * @param {string} text
 * @param {object} [options]
 * @param {string} [options.voiceName]  선호 음성 이름
 * @param {number} [options.rate]       -5 ~ 5
 * @param {number} [options.volume]     0 ~ 1
 * @param {number} [options.timeoutMs]  최대 대기 ms (기본 30000)
 * @returns {Promise<void>}
 */
function speakText(text, options) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') return resolve();
    if (!text || !text.trim()) return resolve();

    const opts = options || {};
    const script    = buildPsScript(text, opts.voiceName || null, opts.rate, opts.volume);
    const timeout   = opts.timeoutMs || 30000;

    let settled = false;
    const finish = () => { if (!settled) { settled = true; resolve(); } };

    const child = execFile(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-WindowStyle', 'Hidden',
        '-Command', script,
      ],
      { timeout, windowsHide: true },
      (err) => {
        if (err && err.code !== 0) {
          // TTS 실패 → 웹 fallback으로 넘어가도록 조용히 resolve
          console.warn('[TTS] PowerShell 오류:', err.message.slice(0, 120));
        }
        finish();
      }
    );

    // 프로세스 시작 실패 안전망
    if (child.pid === undefined) finish();
    setTimeout(finish, timeout + 500);
  });
}

/**
 * 현재 Windows에서 설치된 한국어 음성 목록을 조회합니다. (옵션 기능)
 * @returns {Promise<string[]>}
 */
function listKoreanVoices() {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') return resolve([]);

    const script = [
      'Add-Type -AssemblyName System.Speech',
      '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer',
      '$s.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name }',
      '$s.Dispose()',
    ].join('; ');

    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', script],
      { timeout: 8000, windowsHide: true },
      (err, stdout) => {
        if (err || !stdout) return resolve([]);
        const voices = stdout
          .split('\n')
          .map(l => l.trim())
          .filter(Boolean);
        resolve(voices);
      }
    );
  });
}

module.exports = { speakText, listKoreanVoices };
