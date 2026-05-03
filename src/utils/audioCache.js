// src/utils/audioCache.js
//
// sessionStorage-backed audio blob cache for the Listening module.
// Avoids re-fetching TTS audio for content already retrieved this session.
//
// Storage keys:
//   listening_audio_{hash}          — monologue (single entry)
//   listening_audio_{hash}_{index}  — dialogue line by index
//
// Values stored: raw base64 string as returned by api/tts.js.
// Object URLs are also held in a module-level Map for fast in-session
// reuse without repeated base64→Blob decode.

const PREFIX = "listening_audio_";

// In-memory object URL registry — avoids repeated decode within a page load
const _objUrls = new Map();

function _key(hash, index) {
  return index === undefined
    ? `${PREFIX}${hash}`
    : `${PREFIX}${hash}_${index}`;
}

function _base64ToBlob(base64) {
  const binary = atob(base64);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: "audio/mpeg" });
}

/**
 * Store base64 audio and return an object URL for immediate playback.
 * @param {string} hash    - content hash from listening-generate response
 * @param {string} base64  - audioContent from api/tts.js
 * @param {number} [index] - line index for dialogue; omit for monologue
 * @returns {string} object URL
 */
export function cacheAudio(hash, base64, index) {
  const k = _key(hash, index);
  try {
    sessionStorage.setItem(k, base64);
  } catch {
    // Storage full — skip persistence; object URL still works this session
  }
  const objUrl = URL.createObjectURL(_base64ToBlob(base64));
  _objUrls.set(k, objUrl);
  return objUrl;
}

/**
 * Retrieve a cached object URL. Returns null if not cached.
 */
export function getCachedAudio(hash, index) {
  const k = _key(hash, index);
  if (_objUrls.has(k)) return _objUrls.get(k);
  try {
    const base64 = sessionStorage.getItem(k);
    if (!base64) return null;
    const objUrl = URL.createObjectURL(_base64ToBlob(base64));
    _objUrls.set(k, objUrl);
    return objUrl;
  } catch {
    return null;
  }
}

/**
 * Check if audio is cached without decoding.
 */
export function isAudioCached(hash, index) {
  const k = _key(hash, index);
  if (_objUrls.has(k)) return true;
  try {
    return sessionStorage.getItem(k) !== null;
  } catch {
    return false;
  }
}

/**
 * Revoke all object URLs created this page load. Call on module unmount.
 */
export function revokeAllAudio() {
  for (const url of _objUrls.values()) {
    try { URL.revokeObjectURL(url); } catch { /* ignore */ }
  }
  _objUrls.clear();
}