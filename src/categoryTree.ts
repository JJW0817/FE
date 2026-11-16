/**
 * 판매 상품 카테고리 단계 선택(대분류 → 중분류 → 세부).
 * 서버 registration-metadata는 중분류를 따로 주지 않는다. 대신 세부 카테고리 code가 `CLOTHING_TSHIRT_01`처럼 `대분류_중분류토큰_번호`라서
 * 토큰(TSHIRT)으로 묶고, 화면에 보일 이름만 아래 표로 붙인다. 표에 없는 토큰(서버가 새로 추가한 것)은 '기타'로 모인다.
 * 저장하는 값은 늘 세부 카테고리 이름(서버 원문)이다.
 */
import type { RegistrationMetadataDto } from './api';

export const MAJORS = ['CLOTHING', 'FASHION_ACCESSORIES', 'STATIONERY', 'HOUSEHOLD'] as const;
export const MAJOR_NAMES: Record<string, string> = { CLOTHING: '의류', FASHION_ACCESSORIES: '패션잡화', STATIONERY: '문구', HOUSEHOLD: '일반 생활잡화' };
export const OTHER_GROUP = '기타';

/** `대분류:토큰` → 중분류 이름 (docs/ga·보고서의 매핑 표와 같다) */
export const GROUP_LABELS: Record<string, string> = {
  'CLOTHING:TSHIRT': '티셔츠', 'CLOTHING:SWEATSHIRT': '맨투맨·후드', 'CLOTHING:SHIRT': '셔츠·블라우스', 'CLOTHING:KNIT': '니트·카디건', 'CLOTHING:JACKET': '재킷', 'CLOTHING:JUMPER': '점퍼', 'CLOTHING:COAT': '코트', 'CLOTHING:PADDED': '패딩',
  'CLOTHING:PANTS': '팬츠', 'CLOTHING:JEANS': '청바지', 'CLOTHING:SHORTS': '반바지', 'CLOTHING:SKIRT': '스커트', 'CLOTHING:DRESS': '원피스', 'CLOTHING:SET': '세트·점프슈트', 'CLOTHING:HOMEWEAR': '홈웨어',
  'FASHION_ACCESSORIES:BAG': '가방', 'FASHION_ACCESSORIES:POUCH': '파우치', 'FASHION_ACCESSORIES:WALLET': '지갑', 'FASHION_ACCESSORIES:HAT': '모자', 'FASHION_ACCESSORIES:SOCKS': '양말', 'FASHION_ACCESSORIES:SCARF': '목도리·스카프', 'FASHION_ACCESSORIES:GLOVES': '장갑',
  'FASHION_ACCESSORIES:BELT': '벨트', 'FASHION_ACCESSORIES:HAIR': '헤어 액세서리', 'FASHION_ACCESSORIES:KEY': '키링·키홀더', 'FASHION_ACCESSORIES:UMBRELLA': '우산', 'FASHION_ACCESSORIES:SHOES': '신발',
  'STATIONERY:WRITING': '필기구', 'STATIONERY:REFILL': '리필·지우개', 'STATIONERY:NOTEBOOK': '노트', 'STATIONERY:PLANNER': '다이어리·달력', 'STATIONERY:MEMO': '메모지', 'STATIONERY:PAPER': '편지·카드·종이', 'STATIONERY:FILE': '파일·바인더',
  'STATIONERY:DESK': '데스크 정리', 'STATIONERY:PEN_STORAGE': '필통·펜 케이스', 'STATIONERY:OFFICE': '사무용품', 'STATIONERY:READING': '독서 용품', 'STATIONERY:DECORATION': '스티커·데코', 'STATIONERY:WRAPPING': '포장',
  'HOUSEHOLD:BOX': '수납함', 'HOUSEHOLD:BASKET': '바구니', 'HOUSEHOLD:HANGER': '옷걸이', 'HOUSEHOLD:CLOTHING_STORAGE': '의류 수납', 'HOUSEHOLD:SHOE_STORAGE': '신발 수납', 'HOUSEHOLD:SMALL_STORAGE': '소품 수납', 'HOUSEHOLD:CLEANING': '청소 도구',
  'HOUSEHOLD:FLOOR_CLEANING': '바닥 청소', 'HOUSEHOLD:GARMENT_CARE': '의류 관리', 'HOUSEHOLD:LAUNDRY': '세탁·건조', 'HOUSEHOLD:TRASH': '휴지통', 'HOUSEHOLD:BATHROOM': '욕실 용품', 'HOUSEHOLD:WALL_STORAGE': '벽 수납·후크',
  'HOUSEHOLD:INTERIOR': '인테리어 소품', 'HOUSEHOLD:FABRIC': '패브릭', 'HOUSEHOLD:ENTRANCE': '현관 용품', 'HOUSEHOLD:TRAVEL': '여행 정리',
};

export interface CategoryGroup { label: string; items: string[] }
export interface CategoryMajor { code: string; name: string; groups: CategoryGroup[] }

const majorOf = (code: string) => MAJORS.find(m => code === m || code.startsWith(`${m}_`));
/** 세부 카테고리 code → 중분류 이름 (대분류 자체이거나 표에 없으면 '기타') */
export function groupOf(code: string): string {
  const major = majorOf(code); if (!major || code === major) return OTHER_GROUP;
  return GROUP_LABELS[`${major}:${code.slice(major.length + 1).replace(/_\d+$/, '')}`] ?? OTHER_GROUP;
}

export function categoryTree(meta: Pick<RegistrationMetadataDto, 'categoryCriteria'>): CategoryMajor[] {
  return MAJORS.map(code => {
    const groups = new Map<string, string[]>(); let name = MAJOR_NAMES[code];
    for (const c of meta.categoryCriteria) {
      if (majorOf(c.code) !== code) continue;
      if (c.code === code) name = c.name || name; // 대분류 항목은 이름만 가져오고 기타에도 선택지로 둔다
      const g = groupOf(c.code), list = groups.get(g) ?? []; list.push(c.name); groups.set(g, list);
    }
    const ordered = [...groups.entries()].sort(([a], [b]) => (a === OTHER_GROUP ? 1 : 0) - (b === OTHER_GROUP ? 1 : 0)).map(([label, items]) => ({ label, items }));
    return { code, name, groups: ordered };
  }).filter(m => m.groups.length);
}
