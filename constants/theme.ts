
export const CURRENCY = 'NT$';
export const CURRENCY_CODE = 'TWD';
export const CYCLES = ['monthly', 'quarterly', 'yearly'] as const;
export type Cycle = typeof CYCLES[number];

export const CATEGORIES = [
  '影音娛樂',
  '音樂串流',
  '線上學習',
  '新聞雜誌',
  '雲端服務',
  '運動健身',
  '數據備份',
  '其他'
] as const;

export type Category = typeof CATEGORIES[number];

