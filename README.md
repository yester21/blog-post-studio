# 블로그 포스트 스튜디오 · Blog Post Studio

키워드·아웃라인·본문·SEO를 정리해 **WordPress 발행 패키지(HTML/MD/ZIP)**로 내보내는
정적 웹 도구. cardnews-studio와 한 세트다.

워드프레스 플러그인 [ai-auto-poster](D:\z-code\blog auto posting\ai-auto-poster)를 웹버전으로 옮긴 것으로,
같은 설계 철학을 따른다:

> **AI(또는 사람)는 내용만 쓰고, 구조·분석·내보내기는 코드가 담당한다.**
> AI 초안은 JSON 계약으로만 받고, HTML/Markdown 조립과 SEO 검사는 결정적으로 돌린다.

- 플러그인의 **온페이지 준비도 체크리스트(가중치 합산 0~100)**를 그대로 이식 — 가중치·임계값·조언 문구가 `class-aiap-analysis.php`와 동일하다
- KD(검색 경쟁 강도)는 SERP API가 필요해 웹버전에서 제외했으며, 화면에 그 사실을 고지한다 (도메인 권위·백링크 같은 사이트 외적 요인 미반영도 동일하게 고지)

## 실행

정적 사이트다. 아무 정적 서버로 서빙한다:

```bash
python -m http.server 8010 --directory blog-post-studio
```

GitHub Pages / Netlify / Vercel / CloudBase 정적 호스팅에 폴더째 올려도 동작한다.

## 세트 구성 (카드뉴스 스튜디오와의 연결)

| 앱 | 역할 |
|---|---|
| **cardnews-studio** (`../cardnews-studio`) | 인스타그램·스레드용 4:5 카드뉴스 7장 제작 |
| **blog-post-studio** (이 앱) | 블로그 포스트 작성 + WordPress 발행 패키지 |

**블로그 → 카드뉴스**: 헤더의 "카드뉴스로 →" 버튼이 현재 포스트를 cardnews-studio 프로젝트 JSON(7장: 표지 → 체크리스트 → 섹션 요약 → CTA)으로 변환해 내려보낸다. 카드뉴스 스튜디오에서 "불러오기"로 열면 끝.

**카드뉴스 → 블로그**: cardnews-studio의 "AI 초안" 프롬프트와 같은 방식으로, 이 앱의 "AI 초안" 프롬프트로 글 초안을 만들어 가져온다.

## 기능

| 기능 | 설명 |
|---|---|
| 아웃라인 레일 | 서론 → H2 섹션들 → 결론. 섹션별 글자수·리스트·이미지 표시, 추가/복제/삭제/순서변경 |
| 섹션 편집기 | H2 소제목, 문단(1문단 = 1 `<p>`), 스니펫용 리스트, 섹션 이미지 + alt |
| 글 설정 | 제목·포커스 키워드·서브 키워드(칩)·메타 설명·슬러그·태그·톤 4종·목표 길이·내부/외부 링크 |
| 준비도 분석 | 플러그인과 동일한 14개 가중치 체크(제목 키워드 12, 길이 14, 밀도 8 …), 게이지 + 모달 체크리스트 + 하단 QA 스트립 |
| AI 초안 | 주제·키워드·톤·목표 길이가 채워진 프롬프트 복사 → JSON 붙여넣어 가져오기 |
| 내보내기 | `post.html`(WordPress 코드 에디터용 본문) · `post.md` · `meta.json`(포커스 키워드/메타/슬러그) · `images/` · 발행 가이드 를 묶은 ZIP. HTML 복사·MD 저장 단독 실행도 지원 |
| 자동저장 | localStorage(`blogpost-studio-v1`) 즉시 저장 |

## 준비도 체크리스트 (플러그인에서 이식)

| 체크 | 가중치 |
|---|---:|
| 제목에 포커스 키워드 포함 | 12 |
| 본문 길이 (목표 길이 이상, 70%부터 경고) | 14 |
| 도입부(첫 200자)에 키워드 | 10 |
| 메타 설명 80~160자 | 8 |
| 키워드 밀도 0.4~2.5% | 8 |
| H2 소제목 중 키워드 포함 1개 이상 | 8 |
| 이미지 1장 이상 + 전체 alt 입력 | 8 |
| 제목 길이 15~40자 | 6 |
| 내부 링크 1개 이상 | 6 |
| 서브 키워드 목차 커버 (절반 이상) | 6 |
| H2 소제목 3개 이상 | 5 |
| 리스트 등 시각 구조 사용 | 5 |
| 외부 링크(신뢰 출처) 1개 이상 | 4 |
| 이미지 alt에 키워드 | 4 |

통과 = 전체 가중치, 경고 = 절반 → 0~100 정규화. 85점 이상 "발행 준비 완료", 65점 이상 "보완하면 좋음".

## 프로젝트 JSON 스키마

```jsonc
{
  "title": "글 제목",
  "metaDesc": "검색결과 설명 80~160자",
  "slug": "url-slug",
  "mainKeyword": "포커스 키워드",
  "subKeywords": ["서브 키워드"],
  "targetChars": 1500,
  "tone": "expert" | "friendly" | "review" | "news",
  "tags": ["태그"],
  "internalLinks": [{ "text": "앵커", "url": "https://..." }],
  "externalLinks": [{ "text": "출처", "url": "https://..." }],
  "topic": "주제 (AI 프롬프트용)",
  "intro": ["문단", "문단"],
  "sections": [
    { "h2": "소제목", "paragraphs": ["문단"], "list": ["항목"],
      "image": { "src": "dataURL", "alt": "대체 텍스트" } }
  ],
  "conclusion": ["문단"]
}
```

## 구조

```
blog-post-studio/
├── index.html
├── assets/app.css     # cardnews-studio와 동일 Apple 디자인 토큰 + 아티클 타이포그래피
└── js/
    ├── app.js         # UI (레일·프리뷰·에디터·모달·AI 프롬프트)
    ├── store.js       # 포스트 스키마·정규화·자동저장
    ├── analyze.js     # ★ 플러그인 체크리스트 이식 (가중치 0~100)
    ├── exporters.js   # HTML/MD/ZIP/카드뉴스 프로젝트 변환
    ├── zip.js         # 무의존 ZIP 라이터 (cardnews-studio와 동일)
    ├── sample.js      # 샘플 포스트
    └── util.js        # 공용 유틸
```

## 폰트

UI는 Pretendard(변수 폰트, 자체호스팅, SIL OFL 1.1)를 사용하며 자간 -0.02em 보정을 적용했다.

## 라이선스

MIT
