// exporters.js — WordPress HTML / Markdown / ZIP 패키지 / 카드뉴스 프로젝트 변환
import { makeZip } from './zip.js';
import { escapeHtml as esc, slugify, download } from './util.js';

// ---------- WordPress 붙여넣기용 본문 HTML ----------
// 이미지는 dataURL이면 ZIP 안 images/ 파일로 빼고 상대경로로 치환한다 (웹에서 바로 붙여넣기 모드는 dataURL 유지)
export function buildBodyHTML(post, { imageDir = 'images' } = {}) {
  const out = [];

  if (post.intro.length) {
    for (const p of post.intro) out.push(`<p>${inline(esc(p))}</p>`);
  }

  post.sections.forEach((s, i) => {
    if ((s.h2 || '').trim()) out.push(`<h2>${esc(s.h2)}</h2>`);
    for (const p of s.paragraphs) if (p.trim()) out.push(`<p>${inline(esc(p))}</p>`);
    if (s.list.length) {
      out.push('<ul>');
      for (const item of s.list) out.push(`\t<li>${inline(esc(item))}</li>`);
      out.push('</ul>');
    }
    if (s.image) {
      const src = /^data:/.test(s.image.src) ? `${imageDir}/section-${String(i + 1).padStart(2, '0')}.jpg` : s.image.src;
      out.push(`<figure><img src="${esc(src)}" alt="${esc(s.image.alt || '')}"/>${s.image.alt ? '' : ''}</figure>`);
    }
  });

  if (post.conclusion.length) {
    for (const p of post.conclusion) out.push(`<p>${inline(esc(p))}</p>`);
  }

  if (post.internalLinks.length || post.externalLinks.length) {
    out.push('<h3>함께 보면 좋은 글</h3>');
    out.push('<ul>');
    for (const l of post.internalLinks) out.push(`\t<li><a href="${esc(l.url)}">${esc(l.text)}</a></li>`);
    for (const l of post.externalLinks) out.push(`\t<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.text)}</a></li>`);
    out.push('</ul>');
  }

  return out.join('\n');
}

// 문단 내 \n → <br>
function inline(s) {
  return s.replace(/\n/g, '<br>');
}

// ---------- Markdown ----------
export function buildMarkdown(post, { imageDir = 'images' } = {}) {
  const out = [];
  out.push(`# ${post.title || '제목 없음'}`);
  out.push('');

  for (const p of post.intro) if (p.trim()) out.push(p, '');

  post.sections.forEach((s, i) => {
    if ((s.h2 || '').trim()) out.push(`## ${s.h2}`, '');
    for (const p of s.paragraphs) if (p.trim()) out.push(p, '');
    if (s.list.length) {
      s.list.forEach((item) => out.push(`- ${item}`));
      out.push('');
    }
    if (s.image) {
      const src = /^data:/.test(s.image.src) ? `${imageDir}/section-${String(i + 1).padStart(2, '0')}.jpg` : s.image.src;
      out.push(`![${s.image.alt || ''}](${src})`, '');
    }
  });

  for (const p of post.conclusion) if (p.trim()) out.push(p, '');

  if (post.internalLinks.length || post.externalLinks.length) {
    out.push('### 함께 보면 좋은 글', '');
    for (const l of post.internalLinks) out.push(`- [${l.text}](${l.url})`);
    for (const l of post.externalLinks) out.push(`- [${l.text}](${l.url})`);
    out.push('');
  }
  return out.join('\n');
}

// ---------- 메타 (SEO 필드 — Rank Math/Yoast 칸에 그대로 붙여넣는다) ----------
export function buildMeta(post) {
  return {
    title: post.title,
    metaDescription: post.metaDesc,
    slug: post.slug,
    focusKeyword: post.mainKeyword,
    subKeywords: post.subKeywords,
    tags: post.tags,
    tone: post.tone,
    targetChars: post.targetChars,
    links: {
      internal: post.internalLinks,
      external: post.externalLinks,
    },
  };
}

// ---------- ZIP 패키지 ----------
export async function exportZip(post, onProgress) {
  const base = slugify(post.title || 'post');
  const files = [];
  const imageJobs = [];

  // 이미지 dataURL → 파일로 변환
  const imgMap = new Map(); // sectionId → 상대경로
  for (let i = 0; i < post.sections.length; i++) {
    const s = post.sections[i];
    if (s.image && /^data:/.test(s.image.src)) {
      const name = `images/section-${String(i + 1).padStart(2, '0')}.jpg`;
      imgMap.set(s.id, name);
      imageJobs.push({ name, src: s.image.src });
    }
  }

  const html = buildBodyHTML(post);
  const md = buildMarkdown(post);
  const meta = buildMeta(post);

  files.push({ name: 'post.html', data: enc(html) });
  files.push({ name: 'post.md', data: enc(md) });
  files.push({ name: 'meta.json', data: enc(JSON.stringify(meta, null, 2)) });
  files.push({ name: 'publish-guide.txt', data: enc(publishGuide(post)) });

  for (const job of imageJobs) {
    if (onProgress) onProgress(files.length, imageJobs.length + 4);
    const blob = await (await fetch(job.src)).blob();
    files.push({ name: job.name, data: new Uint8Array(await blob.arrayBuffer()) });
  }

  if (onProgress) onProgress(imageJobs.length + 4, imageJobs.length + 5);
  const zip = makeZip(files);
  download(new Blob([zip], { type: 'application/zip' }), `${base}-blogpost.zip`);
  return true;
}

