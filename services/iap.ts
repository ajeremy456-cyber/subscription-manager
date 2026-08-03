import AsyncStorage from '@react-native-async-storage/async-storage';
import { VIP_CONFIG } from '../constants/version';
import {
  initConnection,
  endConnection,
  fetchProducts,
  requestPurchase,
  getAvailablePurchases,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
  ErrorCode,
  type Purchase,
} from 'expo-iap';

// 測試模式開關（開發時設為 true，上架前設為 false）
const TEST_MODE = false;
const PURCHASE_TIMEOUT_MS = 60000;

type ListenerSubscription = {
  remove: () => void;
};

// 購買結果類型
export interface PurchaseResult {
  success: boolean;
  error?: string;
}

type PendingPurchase = {
  productId: string;
  resolve: (result: PurchaseResult) => void;
  timeoutId: ReturnType<typeof setTimeout>;
};

let isIAPConnected = false;
let initIAPPromise: Promise<boolean> | null = null;
let purchaseUpdateSubscription: ListenerSubscription | null = null;
let purchaseErrorSubscription: ListenerSubscription | null = null;
let pendingPurchase: PendingPurchase | null = null;

function resolvePendingPurchase(result: PurchaseResult, productId?: string) {
  if (!pendingPurchase) return;
  if (productId && pendingPurchase.productId !== productId) return;

  clearTimeout(pendingPurchase.timeoutId);
  pendingPurchase.resolve(result);
  pendingPurchase = null;
}

function normalizePurchaseError(error: Error | unknown): string {
  const code = (error as { code?: string } | undefined)?.code;
  if (code === ErrorCode.UserCancelled) {
    return '使用者取消';
  }

  const message = (error as Error | undefined)?.message;
  return message || '購買失敗，請稍後再試';
}

function registerIAPListeners() {
  if (!purchaseUpdateSubscription) {
    purchaseUpdateSubscription = purchaseUpdatedListener(
      async (purchase: Purchase) => {
        try {
          if (purchase.productId === VIP_CONFIG.IAP_PRODUCT_ID) {
            await handleVIPPurchase();
          }

          await finishTransaction({ purchase, isConsumable: false });
          resolvePendingPurchase({ success: true }, purchase.productId);
        } catch (error) {
          console.error('[IAP] 處理購買失敗:', error);
          resolvePendingPurchase(
            { success: false, error: '完成購買時發生錯誤，請稍後再試' },
            purchase.productId
          );
        }
      }
    );
  }

  if (!purchaseErrorSubscription) {
    purchaseErrorSubscription = purchaseErrorListener((error) => {
      console.error('[IAP] 購買錯誤:', error);
      resolvePendingPurchase({ success: false, error: normalizePurchaseError(error) });
    });
  }
}

function removeIAPListeners() {
  purchaseUpdateSubscription?.remove();
  purchaseErrorSubscription?.remove();
  purchaseUpdateSubscription = null;
  purchaseErrorSubscription = null;
}

// 初始化 IAP
export async function initIAP(): Promise<boolean> {
  // 測試模式：跳過 IAP 初始化
  if (TEST_MODE) {
    console.log('[IAP] 測試模式：跳過 IAP 初始化');
    return true;
  }

  if (isIAPConnected) {
    return true;
  }

  if (initIAPPromise) {
    return initIAPPromise;
  }

  initIAPPromise = (async () => {
    try {
      registerIAPListeners();

      // 建立連線前先掛上 listener，避免漏接商店回調
      const connected = await initConnection();

      if (!connected) {
        console.log('[IAP] 初始化失敗');
        removeIAPListeners();
        return false;
      }

      isIAPConnected = true;
      console.log('[IAP] 初始化成功');
      return true;
    } catch (error) {
      console.log('[IAP] 初始化錯誤（網頁版或無 IAP 支援）:', error);
      removeIAPListeners();
      return false;
    } finally {
      initIAPPromise = null;
    }
  })();

  return initIAPPromise;
}

// 處理 VIP 購買（內部使用）
async function handleVIPPurchase(): Promise<void> {
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

    const connected = await initIAP();
    if (!connected) {
      return false;
    }

    // 嘗試從 Google Play 取得購買歷史（對應原本的 Billing.getPurchaseHistoryAsync()）
    try {
      const history = await getAvailablePurchases();

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
    if (pendingPurchase) {
      return { success: false, error: '已有購買流程進行中，請稍候' };
    }

    const connected = await initIAP();
    if (!connected) {
      return { success: false, error: 'IAP 初始化失敗，請使用支援內購的 App 版本' };
    }

    // 取得商品資訊（對應原本的 Billing.getProductsAsync()）
    const products = await fetchProducts({ skus: [VIP_CONFIG.IAP_PRODUCT_ID], type: 'in-app' });
    if (!products || products.length === 0) {
      return { success: false, error: '商品不存在，請稍後再試' };
    }

    const product = products[0];
    console.log('[IAP] 商品資訊:', product);

    // 發起購買（對應原本的 Billing.purchaseAsync()）
    const purchaseResultPromise = new Promise<PurchaseResult>((resolve) => {
      pendingPurchase = {
        productId: VIP_CONFIG.IAP_PRODUCT_ID,
        resolve,
        timeoutId: setTimeout(() => {
          resolvePendingPurchase({ success: false, error: '購買逾時，請稍後再試' });
        }, PURCHASE_TIMEOUT_MS),
      };
    });

    try {
      await requestPurchase({
        request: {
          apple: { sku: VIP_CONFIG.IAP_PRODUCT_ID },
          google: { skus: [VIP_CONFIG.IAP_PRODUCT_ID] },
        },
        type: 'in-app',
      });
    } catch (error) {
      resolvePendingPurchase({ success: false, error: normalizePurchaseError(error) });
      throw error;
    }

    return await purchaseResultPromise;
  } catch (error: any) {
    console.error('[IAP] 購買錯誤:', error);
    return { success: false, error: normalizePurchaseError(error) };
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
    const connected = await initIAP();
    if (!connected) {
      return false;
    }

    // 取得購買歷史（對應原本的 Billing.getPurchaseHistoryAsync()）
    const history = await getAvailablePurchases();

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
    resolvePendingPurchase({ success: false, error: '購買流程已中斷' });
    removeIAPListeners();

    // 對應原本的 Billing.disconnectAsync()
    if (isIAPConnected) {
      await endConnection();
    }
    isIAPConnected = false;
    console.log('[IAP] 已斷開連接');
  } catch (error) {
    console.log('[IAP] 斷開連接失敗（可能是網頁版）:', error);
  }
}
