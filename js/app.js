// app.js — 블로그 포스트 스튜디오 메인 애플리케이션
import { store, normalizePost, TONES, LENGTHS, blankSection } from './store.js';
import { samplePost } from './sample.js';
import { analyze, bodyChars, readinessLabel } from './analyze.js';
import { buildBodyHTML, buildMarkdown, exportZip, copyHTML, downloadCardnewsProject } from './exporters.js';
import { download, slugify, normalizeImage, log } from './util.js';

const $ = (sel) => document.querySelector(sel);

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(c));
  }
  return node;
}

let analysis = null; // 마지막 analyze 결과

// ---------- 토스트 / 모달 ----------
function toast(message, { type = '', actionLabel = '', onAction = null, timeout = 3200 } = {}) {
  const area = $('#toast-area');
  const t = el('div', { class: `toast ${type}` },
    el('span', {}, message),
    actionLabel && onAction ? el('button', { onclick: () => { onAction(); t.remove(); } }, actionLabel) : null
  );
  area.append(t);
  if (timeout > 0) setTimeout(() => t.remove(), timeout);
  return t;
}

function openModal(title, desc, buildContent) {
  const root = $('#modal-root');
  root.innerHTML = '';
  const content = el('div', { class: 'modal-body' });
  const modal = el('div', { class: 'modal', role: 'dialog', 'aria-label': title },
    el('h2', {}, title),
    desc ? el('p', { class: 'modal-desc' }, desc) : null,
    content
  );
  root.append(modal);
  const close = () => { root.innerHTML = ''; document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  buildContent(content, close);
  return close;
}

// ---------- 렌더 파이프라인 ----------
function repaint({ rail = true, editor = true, preview = true, score = true } = {}) {
  analysis = analyze(store.post);
  if (rail) renderRail();
  if (preview) renderPreview();
  if (score) renderScore();
  if (editor) renderEditor();
  renderQA();
}

function renderRail() {
  const rail = $('#outline-rail');
  rail.innerHTML = '';
  const P = store.post;

  rail.append(el('div', { class: 'rail-group-label' }, '글 구성'));

  const introActive = store.selected.kind === 'intro';
  rail.append(railItem({
    no: '서론', title: '도입부', meta: `${P.intro.length}문단`,
    active: introActive, onclick: () => store.select('intro'),
  }));

  P.sections.forEach((s, i) => {
    const metas = [`${paraChars(s)}자`];
    if (s.list.length) metas.push('리스트');
    if (s.image) metas.push('이미지');
    rail.append(railItem({
      no: String(i + 1).padStart(2, '0'),
      title: s.h2 || '(제목 없는 섹션)',
      meta: metas.join(' · '),
      badges: { list: s.list.length > 0, img: !!s.image },
      active: store.selected.kind === 'section' && store.selected.index === i,
      onclick: () => store.select('section', i),
      actions: (item) => {
        item.append(el('div', { class: 'rail-actions' },
          el('button', { title: '위로', onclick: (e) => { e.stopPropagation(); store.moveSection(i, -1); } }, '↑'),
          el('button', { title: '아래로', onclick: (e) => { e.stopPropagation(); store.moveSection(i, 1); } }, '↓'),
          el('button', { title: '복제', onclick: (e) => { e.stopPropagation(); store.duplicateSection(i); } }, '⧉'),
          el('button', { title: '삭제', onclick: (e) => { e.stopPropagation(); deleteSection(i); } }, '✕'),
        ));
      },
    }));
  });

  rail.append(el('button', {
    id: 'btn-add-section', class: 'btn btn-text', onclick: () => store.addSection(),
  }, '+ 섹션 추가'));

  rail.append(el('div', { class: 'rail-group-label', style: 'margin-top:10px' }, '마무리'));
  rail.append(railItem({
    no: '결론', title: '맺음말', meta: `${P.conclusion.length}문단`,
    active: store.selected.kind === 'conclusion', onclick: () => store.select('conclusion'),
  }));
}

function railItem({ no, title, meta, active, onclick, actions = null }) {
  const item = el('div', {
    class: `rail-item ${active ? 'active' : ''}`,
    onclick,
    role: 'button',
    tabindex: '0',
  },
    el('span', { class: 'r-no' }, no),
    el('div', { class: 'r-title' }, title),
    el('div', { class: 'r-meta' }, meta),
  );
  if (actions) actions(item);
  return item;
}

function paraChars(section) {
  const chars = section.paragraphs.join(' ').length + section.list.join(' ').length + (section.h2 || '').length;
  return chars.toLocaleString();
}

function renderPreview() {
  const P = store.post;
  const art = $('#article-preview');
  art.innerHTML = '';

  if (P.title.trim()) art.append(el('h1', { class: 'a-title' }, P.title));
  const metaBits = [];
  if (P.mainKeyword) metaBits.push(`포커스 키워드: ${P.mainKeyword}`);
  metaBits.push(`본문 약 ${bodyChars(P).toLocaleString()}자 / 목표 ${P.targetChars.toLocaleString()}자`);
  if (P.tags.length) metaBits.push(P.tags.map((t) => (t.startsWith('#') ? t : `#${t}`)).join(' '));
  art.append(el('div', { class: 'a-meta' }, metaBits.join(' · ')));

  for (const p of P.intro) {
    if (p.trim()) art.append(el('p', { html: highlightKw(esc(p), P.mainKeyword) }));
  }

  P.sections.forEach((s, i) => {
    const h2 = el('h2', {}, s.h2 || '(제목 없는 섹션)');
    h2.dataset.section = String(i);
    art.append(h2);
    for (const p of s.paragraphs) {
      if (p.trim()) art.append(el('p', { html: highlightKw(esc(p), P.mainKeyword) }));
    }
    if (s.list.length) {
      art.append(el('ul', {}, s.list.map((item) => el('li', { html: highlightKw(esc(item), P.mainKeyword) }))));
    }
    if (s.image) {
      art.append(el('figure', {},
        el('img', { src: s.image.src, alt: s.image.alt || '' }),
        s.image.alt ? el('figcaption', {}, `alt: ${s.image.alt}`) : null,
      ));
    }
  });

  for (const p of P.conclusion) {
    if (p.trim()) art.append(el('p', { html: highlightKw(esc(p), P.mainKeyword) }));
  }

  if (P.internalLinks.length || P.externalLinks.length) {
    const linksBox = el('div', { class: 'a-links' }, el('h3', {}, '함께 보면 좋은 글'), el('ul', {}));
    const ul = linksBox.querySelector('ul');
    for (const l of P.internalLinks) ul.append(el('li', {}, el('a', { href: l.url, onclick: (e) => e.preventDefault() }, l.text), ' — 내부 링크'));
    for (const l of P.externalLinks) ul.append(el('li', {}, el('a', { href: l.url, onclick: (e) => e.preventDefault() }, l.text), ' — 외부 출처'));
    art.append(linksBox);
  }
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function highlightKw(escaped, keyword) {
  const kw = (keyword || '').trim();
  if (!kw) return escaped;
  const safe = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return escaped.replace(new RegExp(`(${safe})`, 'gi'), '<mark class="kw-mark">$1</mark>');
}

function renderScore() {
  const head = $('#score-head');
  const { score } = analysis;
  const { label, tone } = readinessLabel(score);
  head.innerHTML = '';

  const R = 26;
  const C = 2 * Math.PI * R;
  const ring = el('div', { class: 'score-ring' });
  const color = tone === 'ok' ? 'var(--ui-ok)' : tone === 'warn' ? 'var(--ui-warn)' : 'var(--ui-danger)';
  ring.innerHTML = `
    <svg width="62" height="62" viewBox="0 0 62 62">
      <circle cx="31" cy="31" r="${R}" fill="none" stroke="rgba(0,0,0,0.07)" stroke-width="6"/>
      <circle cx="31" cy="31" r="${R}" fill="none" stroke="${color}" stroke-width="6"
        stroke-linecap="round" stroke-dasharray="${(C * score / 100).toFixed(1)} ${C.toFixed(1)}"/>
    </svg>
    <span class="score-num" style="color:${color}">${score}</span>`;
  head.append(ring);

  const passN = analysis.checks.filter((c) => c.result === 'pass').length;
  head.append(el('div', { class: 'score-summary' },
    el('div', { class: 's-label' }, `온페이지 준비도 — ${label}`),
    el('div', { class: 's-sub' },
      `체크리스트 ${passN}/${analysis.checks.length} 통과. 도메인 권위·백링크 같은 사이트 외적 요인은 반영되지 않는 공개 휴리스틱입니다. (검색 경쟁 강도 KD는 SERP API가 필요해 웹버전에서 제외)`),
  ));

  head.append(el('div', { class: 'score-toggles' },
    el('button', { class: 'btn btn-small', onclick: openChecklistModal }, '체크리스트 보기'),
  ));
}

function renderQA() {
  const strip = $('#qa-strip');
  strip.innerHTML = '';
  const rows = analysis.checks
    .filter((c) => c.result !== 'pass')
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3);

  if (!rows.length) {
    strip.append(el('div', { class: 'qa-row ok' }, el('span', { class: 'qa-tag' }, 'OK'), el('span', {}, '모든 체크를 통과했습니다. 내보내기 탭에서 발행 패키지를 만들 수 있습니다.')));
    return;
  }
  for (const c of rows) {
    strip.append(el('div', { class: `qa-row ${c.result}` },
      el('span', { class: `qa-tag ${c.result}` }, c.result === 'warn' ? '주의' : '보완'),
      el('span', {}, `${c.label} — ${c.advice}`),
    ));
  }
  strip.append(el('div', { class: 'qa-row info' },
    el('span', { class: 'qa-tag' }, 'INFO'),
    el('span', {}, `전체 체크리스트는 상단 "체크리스트 보기"에서 확인할 수 있습니다.`),
  ));
}

function openChecklistModal() {
  openModal('온페이지 준비도 체크리스트',
    '가중치·임계값은 워드프레스 플러그인(ai-auto-poster)의 공개 규칙과 동일합니다. 경고는 절반 가중치로 인정됩니다.', (box) => {
      const list = el('div', { class: 'check-list' });
      for (const c of analysis.checks) {
        const icon = c.result === 'pass' ? '✓' : c.result === 'warn' ? '!' : '✕';
        list.append(el('div', { class: `check-row ${c.result}` },
          el('span', { class: 'c-icon' }, icon),
          el('div', { class: 'c-body' },
            el('div', { class: 'c-label' }, c.label, el('span', { class: 'c-weight' }, `가중치 ${c.weight}`)),
            c.result !== 'pass' ? el('div', { class: 'c-advice' }, c.advice) : null,
          ),
        ));
      }
      box.append(list);
      box.append(el('div', { class: 'modal-actions' },
        el('button', { class: 'btn btn-primary', onclick: () => $('#modal-root').click() }, '닫기'),
      ));
      box.querySelector('.btn-primary').addEventListener('click', () => { $('#modal-root').innerHTML = ''; });
    });
}

// ---------- 편집기 ----------
function renderEditor() {
  const pane = $('#editor-pane');
  pane.innerHTML = '';
  const P = store.post;
  const cur = store.current;

  if (cur.kind === 'intro' || cur.kind === 'conclusion') {
    const isIntro = cur.kind === 'intro';
    pane.append(section('도입부', isIntro ? '서론' : '결론'),
      paragraphField(cur.paragraphs, (paras) => {
        store.update((p) => { if (isIntro) p.intro = paras; else p.conclusion = paras; });
      }, isIntro ? '첫 문단 앞쪽에 포커스 키워드를 자연스럽게 배치하세요.' : '핵심 요약·행동 유도로 마무리하세요.'));
    return;
  }

  const s = cur.section;
  if (!s) {
    pane.append(el('p', { style: 'color:var(--ui-sub)' }, '섹션을 선택하거나 추가해 주세요.'));
    return;
  }
  const idx = cur.index;

  pane.append(section(`섹션 ${idx + 1} — H2 소제목`, el('div', {},
    textField('H2 소제목', s.h2, '검색 의도를 담은 소제목', (v) => {
      store.update((p) => { p.sections[idx].h2 = v; });
    }),
    el('div', { class: 'hint', style: 'color:var(--ui-faint);font-size:11px;margin-top:-6px' },
      'H2 중 하나 이상에 포커스 키워드가 들어가면 좋습니다.'),
  )));

  pane.append(section('문단', paragraphField(s.paragraphs, (paras) => {
    store.update((p) => { p.sections[idx].paragraphs = paras; });
  }, '')));

  pane.append(section('리스트 (스니펫용)', linesField('핵심 항목 나열 — 1개 이상이면 구조 체크 통과', s.list, (items) => {
    store.update((p) => { p.sections[idx].list = items; });
  })));

  pane.append(section('이미지', mediaField(s, idx)));
}

function section(titleText, ...children) {
  return el('div', { class: 'editor-section' }, el('h3', {}, titleText), ...children);
}

function textField(labelText, value, placeholder, onChange, type = 'text') {
  const input = el('input', { type, value: value || '', placeholder: placeholder || '' });
  input.addEventListener('input', () => onChange(input.value));
  return el('div', { class: 'field' }, el('label', {}, labelText), input);
}

// 문단 = 텍스트에어리어 1개당 <p> 1개
function paragraphField(paragraphs, onChange, hint) {
  const wrap = el('div', { class: 'field' });
  if (hint) wrap.append(el('div', { class: 'hint', style: 'margin:0 0 8px' }, hint));
  const list = el('div', { class: 'para-list' });
  const arr = paragraphs && paragraphs.length ? paragraphs.slice() : [''];

  const rebuild = () => {
    list.innerHTML = '';
    arr.forEach((text, i) => {
      const ta = el('textarea', { placeholder: '문단을 입력하세요. 하나의 문단 = 하나의 <p>.' });
      ta.value = text;
      autoGrow(ta);
      ta.addEventListener('input', () => {
        arr[i] = ta.value;
        autoGrow(ta);
        onChange(arr.slice());
      });
      list.append(el('div', { class: 'para-row' }, ta,
        el('button', { class: 'row-x', title: '문단 삭제', onclick: () => {
          arr.splice(i, 1);
          if (!arr.length) arr.push('');
          onChange(arr.slice());
          rebuild();
        } }, '✕'),
      ));
    });
    list.append(el('button', { class: 'lines-add', onclick: () => {
      arr.push('');
      onChange(arr.slice());
      rebuild();
      list.querySelector('.para-row:last-of-type textarea')?.focus();
    } }, '+ 문단 추가'));
  };
  rebuild();
  wrap.append(list);
  return wrap;
}

function autoGrow(ta) {
  ta.style.height = 'auto';
  ta.style.height = `${Math.min(ta.scrollHeight + 2, 400)}px`;
}

function linesField(labelText, items, onChange) {
  const wrap = el('div', { class: 'field' });
  wrap.append(el('label', {}, labelText));
  const arr = items.slice();
  const list = el('div', {});
  const rebuild = () => {
    list.innerHTML = '';
    arr.forEach((text, i) => {
      const input = el('input', { type: 'text', value: text, placeholder: `항목 ${i + 1}` });
      input.addEventListener('input', () => { arr[i] = input.value; onChange(arr.slice()); });
      list.append(el('div', { class: 'line-row' }, input,
        el('button', { class: 'row-x', title: '항목 삭제', onclick: () => {
          arr.splice(i, 1);
          onChange(arr.slice());
          rebuild();
        } }, '✕'),
      ));
    });
    list.append(el('button', { class: 'lines-add', onclick: () => {
      arr.push('');
      onChange(arr.slice());
      rebuild();
    } }, '+ 항목 추가'));
  };
  rebuild();
  wrap.append(list);
  return wrap;
}

function mediaField(section, idx) {
  const box = el('div', { class: `media-box ${section.image ? 'has-image' : ''}` });
  const fileInput = el('input', { type: 'file', accept: 'image/*', hidden: '' });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    try {
      const norm = await normalizeImage(file);
      store.update((p) => {
        p.sections[idx].image = { ...norm, alt: p.sections[idx].image?.alt || '' };
      });
      renderEditor();
      toast('이미지를 추가했습니다. alt 텍스트를 입력해 주세요.');
    } catch (e) {
      toast('이미지를 불러오지 못했습니다: ' + e.message, { type: 'warn' });
    }
  });

  if (section.image) {
    box.append(el('img', { src: section.image.src, alt: section.image.alt || '' }));
    const altInput = el('input', { type: 'text', value: section.image.alt || '', placeholder: 'alt 텍스트 (접근성 + SEO)' });
    altInput.addEventListener('input', () => {
      store.update((p) => { p.sections[idx].image.alt = altInput.value; });
    });
    box.append(el('div', { class: 'field', style: 'width:100%;margin:0' }, el('label', {}, 'alt 텍스트'), altInput));
  } else {
    box.append(el('div', { class: 'media-empty' }, '섹션 이미지가 없습니다.\n본문에 이미지가 1장 이상이면 경쟁력 체크를 통과합니다.'));
  }
  box.append(el('div', { class: 'media-actions' },
    el('button', { class: 'btn btn-small', onclick: () => fileInput.click() }, section.image ? '이미지 교체' : '이미지 추가'),
    section.image ? el('button', { class: 'btn btn-small', style: 'color:var(--ui-danger)', onclick: () => {
      store.update((p) => { p.sections[idx].image = null; });
      renderEditor();
    } }, '제거') : null,
  ), fileInput);
  return box;
}

