// util.js — 공용 유틸 (cardnews-studio와 동일 컨벤션)
export const log = {
  info: (...a) => console.info('[blogpost]', ...a),
  warn: (...a) => console.warn('[blogpost]', ...a),
  error: (...a) => console.error('[blogpost]', ...a),
};

export function uid(prefix = 's') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

export function slugify(s) {
  return (s || 'post')
    .trim()
    .replace(/[\s/\\]+/g, '-')
    .replace(/[^가-힣a-zA-Z0-9_-]/g, '')
    .slice(0, 60) || 'post';
}

export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 공백 포한 글자 수 (플러그인과 동일 기준)
export function charCount(s) {
  return String(s ?? '').replace(/\s+/g, (m) => (m.includes('\n') ? ' ' : m)).length;
}

export function plainCount(s) {
  return String(s ?? '').length;
}

// 키워드가 텍스트에 포함되는지: 정확 일치 또는 모든 단어 포함 (플러그인과 동일 판정)
export function keywordIn(keyword, text) {
  const kw = (keyword || '').trim().toLowerCase();
  if (!kw) return false;
  const t = (text || '').toLowerCase();
  if (t.includes(kw)) return true;
  const words = kw.split(/\s+/).filter((w) => w.length > 1);
  if (words.length < 2) return false;
  return words.every((w) => t.includes(w));
}

// 문자열 내 등장 횟수 (대소문자 무시)
export function occurrences(keyword, text) {
  const kw = (keyword || '').trim().toLowerCase();
  const t = (text || '').toLowerCase();
  if (!kw) return 0;
  let count = 0;
  let pos = t.indexOf(kw);
  while (pos !== -1) {
    count++;
    pos = t.indexOf(kw, pos + kw.length);
  }
  return count;
}

export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export function loadImg(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('이미지 로드 실패'));
    img.src = src;
  });
}

// 업로드 이미지를 최대 edge 크기로 리샘플해 JPEG dataURL로 정규화
export async function normalizeImage(file, maxEdge = 1600) {
  const src = await readFileAsDataURL(file);
  const img = await loadImg(src);
  const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  cv.getContext('2d').drawImage(img, 0, 0, w, h);
  const type = /png$/i.test(file.type) && file.size < 1_500_000 ? 'image/png' : 'image/jpeg';
  return { src: cv.toDataURL(type, 0.85), w, h };
}
