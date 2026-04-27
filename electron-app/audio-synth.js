'use strict';
/**
 * audio-synth.js
 * Electron 메인 프로세스에서 호출하는 PCM 합성 알람음 8종 재생 모듈.
 * 브라우저 자동재생 정책과 완전히 독립적으로 동작합니다.
 *
 * 런타임 의존성: speaker (선택) — 미설치 시 조용히 성공, 웹 fallback으로 넘어갑니다.
 */

const SAMPLE_RATE = 44100;
const CHANNELS    = 1;
const BIT_DEPTH   = 16;

function oscillator(wave, freq, t) {
  const p = (t * freq) % 1;
  switch (wave) {
    case 'square':   return p < 0.5 ? 1 : -1;
    case 'sawtooth': return 2 * p - 1;
    case 'triangle': return p < 0.5 ? (4 * p - 1) : (3 - 4 * p);
    case 'sine':
    default:         return Math.sin(2 * Math.PI * p);
  }
}

function writeTone(freq, start, dur, wave, amp, vol, buf) {
  const s0 = Math.round(start * SAMPLE_RATE);
  const s1 = Math.min(buf.length, Math.round((start + dur) * SAMPLE_RATE));
  for (let i = s0; i < s1; i++) {
    const t   = (i - s0) / SAMPLE_RATE;
    const env = Math.exp(-3 * t / dur);
    buf[i]   += oscillator(wave, freq, t) * amp * env * vol;
  }
}

function synthesize(type, volume) {
  const vol = Math.min(1, Math.max(0, volume != null ? volume : 0.8));
  const buf = new Float32Array(Math.round(2.5 * SAMPLE_RATE));

  switch (type) {
    case 'dingdong':
      writeTone(880, 0,   0.5, 'sine',     0.4,  vol, buf);
      writeTone(659, 0.4, 0.9, 'sine',     0.4,  vol, buf);
      break;
    case 'chime':
      writeTone(523, 0,   0.8, 'sine',     0.3,  vol, buf);
      writeTone(659, 0.3, 0.8, 'sine',     0.3,  vol, buf);
      writeTone(784, 0.6, 1.0, 'sine',     0.3,  vol, buf);
      break;
    case 'melody':
      [523, 659, 784, 1047].forEach((f, i) =>
        writeTone(f, i * 0.2, 0.5, 'sine', 0.3,  vol, buf));
      break;
    case 'knock':
      writeTone(200, 0,   0.1, 'square',   0.5,  vol, buf);
      writeTone(180, 0.2, 0.1, 'square',   0.5,  vol, buf);
      writeTone(200, 0.5, 0.1, 'square',   0.4,  vol, buf);
      break;
    case 'drop':
      writeTone(1200, 0,    0.3, 'sine',   0.3,  vol, buf);
      writeTone(800,  0.15, 0.4, 'sine',   0.25, vol, buf);
      writeTone(600,  0.35, 0.5, 'sine',   0.2,  vol, buf);
      break;
    case 'bell':
      writeTone(880, 0,   1.2, 'sine',     0.4,  vol, buf);
      writeTone(660, 0.8, 1.0, 'sine',     0.3,  vol, buf);
      break;
    case 'phone':
      for (let i = 0; i < 4; i++) {
        writeTone(1400, i * 0.3,        0.12, 'square', 0.3, vol, buf);
        writeTone(1800, i * 0.3 + 0.12, 0.12, 'square', 0.3, vol, buf);
      }
      break;
    case 'alarm':
      for (let i = 0; i < 6; i++)
        writeTone(800 + (i % 2) * 400, i * 0.25, 0.2, 'sawtooth', 0.25, vol, buf);
      break;
    default:
      writeTone(880, 0,   0.5, 'sine',     0.4,  vol, buf);
      writeTone(659, 0.4, 0.9, 'sine',     0.4,  vol, buf);
      break;
  }
  return buf;
}

function float32ToInt16Buffer(f32) {
  const out = Buffer.alloc(f32.length * 2);
  for (let i = 0; i < f32.length; i++) {
    const s = Math.max(-1, Math.min(1, f32[i]));
    out.writeInt16LE(Math.round(s * 32767), i * 2);
  }
  return out;
}

/**
 * 알람음 재생
 * @param {string} type   'dingdong'|'chime'|'melody'|'knock'|'drop'|'bell'|'phone'|'alarm'
 * @param {number} volume 0..1
 * @returns {Promise<void>}
 */
function playAlert(type, volume) {
  return new Promise((resolve) => {
    let Speaker;
    try { Speaker = require('speaker'); } catch (_) { return resolve(); }

    const f32         = synthesize(type, volume);
    const pcm         = float32ToInt16Buffer(f32);
    const durationMs  = Math.round((f32.length / SAMPLE_RATE) * 1000);

    let settled = false;
    const finish = () => { if (!settled) { settled = true; resolve(); } };

    const speaker = new Speaker({ channels: CHANNELS, bitDepth: BIT_DEPTH, sampleRate: SAMPLE_RATE });
    speaker.on('error', finish);
    speaker.on('close', finish);
    speaker.write(pcm);
    speaker.end();
    setTimeout(finish, durationMs + 600);
  });
}

module.exports = { playAlert };