function deleteSection(i) {
  if (store.post.sections.length <= 1) {
    toast('마지막 섹션은 삭제할 수 없습니다.', { type: 'warn' });
    return;
  }
  store.deleteSection(i);
  toast('섹션을 삭제했습니다.', {
    actionLabel: '실행 취소',
    onAction: () => store.restoreDeleted(),
    timeout: 6000,
  });
}

// ---------- 글 설정 모달 ----------
function openSettings() {
  const P = store.post;
  openModal('글 설정', '키워드·톤·목표 길이·링크·SEO 메타를 지정합니다. 분석과 AI 프롬프트에 그대로 반영됩니다.', (box) => {
    const mainKw = textField('포커스 키워드', P.mainKeyword, '예: 재택근무 책상 세팅', (v) => upd((p) => { p.mainKeyword = v; }));
    const title = textField('글 제목', P.title, '15~40자 권장', (v) => upd((p) => { p.title = v; }));
    const metaDesc = el('textarea', { placeholder: '검색결과에 표시될 설명 80~160자' });
    metaDesc.value = P.metaDesc;
    metaDesc.addEventListener('input', () => upd((p) => { p.metaDesc = metaDesc.value; }));
    const slug = textField('슬러그 (URL)', P.slug, '영문-소문자 권장', (v) => upd((p) => { p.slug = v; }));

    // 서브 키워드 칩
    const chips = el('div', { class: 'chips' });
    const subInput = el('input', { type: 'text', placeholder: '서브 키워드 입력 후 Enter' });
    const rebuildChips = () => {
      chips.innerHTML = '';
      P.subKeywords.forEach((kw, i) => {
        chips.append(el('span', { class: 'chip' }, kw,
          el('button', { class: 'chip-x', title: '삭제', onclick: () => {
            upd((p) => { p.subKeywords.splice(i, 1); });
            rebuildChips();
          } }, '✕'),
        ));
      });
    };
    subInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && subInput.value.trim()) {
        e.preventDefault();
        upd((p) => { p.subKeywords.push(subInput.value.trim()); });
        subInput.value = '';
        rebuildChips();
      }
    });
    rebuildChips();

    const toneSel = el('select', {}, Object.entries(TONES).map(([k, label]) => el('option', { value: k }, label)));
    toneSel.value = P.tone;
    toneSel.addEventListener('change', () => upd((p) => { p.tone = toneSel.value; }));

    const lenSel = el('select', {}, LENGTHS.map((l) => el('option', { value: l.value }, l.label)));
    if (!LENGTHS.some((l) => l.value === P.targetChars)) {
      lenSel.append(el('option', { value: P.targetChars }, `직접 지정 · 약 ${P.targetChars.toLocaleString()}자`));
    }
    lenSel.value = String(P.targetChars);
    lenSel.addEventListener('change', () => upd((p) => { p.targetChars = Number(lenSel.value); }));

    const tags = textField('태그 (쉼표 구분)', P.tags.join(', '), '', (v) => upd((p) => {
      p.tags = v.split(',').map((s) => s.trim()).filter(Boolean);
    }));

    const intWrap = linkField('내부 링크 (내 블로그 글)', P.internalLinks, (arr) => upd((p) => { p.internalLinks = arr; }));
    const extWrap = linkField('외부 링크 (신뢰 출처)', P.externalLinks, (arr) => upd((p) => { p.externalLinks = arr; }));

    function upd(fn) { store.update(fn); }

    box.append(el('div', { class: 'form-grid' },
      el('div', {}, el('div', { class: 'field' }, el('label', {}, '글 제목'), title.querySelector('input'))),
      el('div', {}, el('div', { class: 'field' }, el('label', {}, '포커스 키워드'), mainKw.querySelector('input'))),
    ));
    box.append(el('div', { class: 'field' }, el('label', {}, '메타 설명 (80~160자)'), metaDesc));
    box.append(el('div', { class: 'form-grid' },
      el('div', {}, el('div', { class: 'field' }, el('label', {}, '슬러그'), slug.querySelector('input'))),
      el('div', {}, el('div', { class: 'field' }, el('label', {}, '태그'), tags.querySelector('input'))),
    ));
    box.append(el('div', { class: 'field' }, el('label', {}, '서브 키워드'), chips, subInput,
      el('div', { class: 'hint' }, '절반 이상이 본문·소제목에서 다뤄지면 체크를 통과합니다.')));
    box.append(el('div', { class: 'form-grid' },
      el('div', {}, el('div', { class: 'field' }, el('label', {}, '톤'), toneSel)),
      el('div', {}, el('div', { class: 'field' }, el('label', {}, '목표 길이'), lenSel)),
    ));
    box.append(intWrap, extWrap);
    box.append(el('div', { class: 'modal-actions' },
      el('button', { class: 'btn btn-primary', onclick: () => { $('#modal-root').innerHTML = ''; } }, '완료'),
    ));
  });
}

