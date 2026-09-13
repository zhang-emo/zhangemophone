/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Simple client-side obfuscation & encryption helper to prevent raw API keys in local storage
// Uses Web Crypto API (AES-GCM) where available, falling back to secure custom XOR-Base64 masking 
// to ensure zero plain-text storage of secret credentials.

const WEBCRYPTO_KEY_NAME = 'mobile_ai_chat_aes_master';

/**
 * Generates or retrieves a persistent device-specific key for seamless crypto.
 * Stored in localStorage as an obfuscated string, used as a salt/key for AES-GCM.
 */
function getOrCreateDeviceKey(): string {
  let master = localStorage.getItem(WEBCRYPTO_KEY_NAME);
  if (!master) {
    try {
      if (window.crypto && window.crypto.getRandomValues) {
        const array = new Uint8Array(32);
        window.crypto.getRandomValues(array);
        master = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
      } else {
        master = Math.random().toString(36).substring(2) + Date.now().toString(36);
      }
    } catch (_) {
      master = Math.random().toString(36).substring(2) + Date.now().toString(36);
    }
    localStorage.setItem(WEBCRYPTO_KEY_NAME, master);
  }
  return master;
}

/**
 * Sophisticated mask function that encrypts text with a password/passkey.
 * Falls back to device key if custom password is not specified.
 */
export async function encryptText(text: string, customKey?: string): Promise<string> {
  if (!text) return '';
  const keyStr = customKey || getOrCreateDeviceKey();
  
  try {
    if (!window.crypto || !window.crypto.subtle) {
      return fallbackEncrypt(text, keyStr);
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    
    // Hash key to ensure it is 256-bit
    const keyHash = await window.crypto.subtle.digest('SHA-256', encoder.encode(keyStr));
    const cryptoKey = await window.crypto.subtle.importKey(
      'raw',
      keyHash,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );
    
    // IV must be 12 bytes
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      data
    );
    
    // Combine IV and Encrypted details as hex or base64
    const encryptedArray = new Uint8Array(encrypted);
    const combined = new Uint8Array(iv.length + encryptedArray.length);
    combined.set(iv, 0);
    combined.set(encryptedArray, iv.length);
    
    return btoa(String.fromCharCode(...combined));
  } catch (e) {
    // Fallback Masking if WebCrypto fails or is in non-secure context (e.g. HTTP/ArkWeb)
    return fallbackEncrypt(text, keyStr);
  }
}

/**
 * Decrypts masked text with key.
 */
export async function decryptText(cipherText: string, customKey?: string): Promise<string> {
  if (!cipherText) return '';

  // Direct plain text key check (e.g. sk- or AIza)
  if (cipherText.startsWith('sk-') || cipherText.startsWith('AIza') || cipherText.startsWith('http')) {
    return cipherText;
  }

  const keyStr = customKey || getOrCreateDeviceKey();
  
  try {
    if (!window.crypto || !window.crypto.subtle) {
      const fbDecrypted = fallbackDecrypt(cipherText, keyStr);
      return fbDecrypted || cipherText;
    }

    const encoder = new TextEncoder();
    const combined = new Uint8Array(
      atob(cipherText).split('').map(char => char.charCodeAt(0))
    );
    
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    
    const keyHash = await window.crypto.subtle.digest('SHA-256', encoder.encode(keyStr));
    const cryptoKey = await window.crypto.subtle.importKey(
      'raw',
      keyHash,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );
    
    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      data
    );
    
    const decoder = new TextDecoder();
    const result = decoder.decode(decrypted);
    return result || cipherText;
  } catch (e) {
    const fbDecrypted = fallbackDecrypt(cipherText, keyStr);
    return fbDecrypted || cipherText;
  }
}

// Fallback simple masking logic for full environmental coverage
function fallbackEncrypt(text: string, key: string): string {
  const binaryText = encodeURIComponent(text);
  let result = '';
  for (let i = 0; i < binaryText.length; i++) {
    const keyChar = key.charCodeAt(i % key.length);
    const textChar = binaryText.charCodeAt(i);
    result += String.fromCharCode(textChar ^ keyChar);
  }
  return btoa(result);
}

function fallbackDecrypt(cipherText: string, key: string): string {
  try {
    const decoded = atob(cipherText);
    let result = '';
    for (let i = 0; i < decoded.length; i++) {
      const keyChar = key.charCodeAt(i % key.length);
      const cipherChar = decoded.charCodeAt(i);
      result += String.fromCharCode(cipherChar ^ keyChar);
    }
    return decodeURIComponent(result);
  } catch {
    return '';
  }
}
