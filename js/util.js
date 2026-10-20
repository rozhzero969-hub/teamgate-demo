'use strict';

/* ---------------------------------------------------------------
   Safe templating
   Every value interpolated into html`` is escaped, so editable text
   is always rendered as text. Only values wrapped in raw() (or the
   result of another html`` call) are inserted as markup.
   --------------------------------------------------------------- */
class Raw {
  constructor(s) { this.s = s; }
}
const raw = (s) => new Raw(String(s));

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };
function esc(value) {
  return String(value).replace(/[&<>"'`]/g, (c) => ESCAPES[c]);
}

function renderValue(v) {
  if (v === null || v === undefined || v === false || v === true) return '';
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(renderValue).join('');
  return esc(v);
}

function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += renderValue(values[i]) + strings[i + 1];
  return new Raw(out);
}

/* Boolean attribute helpers */
const attrIf = (cond, name) => (cond ? raw(` ${name}`) : '');

function options(list, current) {
  return list.map(([value, label]) => html`<option value="${value}"${attrIf(value === current, 'selected')}>${label}</option>`);
}

/* ---------------------------------------------------------------
   Small utilities
   --------------------------------------------------------------- */
function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function clone(value) {
  return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

const nowIso = () => new Date().toISOString();

function fmtDate(iso) {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtDateTime(iso) {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function fmtBytes(n) {
  if (n < 1024) return `${n} bytes`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function initials(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  if (words.length > 1) return (words[0][0] + words[1][0]).toUpperCase();
  const caps = words[0].match(/[A-Z]/g);
  if (caps && caps.length >= 2) return caps[0] + caps[1];
  return words[0].slice(0, 2).toUpperCase();
}

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/g, '');
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/* ---------------------------------------------------------------
   Colour helpers (keep accent-coloured UI readable)
   --------------------------------------------------------------- */
const isHexColor = (v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(rgb) {
  return `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
}

function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function mix(hex, withHex, amount) {
  const a = hexToRgb(hex);
  const b = hexToRgb(withHex);
  return rgbToHex(a.map((c, i) => c + (b[i] - c) * amount));
}

/* CSS custom properties derived from one accent colour. */
function themeVars(accent) {
  const base = isHexColor(accent) ? accent.toLowerCase() : DEFAULT_ACCENT;
  const onAccent = contrast(base, '#ffffff') >= contrast(base, '#111827') ? '#ffffff' : '#111827';
  let text = base;
  for (let i = 0; i < 10 && contrast(text, '#ffffff') < 4.6; i++) text = mix(text, '#000000', 0.15);
  return {
    '--accent': base,
    '--accent-contrast': onAccent,
    '--accent-text': text,
    '--accent-soft': mix(base, '#ffffff', 0.9),
    '--accent-border': mix(base, '#ffffff', 0.7),
  };
}

const themeStyle = (accent) => Object.entries(themeVars(accent)).map(([k, v]) => `${k}:${v}`).join(';');

/* ---------------------------------------------------------------
   Image validation (PNG, JPEG, WebP up to 2 MB)
   --------------------------------------------------------------- */
const isSafeImage = (v) => typeof v === 'string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v);

function matchesSignature(bytes, type) {
  const b = Array.from(bytes);
  if (type === 'image/png') return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v);
  if (type === 'image/jpeg') return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (type === 'image/webp') {
    const ascii = (from, to) => String.fromCharCode(...b.slice(from, to));
    return ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP';
  }
  return false;
}

async function readImageFile(file) {
  if (!file) return { ok: false, error: 'No file was selected.' };
  if (!IMAGE_TYPES.includes(file.type)) {
    return { ok: false, error: `“${file.name}” can't be used. Please choose a PNG, JPEG, or WebP image.` };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: `“${file.name}” is ${fmtBytes(file.size)}. Images must be 2 MB or smaller.` };
  }
  try {
    const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    if (!matchesSignature(head, file.type)) {
      return { ok: false, error: `“${file.name}” doesn't appear to be a valid PNG, JPEG, or WebP image.` };
    }
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    if (!isSafeImage(dataUrl)) return { ok: false, error: `“${file.name}” couldn't be read as an image.` };
    return { ok: true, dataUrl };
  } catch {
    return { ok: false, error: `“${file.name}” couldn't be read. Please try a different image.` };
  }
}
