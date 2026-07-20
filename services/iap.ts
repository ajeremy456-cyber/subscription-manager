import AsyncStorage from '@react-native-async-storage/async-storage';
import { VIP_CONFIG } from '../constants/version';
import {
  initConnection,
  endConnection,
  getProducts,
  requestPurchase,
  getPurchaseHistory,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
  type ProductPurchase,
  type PurchaseError,
} from 'expo-iap';

// 測試模式開關（開發時設為 true，上架前設為 false）
const TEST_MODE = false;

// 購買結果類型
export interface PurchaseResult {
  success: boolean;
  error?: string;
}

// 初始化 IAP
export async function initIAP(): Promise<boolean> {
  // 測試模式：跳過 IAP 初始化
  if (TEST_MODE) {
    console.log('[IAP] 測試模式：跳過 IAP 初始化');
    return true;
  }

  try {
    // 建立連線（對應原本的 Billing.connectAsync()）
    const connected = await initConnection();

    if (!connected) {
      console.log('[IAP] 初始化失敗');
      return false;
    }

    // 設定購買成功監聽器（對應原本的 Billing.setPurchaseListener()）
    purchaseUpdatedListener(async (purchase: ProductPurchase) => {
      try {
        if (purchase.productId === VIP_CONFIG.IAP_PRODUCT_ID) {
          await handleVIPPurchase(purchase);
        }
        // 完成交易（對應原本的 Billing.finishTransactionAsync()）
        await finishTransaction({ purchase, isConsumable: false });
      } catch (error) {
        console.error('[IAP] 處理購買失敗:', error);
      }
    });

    // 設定購買失敗監聽器
    purchaseErrorListener((error: PurchaseError) => {
      console.error('[IAP] 購買錯誤:', error);
    });

    console.log('[IAP] 初始化成功');
    return true;
  } catch (error) {
    console.log('[IAP] 初始化錯誤（網頁版或無 IAP 支援）:', error);
    return false;
  }
}

// 處理 VIP 購買（內部使用）
async function handleVIPPurchase(purchase: ProductPurchase): Promise<void> {
  try {
    await AsyncStorage.setItem(VIP_CONFIG.VIP_STORAGE_KEY, 'true');
    console.log('[IAP] VIP 購買成功，已儲存狀態');
  } catch (error) {
    console.error('[IAP] 儲存 VIP 狀態失敗:', error);
  }
}

// 檢查是否已購買 VIP
export async function checkVIPStatus(): Promise<boolean> {
  // 測試模式：直接返回 true
  if (TEST_MODE) {
    console.log('[IAP] 測試模式：返回 VIP=true');
    return true;
  }

  try {
    // 先檢查本地儲存狀態
    const localVIP = await AsyncStorage.getItem(VIP_CONFIG.VIP_STORAGE_KEY);
    if (localVIP === 'true') {
      return true;
    }

    // 嘗試從 Google Play 取得購買歷史（對應原本的 Billing.getPurchaseHistoryAsync()）
    try {
      const history = await getPurchaseHistory();

      if (history && history.length > 0) {
        for (const purchase of history) {
          if (purchase.productId === VIP_CONFIG.IAP_PRODUCT_ID) {
            // 找到購買紀錄，同步到本地
            await AsyncStorage.setItem(VIP_CONFIG.VIP_STORAGE_KEY, 'true');
            return true;
          }
        }
      }
    } catch {
      // 不是原生平台或無法取得歷史，跳過
    }

    return false;
  } catch (error) {
    console.error('[IAP] 檢查 VIP 狀態失敗:', error);
    return false;
  }
}

// 購買 VIP
export async function purchaseVIP(): Promise<PurchaseResult> {
  // 測試模式：直接模擬成功
  if (TEST_MODE) {
    console.log('[IAP] 測試模式：模擬購買成功');
    await AsyncStorage.setItem(VIP_CONFIG.VIP_STORAGE_KEY, 'true');
    return { success: true };
  }

  // 網頁版不支援購買
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    return { success: false, error: '網頁版不支援購買，請使用手機 App' };
  }

  try {
    // 取得商品資訊（對應原本的 Billing.getProductsAsync()）
    const products = await getProducts([VIP_CONFIG.IAP_PRODUCT_ID]);

    if (!products || products.length === 0) {
      return { success: false, error: '商品不存在，請稍後再試' };
    }

    const product = products[0];
    console.log('[IAP] 商品資訊:', product);

    // 發起購買（對應原本的 Billing.purchaseAsync()）
    await requestPurchase({ sku: VIP_CONFIG.IAP_PRODUCT_ID });

    // 購買結果由 purchaseUpdatedListener 處理
    // 這裡樂觀地返回成功，實際寫入由 listener 完成
    return { success: true };
  } catch (error: any) {
    // 使用者取消
    if (error?.code === 'E_USER_CANCELLED') {
      return { success: false, error: '使用者取消' };
    }

    console.error('[IAP] 購買錯誤:', error);
    return { success: false, error: error?.message || '購買失敗，請稍後再試' };
  }
}

// 恢復購買
export async function restorePurchases(): Promise<boolean> {
  // 測試模式：直接模擬恢復成功
  if (TEST_MODE) {
    await AsyncStorage.setItem(VIP_CONFIG.VIP_STORAGE_KEY, 'true');
    return true;
  }

  try {
    // 取得購買歷史（對應原本的 Billing.getPurchaseHistoryAsync()）
    const history = await getPurchaseHistory();

    if (history && history.length > 0) {
      for (const purchase of history) {
        if (purchase.productId === VIP_CONFIG.IAP_PRODUCT_ID) {
          await AsyncStorage.setItem(VIP_CONFIG.VIP_STORAGE_KEY, 'true');
          console.log('[IAP] 恢復購買成功');
          return true;
        }
      }
    }

    console.log('[IAP] 無可恢復的購買');
    return false;
  } catch (error) {
    console.error('[IAP] 恢復購買失敗:', error);
    return false;
  }
}

// 斷開 IAP 連接
export async function disconnectIAP(): Promise<void> {
  if (TEST_MODE) return;

  try {
    // 對應原本的 Billing.disconnectAsync()
    await endConnection();
    console.log('[IAP] 已斷開連接');
  } catch (error) {
    console.log('[IAP] 斷開連接失敗（可能是網頁版）:', error);
  }
}