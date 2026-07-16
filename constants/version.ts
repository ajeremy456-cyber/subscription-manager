// VIP 版本控制設定
export const VIP_CONFIG = {
  // 免費版限制
  FREE_LIMIT: 3, // 最多 3 筆訂閱
  
  // VIP 價格（NT$）
  VIP_PRICE: 100,
  
  // IAP 商品 ID（需在 Google Play / App Store 設定）
  IAP_PRODUCT_ID: 'vip_unlock',
  
  // Storage Keys
  VIP_STORAGE_KEY: '@subscription_manager/is_vip',
};

// 檢查是否為 VIP
export function isFreeUser(subscriptionCount: number, isVIP: boolean): boolean {
  return !isVIP && subscriptionCount >= VIP_CONFIG.FREE_LIMIT;
}