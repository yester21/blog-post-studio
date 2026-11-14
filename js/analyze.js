// analyze.js — 온페이지 준비도 분석 (워드프레스 플러그인 ai-auto-poster의 공개 체크리스트 이식)
// 가중치·임계값·조언 문구는 플러그인 includes/class-aiap-analysis.php와 동일하게 맞췄다.
// KD(검색 경쟁 강도)는 SERP API가 필요해 웹버전에서 제외 — 준비도만 산출하고, 그 사실을 화면에 고지한다.
import { charCount, keywordIn, occurrences } from './util.js';

// 본문 전체를 하나의 텍스트로 합친다 (제목·메타 제외 — 플러그인과 동일 기준)
export function bodyText(post) {
  const parts = [...post.intro];
  for (const s of post.sections) {
    parts.push(s.h2);
    parts.push(...s.paragraphs);
    parts.push(...s.list);
  }
  parts.push(...post.conclusion);
  return parts.filter(Boolean).join('\n');
}

export function bodyChars(post) {
  return charCount(bodyText(post));
}

export function analyze(post) {
  const kw = (post.mainKeyword || '').trim();
  const title = post.title || '';
  const meta = post.metaDesc || '';
  const body = bodyText(post);
  const chars = charCount(body);
  const target = post.targetChars || 1500;

  const h2s = post.sections.map((s) => s.h2 || '').filter(Boolean);
  const images = post.sections.filter((s) => s.image);
  const altsOk = images.filter((s) => (s.image.alt || '').trim()).length;
  const altKw = images.filter((s) => keywordIn(kw, s.image.alt || '')).length;

  // 키워드 밀도: 키워드 글자수(공백 제외) × 등장 횟수 / 본문 글자수 (0.4~2.5% 밴드)
  // 공백을 제외하는 이유: 띄어쓰기 포함 긴 키워드("재택근무 책상 세팅")의 밀도가 과대 계산되는 것을 막는다.
  const occurs = kw ? occurrences(kw, body) : 0;
  const kwChars = kw.replace(/\s+/g, '').length;
  const density = chars > 0 && kwChars > 0 ? (occurs * kwChars) / chars * 100 : 0;

  // 서브 키워드 커버: 소제목+본문에서 각 서브 키워드가 다뤄졌는지
  const covered = (post.subKeywords || []).filter((sk) => sk.trim() && keywordIn(sk, body)).length;
  const subTotal = post.subKeywords.filter((k) => k.trim()).length;

  const hasStructure = post.sections.some((s) => s.list.length > 0);

  const m = {
    title_len: title.length,
    desc_len: meta.length,
    kw_in_title: kw ? keywordIn(kw, title) : false,
    kw_in_intro: kw ? keywordIn(kw, [...post.intro].join(' ').slice(0, 400)) : false, // 첫 문단 앞쪽 여유 포함 판정
    density,
    occurs,
    char_count: chars,
    target_chars: target,
    h2_count: h2s.length,
    h2_with_kw: kw ? h2s.filter((h) => keywordIn(kw, h)).length : 0,
    img_count: images.length,
    img_alt: altsOk,
    img_alt_kw: altKw,
    internal_links: post.internalLinks.length,
    external_links: post.externalLinks.length,
    has_structure: hasStructure,
    sub_total: subTotal,
    sub_cover: covered,
  };

  const checks = buildChecks(m, kw);

  // 플러그인과 동일: 통과=전체 가중치, 경고=절반 → 0~100 정규화
  let got = 0;
  let total = 0;
  for (const c of checks) {
    total += c.weight;
    if (c.result === 'pass') got += c.weight;
    else if (c.result === 'warn') got += c.weight * 0.5;
  }
  const score = Math.round(100 * (got / Math.max(1, total)));

  return { metrics: m, checks, score };
}

function check(id, label, weight, pass, warn, advice) {
  return { id, label, weight, result: pass ? 'pass' : warn ? 'warn' : 'fail', advice };
}