function linkField(labelText, links, onChange) {
  const wrap = el('div', { class: 'field' });
  wrap.append(el('label', {}, labelText));
  const arr = links.map((l) => ({ ...l }));
  const list = el('div', {});
  const rebuild = () => {
    list.innerHTML = '';
    arr.forEach((l, i) => {
      const t = el('input', { class: 'lk-text', type: 'text', value: l.text, placeholder: '앵커 텍스트' });
      const u = el('input', { class: 'lk-url', type: 'text', value: l.url, placeholder: 'https://...' });
      t.addEventListener('input', () => { arr[i].text = t.value; onChange(arr.filter((x) => x.text && x.url)); });
      u.addEventListener('input', () => { arr[i].url = u.value; onChange(arr.filter((x) => x.text && x.url)); });
      list.append(el('div', { class: 'link-row' }, t, u,
        el('button', { class: 'row-x', title: '삭제', onclick: () => {
          arr.splice(i, 1);
          onChange(arr.filter((x) => x.text && x.url));
          rebuild();
        } }, '✕'),
      ));
    });
    list.append(el('button', { class: 'lines-add', onclick: () => {
      arr.push({ text: '', url: '' });
      rebuild();
    } }, '+ 링크 추가'));
  };
  rebuild();
  wrap.append(list);
  return wrap;
}

