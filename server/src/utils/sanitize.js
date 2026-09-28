import { CODE_LENGTH, NAME_MAX } from '../game/constants.js';

export function sanitizeName(input) {
  if (typeof input !== 'string') return null;
  const cleaned = input
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/[<>&"'`\\/]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NAME_MAX);
  if (!cleaned || !/^[\p{L}\p{N} ]+$/u.test(cleaned)) return null;
  return cleaned;
}

export function sanitizeCode(input) {
  if (typeof input !== 'string') return null;
  const code = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== CODE_LENGTH) return null;
  return code;
}

export function sanitizeToken(input) {
  if (typeof input !== 'string') return null;
  if (!/^[a-f0-9]{32}$/.test(input)) return null;
  return input;
}
