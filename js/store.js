// store.js — 블로그 포스트 상태 + 이벤트 버스 + localStorage 자동저장
// 스키마 설계: "내용은 사람/AI가 쓰고, 구조(HTML/MD 렌더)와 분석은 코드가" — cardnews-studio와 같은 계약
import { uid } from './util.js';

const STORAGE_KEY = 'blogpost-studio-v1';

class Store {
  constructor() {
    this.listeners = new Map();
    this.post = null;
    this.selected = { kind: 'section', index: 0 }; // 'intro' | 'section' | 'conclusion'
    this.lastDeleted = null;
  }

  on(event, fn) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(fn);
    return () => this.listeners.get(event).delete(fn);
  }

  emit(event, payload) {
    const set = this.listeners.get(event);
    if (set) for (const fn of set) fn(payload);
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p && Array.isArray(p.sections)) {
          this.post = normalizePost(p);
          this.selected = { kind: 'section', index: 0 };
          return true;
        }
      }
    } catch (e) {
      console.warn('[blogpost] 저장본 복원 실패:', e);
    }
    return false;
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.post));
      this.emit('saved');
      return true;
    } catch (e) {
      this.emit('quota-exceeded');
      return false;
    }
  }

  setPost(p, { silent = false } = {}) {
    this.post = normalizePost(p);
    this.selected = { kind: 'section', index: 0 };
    if (!silent) this.emit('post');
  }

  update(mutator) {
    mutator(this.post);
    this.save();
    this.emit('post');
  }

  select(kind, index = 0) {
    this.selected = { kind, index };
    this.emit('selection');
  }

  get current() {
    const { kind, index } = this.selected;
    if (kind === 'intro') return { kind, paragraphs: this.post.intro };
    if (kind === 'conclusion') return { kind, paragraphs: this.post.conclusion };
    return { kind: 'section', section: this.post.sections[index] || null, index };
  }

  addSection(afterIndex = null) {
    const section = blankSection();
    const at = afterIndex === null ? this.post.sections.length : afterIndex + 1;
    this.post.sections.splice(at, 0, section);
    this.selected = { kind: 'section', index: at };
    this.save();
    this.emit('post');
    this.emit('selection');
    return section;
  }

  duplicateSection(index) {
    const src = this.post.sections[index];
    if (!src) return;
    const copy = JSON.parse(JSON.stringify(src));
    copy.id = uid();
    this.post.sections.splice(index + 1, 0, copy);
    this.selected = { kind: 'section', index: index + 1 };
    this.save();
    this.emit('post');
    this.emit('selection');
  }

  deleteSection(index) {
    if (this.post.sections.length <= 1) {
      this.emit('blocked');
      return;
    }
    const section = this.post.sections[index];
    this.lastDeleted = { section, index };
    this.post.sections.splice(index, 1);
    this.selected = { kind: 'section', index: Math.min(index, this.post.sections.length - 1) };
    this.save();
    this.emit('post');
    this.emit('selection');
  }

  restoreDeleted() {
    if (!this.lastDeleted) return;
    const { section, index } = this.lastDeleted;
    this.post.sections.splice(Math.min(index, this.post.sections.length), 0, section);
    this.selected = { kind: 'section', index: Math.min(index, this.post.sections.length - 1) };
    this.lastDeleted = null;
    this.save();
    this.emit('post');
    this.emit('selection');
  }

  moveSection(index, dir) {
    const to = index + dir;
    const arr = this.post.sections;
    if (index < 0 || index >= arr.length || to < 0 || to >= arr.length) return;
    [arr[index], arr[to]] = [arr[to], arr[index]];
    this.selected = { kind: 'section', index: to };
    this.save();
    this.emit('post');
    this.emit('selection');
  }
}

export function blankSection() {
  return {
    id: uid(),
    h2: '',
    paragraphs: [''],
    list: [],
    image: null, // { src, alt, w, h }
  };
}

export const TONES = {
  expert: '전문적이고 신뢰감 있는 정보형 톤 (두괄식, 근거 제시)',
  friendly: '친근한 개인 블로그 톤 (~습니다체, 경험 전달)',
  review: '후기·리뷰 톤 (장단점, 사용 경험 중심)',
  news: '뉴스·리포트 톤 (사실 중심, 간결)',
};

export const LENGTHS = [
  { value: 800, label: '얇게 · 약 800자' },
  { value: 1500, label: '표준 · 약 1,500자' },
  { value: 2500, label: '깊게 · 약 2,500자' },
  { value: 3500, label: '아주 깊게 · 약 3,500자' },
];

// 외부 JSON(AI 초안 등)을 내부 스키마로 정규화
export function normalizePost(input) {
  const p = typeof input === 'string' ? JSON.parse(input) : input;
  const str = (v, fb) => (typeof v === 'string' ? v : fb);
  const lines = (v) => {
    if (typeof v === 'string') return v.split(/\n{2,}|\r\n{2,}/).map((s) => s.trim()).filter(Boolean);
    if (Array.isArray(v)) return v.map((s) => (typeof s === 'string' ? s : '')).filter((s) => s.trim() !== '');
    return [];
  };

  const out = {
    version: 1,
    title: str(p.title, ''),
    metaDesc: str(p.metaDesc || p.metaDescription, ''),
    slug: str(p.slug, ''),
    mainKeyword: str(p.mainKeyword || p.keyword, ''),
    subKeywords: Array.isArray(p.subKeywords || p.sub) ? (p.subKeywords || p.sub).filter((k) => typeof k === 'string') : [],
    targetChars: Number.isFinite(p.targetChars) && p.targetChars >= 300 ? Math.round(p.targetChars) : 1500,
    tone: TONES[p.tone] ? p.tone : 'expert',
    tags: Array.isArray(p.tags) ? p.tags.filter((t) => typeof t === 'string') : [],
    internalLinks: Array.isArray(p.internalLinks)
      ? p.internalLinks.map((l) => ({ text: str(l?.text || l?.anchor, ''), url: str(l?.url, '') })).filter((l) => l.text && l.url)
      : [],
    externalLinks: Array.isArray(p.externalLinks)
      ? p.externalLinks.map((l) => ({ text: str(l?.text || l?.anchor, ''), url: str(l?.url, '') })).filter((l) => l.text && l.url)
      : [],
    topic: str(p.topic, ''),
    intro: lines(p.intro),
    conclusion: lines(p.conclusion),
    sections: [],
  };

  const sections = Array.isArray(p.sections) ? p.sections : [];
  for (const s of sections) {
    const sec = blankSection();
    sec.h2 = str(s?.h2 || s?.heading || s?.title, '');
    sec.paragraphs = lines(s?.paragraphs || s?.body);
    if (Array.isArray(s?.list)) sec.list = s.list.map((i) => (typeof i === 'string' ? i : '')).filter((i) => i.trim());
    if (s?.image && typeof s.image === 'object' && typeof s.image.src === 'string' && /^data:|^https?:/.test(s.image.src)) {
      sec.image = { src: s.image.src, alt: str(s.image.alt, ''), w: s.image.w || 0, h: s.image.h || 0 };
    }
    out.sections.push(sec);
  }
  if (!out.sections.length) out.sections = [blankSection()];
  return out;
}

export const store = new Store();
