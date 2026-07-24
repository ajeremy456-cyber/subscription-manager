import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage Keys
const STORAGE_KEYS = {
  SUBSCRIPTIONS: '@subscription_manager/subscriptions',
  PAYMENT_METHODS: '@subscription_manager/payment_methods',
} as const;

// Subscription interface
export interface Subscription {
  id: string;
  name: string;
  price: number;
  currency: string;
  cycle: 'monthly' | 'yearly' | 'quarterly';
  nextBillingDate: string;
  paymentMethodId: string;
  bankFee: number;
  category?: string;
  note?: string;
  status: 'active' | 'paused';
  createdAt: string;
  updatedAt: string;
}

// Payment Method interface
export interface PaymentMethod {
  id: string;
  name: string;
  bank?: string;
  fee?: number;
  reward?: string;
  note?: string;
}

// Default payment methods
const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = [
  { id: '1', name: '現金' },
  { id: '2', name: '信用卡' },
  { id: '3', name: 'LINE Pay' },
];

// ============ Subscriptions ============

/**
 * 讀取所有訂閱
 */
export async function getSubscriptions(): Promise<Subscription[]> {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEYS.SUBSCRIPTIONS);
    if (json) {
      return JSON.parse(json);
    }
    return [];
  } catch (error) {
    console.error('Error reading subscriptions:', error);
    return [];
  }
}

/**
 * 保存所有訂閱
 */
export async function saveSubscriptions(subscriptions: Subscription[]): Promise<void> {
  try {
    await AsyncStorage.setItem(
      STORAGE_KEYS.SUBSCRIPTIONS,
      JSON.stringify(subscriptions)
    );
  } catch (error) {
    console.error('Error saving subscriptions:', error);
    throw error;
  }
}

/**
 * 新增訂閱
 */
export async function addSubscription(subscription: Subscription): Promise<void> {
  const subscriptions = await getSubscriptions();
  subscriptions.push(subscription);
  await saveSubscriptions(subscriptions);
}

/**
 * 更新訂閱
 */
export async function updateSubscription(updatedSub: Subscription): Promise<void> {
  const subscriptions = await getSubscriptions();
  const index = subscriptions.findIndex(sub => sub.id === updatedSub.id);
  if (index !== -1) {
    subscriptions[index] = updatedSub;
    await saveSubscriptions(subscriptions);
  }
}

/**
 * 刪除訂閱
 */
export async function deleteSubscription(id: string): Promise<void> {
  const subscriptions = await getSubscriptions();
  const filtered = subscriptions.filter(sub => sub.id !== id);
  await saveSubscriptions(filtered);
}

// ============ Payment Methods ============

/**
 * 讀取所有支付方式
 */
export async function getPaymentMethods(): Promise<PaymentMethod[]> {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEYS.PAYMENT_METHODS);
    if (json) {
      return JSON.parse(json);
    }
    // 如果沒有資料，返回預設值
    await savePaymentMethods(DEFAULT_PAYMENT_METHODS);
    return DEFAULT_PAYMENT_METHODS;
  } catch (error) {
    console.error('Error reading payment methods:', error);
    return DEFAULT_PAYMENT_METHODS;
  }
}

/**
 * 保存所有支付方式
 */
export async function savePaymentMethods(methods: PaymentMethod[]): Promise<void> {
  try {
    await AsyncStorage.setItem(
      STORAGE_KEYS.PAYMENT_METHODS,
      JSON.stringify(methods)
    );
  } catch (error) {
    console.error('Error saving payment methods:', error);
    throw error;
  }
}

/**
 * 新增支付方式
 */
export async function addPaymentMethod(method: PaymentMethod): Promise<void> {
  const methods = await getPaymentMethods();
  methods.push(method);
  await savePaymentMethods(methods);
}

/**
 * 刪除支付方式
 */
export async function deletePaymentMethod(id: string): Promise<void> {
  const methods = await getPaymentMethods();
  const filtered = methods.filter(m => m.id !== id);
  await savePaymentMethods(filtered);
}

/**
 * 清除所有資料（除錯用）
 */
export async function clearAllData(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.SUBSCRIPTIONS,
      STORAGE_KEYS.PAYMENT_METHODS,
    ]);
  } catch (error) {
    console.error('Error clearing data:', error);
    throw error;
  }
}

// ============ 自動計算下次扣款日期 ============

/**
 * 轉換成本地日期字串（YYYY-MM-DD）
 */
function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 計算實際下次扣款日期（自動推進過期的日期）
 */
export function calculateActualNextBillingDate(
  storedDate: string,
  cycle: 'monthly' | 'quarterly' | 'yearly'
): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let nextDate = new Date(storedDate);
  nextDate.setHours(0, 0, 0, 0);

  // 如果日期已過，反覆往前推直到未來
  while (nextDate <= today) {
    switch (cycle) {
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case 'quarterly':
        nextDate.setMonth(nextDate.getMonth() + 3);
        break;
      case 'yearly':
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        break;
    }
  }

  return toLocalDateString(nextDate);
}