// ---------- AI 초안 ----------
const AI_PROMPT = `한국어 블로그 포스트 초안을 JSON으로만 출력해줘. 설명·코드블록 없이 JSON 객체 하나만.

입력 정보:
- 주제: 【주제 입력】
- 포커스 키워드: 【메인 키워드】
- 서브 키워드: 【서브 키워드 쉼표 나열】
- 톤: 【expert(전문정보형)/friendly(친근 블로그)/review(후기)/news(뉴스) 중 하나】
- 목표 글자 수: 【예: 1500】자 (공백 포함, ±10%)

규칙:
- title: 15~40자, 포커스 키워드를 앞쪽에 자연스럽게 포함
- metaDesc: 80~140자, 포커스 키워드 1회 포함
- intro: 2~3문단 배열. 첫 문단 첫머리에 포커스 키워드 자연 포함
- sections: 3~6개. 각 섹션 { h2, paragraphs(2~3문단 배열), list(핵심 항목 배열 또는 []), imageAlt(섹션 대표 이미지 alt, 40자 내외) }
  - h2 중 하나 이상에 포커스 키워드 포함, 서브 키워드는 절반 이상이 h2나 문단에서 다뤄지게
  - list는 스니펫용 핵심 나열 — 최소 1개 섹션에 넣기
- conclusion: 1~2문단
- 키워드 밀도는 전체의 0.5~1.5% 수준으로 억지 반복 금지
- 마크다운·HTML 태그·이모지 금지, 완성된 한국어 문장으로

JSON 형식:
{"title":"...","metaDesc":"...","slug":"영문-슬러그","tags":["태그1","태그2"],
 "intro":["문단1","문단2"],
 "sections":[{"h2":"...","paragraphs":["...","..."],"list":["..."],"imageAlt":"..."}],
 "conclusion":["..."]}`;