function enc(s) {
  return new TextEncoder().encode(s);
}

function publishGuide(post) {
  return [
    'WordPress 발행 가이드 (블로그 포스트 스튜디오 내보내기)',
    '',
    '1. post.html 내용을 글 편집기 "코드 에디터" 모드로 붙여넣습니다 (비주얼 모드 X).',
    '2. 제목 칸에 아래 제목을 넣습니다:',
    `   ${post.title}`,
    '3. images/ 폴더의 이미지를 미디어 라이브러리에 올리고, 본문 figure/img의 src를 업로드된 URL로 교체합니다.',
    '4. SEO 플러그인(Rank Math 등) 칸에 meta.json 값을 넣습니다:',
    `   - 포커스 키워드: ${post.mainKeyword || '(없음)'}`,
    `   - 메타 설명: ${post.metaDesc || '(없음)'}`,
    `   - 슬러그: ${post.slug || '(없음)'}`,
    `   - 태그: ${post.tags.join(', ') || '(없음)'}`,
    '5. images 폴더를 안 쓰고 dataURL을 유지한 상태로 붙여넣을 수도 있지만, 파일 크기가 커져 권장하지 않습니다.',
    '',
    `준비도 점수 기준: ${post.targetChars}자 목표 / 톤: ${post.tone}`,
  ].join('\n');
}

// ---------- 카드뉴스 프로젝트 변환 (세트 연결: 블로그 → 카드뉴스 7장 초안) ----------
export function toCardnewsProject(post) {
  const cards = [];

  // 1) 표지: 제목
  cards.push({
    layout: 'cover-media',
    badge: (post.tags && post.tags[0]) || 'BLOG',
    title: splitTitle(post.title || '제목 없음'),
    body: firstSentence(post.intro[0] || '', 60) || [],
    items: [],
  });

  // 2) 체크리스트: 서브 키워드 또는 첫 리스트 기반 핵심 요약
  const checkSrc = post.subKeywords.length >= 2
    ? post.subKeywords
    : (post.sections.find((s) => s.list.length >= 2) || { list: [] }).list;
  if (checkSrc && checkSrc.length >= 2) {
    cards.push({
      layout: 'checklist',
      badge: '',
      title: ['핵심 정리'],
      body: ['먼저 이것만 확인하세요'],
      items: checkSrc.slice(0, 5).map((s) => trimTo(s, 28)),
    });
  }

  // 3~6) 섹션 카드 (최대 4장): H2 + 첫 문단 앞부분
  const bodySlots = 7 - cards.length - 1; // 마지막 CTA 제외
  post.sections.slice(0, Math.max(0, bodySlots)).forEach((s) => {
    const body = firstSentence((s.paragraphs.find((p) => p.trim()) || ''), 64);
    cards.push({
      layout: 'media-top',
      badge: '',
      title: splitTitle(s.h2 || '섹션'),
      body: body || ['자세한 내용은 블로그에서'],
      media: null,
      items: [],
    });
  });

  // 7) CTA
  cards.push({
    layout: 'cta',
    badge: '',
    title: ['전체 가이드는', '블로그에 정리했어요'],
    body: ['검색 없이 저장해 두면 편해요.'],
    items: [{ text: '', action: '블로그에서 계속 읽기' }],
  });

  return {
    title: `[카드뉴스] ${post.title || '제목 없음'}`,
    handle: '@your_handle',
    sourceLabel: 'BLOG',
    sourceUrl: '',
    theme: 'light',
    accent: '#0071e3',
    hashtags: (post.tags || []).map((t) => (t.startsWith('#') ? t : `#${t}`)).slice(0, 5),
    cards,
  };
}

function splitTitle(title) {
  // 제목을 의미 단위로 1~3줄로 나눈다 — 공백 단어 기반 단순 분할 (한국어 복합어 보호를 위해 14자 기준)
  const words = title.split(/\s+/);
  if (words.length <= 2) return words.length ? [title] : [''];
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > 14 && cur) {
      lines.push(cur.trim());
      cur = w;
    } else {
      cur = (cur + ' ' + w).trim();
    }
    if (lines.length === 2) break;
  }
  if (cur && lines.length < 3) lines.push(cur.trim());
  return lines.slice(0, 3);
}

// 첫 문장(또는 maxLen 앞부분)을 카드 한 줄 배열로 반환 — 카드뉴스 표지·섹션 요약용
function firstSentence(text, maxLen) {
  const t = (text || '').replace(/\n/g, ' ').trim();
  if (!t) return null;
  const cut = t.slice(0, maxLen);
  const dot = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  const s = (dot > 10 ? cut.slice(0, dot + 1) : cut).trim();
  return s ? [s] : null;
}

function trimTo(s, max) {
  const t = (s || '').trim();
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
}

export function downloadCardnewsProject(post) {
  const project = toCardnewsProject(post);
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
  download(blob, `${slugify(post.title || 'post')}-cardnews-project.json`);
  return project;
}

// ---------- 클립보드용 ----------
export async function copyHTML(post) {
  const html = buildBodyHTML(post);
  try {
    await navigator.clipboard.writeText(html);
    return true;
  } catch {
    return false;
  }
}
