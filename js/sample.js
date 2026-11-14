// sample.js — 기본 로드되는 샘플 블로그 포스트 (세트 주제: 견적서·인보이스 가이드)
// 모든 요소 유형(리스트·이미지·링크)을 한 번에 보여주고, 준비도 체크를 대부분 통과하는 구성.
function gradientDataUrl(w, h, stops, seed = 1) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');
  let g = ctx.createLinearGradient(0, 0, w, h);
  stops.forEach(([pos, color]) => g.addColorStop(pos, color));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  let s = seed * 9301;
  const rand = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  for (let i = 0; i < 90; i++) {
    ctx.beginPath();
    ctx.arc(rand() * w, rand() * h, 2 + rand() * 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // 문서 비교 목업 (두 카드 나란히)
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 4;
  ctx.strokeRect(w * 0.14, h * 0.2, w * 0.32, h * 0.6);
  ctx.strokeRect(w * 0.54, h * 0.2, w * 0.32, h * 0.6);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = `${Math.round(h * 0.055)}px sans-serif`;
  ctx.fillText('견적서', w * 0.24, h * 0.3);
  ctx.fillText('인보이스', w * 0.6, h * 0.3);
  return { src: cv.toDataURL('image/jpeg', 0.85), w, h };
}

export function samplePost() {
  return {
    version: 1,
    title: '[샘플] 견적서와 인보이스 차이, 작성 순서까지 한 번에 정리',
    metaDesc: '견적서와 인보이스의 차이와 작성 순서를 한 번에 정리했습니다. 프리랜서·소규모 사업자가 꼭 넣어야 할 항목과 자주 하는 실수까지 예시와 함께 확인하세요.',
    slug: 'quote-vs-invoice-guide',
    mainKeyword: '견적서와 인보이스',
    subKeywords: ['견적서 항목', '인보이스 발행', '작성 순서'],
    targetChars: 1500,
    tone: 'expert',
    tags: ['견적서', '인보이스', '프리랜서'],
    topic: '견적서와 인보이스의 차이와 작성 순서 가이드',
    internalLinks: [{ text: '[샘플] 인보이스 스튜디오 사용 가이드', url: 'https://example.com/invoice-studio' }],
    externalLinks: [{ text: '[샘플] 국세청 전자세금계산서 안내', url: 'https://example.com/nts-guide' }],
    intro: [
      '견적서와 인보이스는 많은 분들이 같은 문서로 생각하지만, 역할과 시점이 다릅니다. 견적서는 일 시작 전에 범위·기간·가격 조건을 확정하는 문서이고, 인보이스는 일을 마친 뒤 대금을 청구하는 문서입니다.',
      '이 글에서는 두 문서의 차이, 꼭 들어가야 할 항목, 실무에서 바로 쓰는 작성 순서를 예시와 함께 정리했습니다.',
    ],
    sections: [
      {
        id: 'bs-1',
        h2: '견적서와 인보이스, 뭐가 다를까',
        paragraphs: [
          '견적서는 작업 착수 전에 조건을 확정하는 문서입니다. 클라이언트가 승인해야 작업을 시작할 수 있고, 이후 범위 변경은 새 견적으로 처리하는 것이 원칙입니다.',
          '인보이스는 납품 이후 대금을 청구하는 문서입니다. 견적 승인 → 작업 → 납품 → 인보이스 발행 → 입금 확인 순서로 이어지며, 세금계산서 발급 근거가 됩니다.',
        ],
        list: [],
        image: null,
      },
      {
        id: 'bs-2',
        h2: '견적서에 꼭 들어가야 할 항목',
        paragraphs: [
          '견적서 항목은 단가·수량·세액을 나눠 적는 것이 핵심입니다. 항목별로 나눠두면 나중에 범위를 조정할 때 해당 항목만 다시 견적하면 됩니다. 예를 들어 메인 페이지와 서브 페이지를 항목으로 분리해두면 클라이언트가 요청을 줄여도 조정이 쉽습니다.',
          '유효기간을 반드시 남겨야 시장 상황이 바뀌어도 조건 변동에 깔끔하게 대응할 수 있습니다. 실무에서는 발행일로부터 14일로 두는 경우가 많습니다.',
        ],
        list: ['품명과 상세 산출물', '공급가액·세액·수량', '견적 유효기간', '수정 요청 범위와 횟수'],
        image: null,
      },
      {
        id: 'bs-3',
        h2: '인보이스에 꼭 들어가야 할 항목',
        paragraphs: [
          '인보이스 발행 시 청구 금액과 입금 계좌, 세금계산서 발급 안내가 핵심입니다. 문서 번호를 견적서와 맞춰두면 프로젝트별 정산 관리가 쉬워집니다.',
        ],
        list: [],
        image: { ...gradientDataUrl(1080, 720, [[0, '#0F3B57'], [1, '#2E9CA6']], 31), alt: '견적서와 인보이스 차이 정리' },
      },
      {
        id: 'bs-4',
        h2: '작성 순서, 이렇게 연결하세요',
        paragraphs: [
          '두 문서는 한 번에 만들지 않고 착수 전과 납품 후로 나눠 발행합니다. 번호 체계를 유지하면 여러 프로젝트를 동시에 진행해도 정산이 깔끔해집니다.',
        ],
        list: ['착수 전: 견적서 발행 → 클라이언트 승인', '작업 중: 범위 변경은 별도 견적으로', '납품 후: 인보이스 발행 → 입금 확인 → 세금계산서'],
        image: null,
      },
      {
        id: 'bs-5',
        h2: '자주 하는 실수 3가지',
        paragraphs: [
          '첫째, 구두 합의만 남기는 경우입니다. 둘째, 수정 횟수를 문서에 남기지 않는 경우. 셋째, 세금계산서 발급 시점을 정하지 않는 경우입니다.',
          '세 가지 모두 문서 한 장에 조건을 명시하는 것만으로 예방할 수 있습니다. 처음 30분의 문서화가 나중의 몇 주 분쟁을 막습니다. 견적 유효기간·수정 횟수·계좌 안내를 문서에 남겨두면 다음 프로젝트부터는 틀만 복사하면 됩니다.',
        ],
        list: [],
        image: null,
      },
    ],
    conclusion: [
      '두 문서는 형식이 비슷해도 시점과 목적이 다릅니다. 착수 전 견적, 납품 후 청구 — 오늘부터 문서 번호를 맞춰 관리해 보세요.',
    ],
  };
}