function openAI() {
  openModal('AI 초안 만들기', '이 도구는 "AI는 내용만, 구조·분석은 코드가" 담당합니다. 프롬프트를 ChatGPT/Claude에 붙여넣고, 나온 JSON을 가져오세요.', (box) => {
    const pre = el('pre', {}, AI_PROMPT);
    const ta = el('textarea', { class: 'big', placeholder: 'AI가 만든 JSON을 붙여넣고 [가져오기]를 누르세요.' });
    box.append(
      el('div', { class: 'field' }, el('label', {}, '1. 프롬프트 복사 (【】칸을 채워 넣으세요)'), pre,
        el('button', { class: 'btn', onclick: async () => {
          try { await navigator.clipboard.writeText(AI_PROMPT); toast('프롬프트를 복사했습니다.'); }
          catch { toast('복사 실패 — 직접 선택해 복사해 주세요.', { type: 'warn' }); }
        } }, '프롬프트 복사')),
      el('div', { class: 'field' }, el('label', {}, '2. 결과 JSON 붙여넣기'), ta),
      el('div', { class: 'modal-actions' },
        el('button', { class: 'btn btn-primary', onclick: () => {
          let raw = ta.value.trim();
          if (!raw) { toast('JSON을 붙여넣어 주세요.', { type: 'warn' }); return; }
          const m = raw.match(/\{[\s\S]*\}/);
          if (m) raw = m[0];
          try {
            const parsed = JSON.parse(raw);
            if (!parsed || !Array.isArray(parsed.sections) || !parsed.sections.length) throw new Error('sections 배열이 없습니다.');
            if (!confirm('현재 포스트를 AI 초안으로 교체할까요?')) return;
            store.setPost(parsed);
            repaint();
            $('#modal-root').innerHTML = '';
            toast('AI 초안을 가져왔습니다. 체크리스트를 확인하고 보완하세요.');
          } catch (e) {
            toast('JSON 해석 실패: ' + e.message, { type: 'warn', timeout: 5000 });
          }
        } }, '가져오기'),
      ),
    );
  });
}