function buildChecks(m, kw) {
  const kwName = kw || '포커스 키워드';
  const c = [];

  c.push(check('title_kw', '제목에 포커스 키워드 포함', 12, m.kw_in_title, false,
    `제목 앞쪽에 "${kwName}"를 넣어 주세요.`));

  c.push(check('title_len', '제목 길이 15~40자', 6,
    m.title_len >= 15 && m.title_len <= 40,
    m.title_len > 0 && m.title_len <= 45,
    `현재 제목 ${m.title_len}자. 15~40자면 검색결과에서 잘리지 않습니다.`));

  c.push(check('meta_desc', '메타 설명 80~160자', 8,
    m.desc_len >= 80 && m.desc_len <= 160,
    m.desc_len >= 40,
    m.desc_len > 0
      ? `현재 메타 설명 ${m.desc_len}자. 80~160자로 늘려주세요.`
      : '메타 설명이 없습니다. 글 설정에서 채워주세요.'));

  c.push(check('intro_kw', '도입부(첫 200자)에 키워드', 10, m.kw_in_intro, false,
    '첫 문단 앞쪽에 포커스 키워드를 자연스럽게 배치하세요.'));

  const okDensity = m.density >= 0.4 && m.density <= 2.5;
  c.push(check('density', '키워드 밀도 0.4~2.5%', 8, okDensity, m.density > 0,
    `현재 밀도 약 ${m.density.toFixed(2)}% (본문 ${m.occurs}회, 공백 제외 글자 수 기준). 0.4~2.5%가 적정이며 억지 반복은 역효과입니다.`));

  c.push(check('length', `본문 길이 (권장 ${m.target_chars.toLocaleString()}자 이상)`, 14,
    m.char_count >= m.target_chars,
    m.char_count >= Math.floor(m.target_chars * 0.7),
    `현재 본문 약 ${m.char_count.toLocaleString()}자. ${m.target_chars.toLocaleString()}자 이상이 안전합니다.`));

  c.push(check('h2_kw', 'H2 소제목 중 키워드 포함 1개 이상', 8, m.h2_with_kw >= 1, false,
    'H2 소제목 하나 이상에 키워드(또는 자연스러운 변형)를 포함하세요.'));

  c.push(check('h2_count', 'H2 소제목 3개 이상', 5, m.h2_count >= 3, m.h2_count >= 2,
    `현재 H2 ${m.h2_count}개. 구조화를 위해 3개 이상으로 나누세요.`));

  c.push(check('img', '이미지 1장 이상 + 전체 alt 입력', 8,
    m.img_count >= 1 && m.img_alt === m.img_count,
    m.img_count >= 1,
    m.img_count > 0
      ? `이미지 ${m.img_count}장 중 alt 누락 ${m.img_count - m.img_alt}장. 모든 이미지에 대체 텍스트를 넣으세요.`
      : '본문에 이미지가 없습니다. 섹션에 1장 이상 추가하세요 (경쟁력에 직접 영향).'));

  c.push(check('img_alt_kw', '이미지 alt에 키워드', 4, m.img_alt_kw >= 1, false,
    '대표 이미지 alt 텍스트에 포커스 키워드를 포함하세요.'));

  c.push(check('internal', '내부 링크 1개 이상', 6, m.internal_links >= 1, false,
    '관련 글로 이어지는 내부 링크를 글 설정에 1개 이상 넣으세요.'));

  c.push(check('external', '외부 링크(신뢰 출처) 1개 이상', 4, m.external_links >= 1, false,
    '공식 자료 등 신뢰 출처로의 외부 링크를 글 설정에 1개 이상 넣으세요.'));

  c.push(check('structure', '리스트 등 시각 구조 사용', 5, m.has_structure, false,
    '리스트를 활용하면 가독성·스니펫 획득에 유리합니다.'));

  if (m.sub_total > 0) {
    const half = Math.ceil(m.sub_total / 2);
    c.push(check('sub_cover', `서브 키워드 목차 커버 (${m.sub_cover}/${m.sub_total})`, 6,
      m.sub_cover >= half, m.sub_cover >= 1,
      '서브 키워드 중 절반 이상이 소제목·문단에 다루어지도록 보완하세요.'));
  }

  return c;
}

export function readinessLabel(score) {
  if (score >= 85) return { label: '발행 준비 완료', tone: 'ok' };
  if (score >= 65) return { label: '보완하면 좋음', tone: 'warn' };
  return { label: '보완 필요', tone: 'fail' };
}
