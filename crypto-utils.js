/**
 * AutoFill Pro — Crypto Utilities
 * AES-256-GCM encryption using the Web Crypto API (native browser, zero dependencies)
 * by Refora Technologies
 */

var CryptoUtils = CryptoUtils || (() => {
  const ALGORITHM = 'AES-GCM';
  const KEY_LENGTH = 256;
  const PBKDF2_ITERATIONS = 100000;
  const SALT_LENGTH = 16;
  const IV_LENGTH = 12;

  // Derive a stable seed from the extension's own ID
  function getSeed() {
    return chrome.runtime.id + '_refora_autofill_pro_v2';
  }

  // Convert string to ArrayBuffer
  function strToBuffer(str) {
    return new TextEncoder().encode(str);
  }

  // Convert ArrayBuffer to base64
  function bufferToBase64(buffer) {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
  }

  // Convert base64 to ArrayBuffer
  function base64ToBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }

  // Derive a CryptoKey from a passphrase + salt using PBKDF2
  async function deriveKey(passphrase, salt) {
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      strToBuffer(passphrase),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: ALGORITHM, length: KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt a plain JavaScript object.
   * Returns a base64-encoded string: salt + iv + ciphertext
   */
  async function encrypt(data) {
    const passphrase = getSeed();
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const key = await deriveKey(passphrase, salt);

    const plaintext = strToBuffer(JSON.stringify(data));
    const ciphertext = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, key, plaintext);

    // Pack: [salt(16)] + [iv(12)] + [ciphertext]
    const packed = new Uint8Array(SALT_LENGTH + IV_LENGTH + ciphertext.byteLength);
    packed.set(salt, 0);
    packed.set(iv, SALT_LENGTH);
    packed.set(new Uint8Array(ciphertext), SALT_LENGTH + IV_LENGTH);

    return bufferToBase64(packed.buffer);
  }

  /**
   * Decrypt a base64-encoded encrypted blob back to a JS object.
   */
  async function decrypt(encryptedBase64) {
    const passphrase = getSeed();
    const packed = new Uint8Array(base64ToBuffer(encryptedBase64));

    const salt = packed.slice(0, SALT_LENGTH);
    const iv = packed.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const ciphertext = packed.slice(SALT_LENGTH + IV_LENGTH);

    const key = await deriveKey(passphrase, salt);
    const plaintext = await crypto.subtle.decrypt({ name: ALGORITHM, iv }, key, ciphertext);

    return JSON.parse(new TextDecoder().decode(plaintext));
  }

  return { encrypt, decrypt };
})();

// For use in background service worker (cannot use export in MV3 SW)
if (typeof module !== 'undefined') {
  module.exports = CryptoUtils;
}