// ---------- 헤더 / 이벤트 ----------
function wireHeader() {
  const titleInput = $('#post-title');
  titleInput.value = store.post.title;
  titleInput.addEventListener('input', () => {
    store.update((p) => { p.title = titleInput.value; });
  });

  $('#btn-settings').addEventListener('click', openSettings);
  $('#btn-ai').addEventListener('click', openAI);

  $('#btn-cardnews').addEventListener('click', () => {
    downloadCardnewsProject(store.post);
    toast('카드뉴스 프로젝트 JSON을 저장했습니다. 카드뉴스 스튜디오에서 "불러오기"로 여세요.', { timeout: 5200 });
  });

  $('#btn-copy-html').addEventListener('click', async () => {
    const ok = await copyHTML(store.post);
    toast(ok ? '본문 HTML을 복사했습니다. WordPress "코드 에디터"에 붙여넣으세요.' : '복사 실패 — ZIP으로 내려받아 post.html을 사용하세요.', { type: ok ? '' : 'warn', timeout: 5000 });
  });

  $('#btn-md').addEventListener('click', () => {
    const md = buildMarkdown(store.post);
    const blob = new Blob([md], { type: 'text/markdown' });
    download(blob, `${slugify(store.post.title || 'post')}.md`);
    toast('Markdown 파일을 저장했습니다.');
  });

  const zipBtn = $('#btn-zip');
  zipBtn.addEventListener('click', async () => {
    const original = zipBtn.textContent;
    try {
      zipBtn.disabled = true;
      zipBtn.textContent = '패키지 만드는 중…';
      await exportZip(store.post);
      toast('ZIP 다운로드를 시작했습니다. post.html + post.md + meta.json + images가 들어 있습니다.', { timeout: 5000 });
    } catch (e) {
      log.error(e);
      toast('ZIP 생성 실패: ' + e.message, { type: 'warn', timeout: 5000 });
    } finally {
      zipBtn.disabled = false;
      zipBtn.textContent = original;
    }
  });
}

function wireStore() {
  store.on('post', () => {
    repaint();
    const t = $('#post-title');
    if (t.value !== store.post.title) t.value = store.post.title;
  });
  store.on('selection', () => {
    renderRail();
    renderEditor();
    // 해당 섹션으로 프리뷰 스크롤
    if (store.selected.kind === 'section') {
      const h2 = document.querySelector(`#article-preview h2[data-section="${store.selected.index}"]`);
      if (h2) {
        h2.scrollIntoView({ behavior: 'smooth', block: 'start' });
        h2.classList.add('editing-flash');
        setTimeout(() => h2.classList.remove('editing-flash'), 900);
      }
    }
  });
  store.on('quota-exceeded', () => {
    toast('브라우저 저장 공간이 부족해 자동저장에 실패했습니다. 이미지를 줄이거나 ZIP으로 백업해 주세요.', { type: 'warn', timeout: 6000 });
  });
}

function wireKeyboard() {
  document.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) || '';
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      $('#btn-zip').click();
    }
  });
}

// ---------- 부트 ----------
(async function boot() {
  const restored = store.load();
  if (!restored) {
    store.setPost(samplePost(), { silent: true });
    store.save();
  }
  wireHeader();
  wireStore();
  wireKeyboard();
  repaint();
  if (restored) toast('마지막 작업을 복원했습니다.', { timeout: 2200 });
  log.info('블로그 포스트 스튜디오 시작');
})();
