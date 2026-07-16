import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage key for notifications
const NOTIFICATION_PERMISSION_KEY = '@subscription_manager/notification_permission';
const NOTIFICATION_SCHEDULED_KEY = '@subscription_manager/scheduled_notifications';

// Types
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

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * 請求通知權限
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!Device.isDevice) {
    console.log('Not a physical device, skipping notification permission');
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Failed to get notification permission');
    return false;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('billing-reminder', {
      name: '扣款提醒',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4A90E2',
      sound: 'default',
    });
  }

  await AsyncStorage.setItem(NOTIFICATION_PERMISSION_KEY, 'granted');
  return true;
}

/**
 * 檢查是否已有通知權限
 */
export async function checkNotificationPermission(): Promise<boolean> {
  const permission = await AsyncStorage.getItem(NOTIFICATION_PERMISSION_KEY);
  return permission === 'granted';
}

/**
 * 為所有活躍訂閱設定扣款提醒（扣款前2天）
 */
export async function scheduleBillingReminders(subscriptions: Subscription[]): Promise<void> {
  if (!Device.isDevice) return;

  // 先取消所有已排程的通知
  await cancelAllScheduledNotifications();

  const activeSubscriptions = subscriptions.filter(sub => sub.status === 'active');

  for (const sub of activeSubscriptions) {
    await scheduleBillingReminder(sub);
  }
}

/**
 * 為單個訂閱設定扣款提醒
 */
async function scheduleBillingReminder(subscription: Subscription): Promise<void> {
  if (!Device.isDevice) return;

  const billingDate = new Date(subscription.nextBillingDate);

  // ========== 扣款前 2 天提醒 ==========
  const twoDaysBefore = new Date(billingDate);
  twoDaysBefore.setDate(twoDaysBefore.getDate() - 2);
  twoDaysBefore.setHours(9, 0, 0, 0);
  //下方是測試提醒的秒發送
  //const twoDaysBefore = new Date();
  //twoDaysBefore.setSeconds(twoDaysBefore.getSeconds() + 5); // 5秒後
 
  // 如果提醒時間已經過了，跳過
  if (twoDaysBefore.getTime() > Date.now()) {
    const identifier = `billing-2days-${subscription.id}`;
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '📅 扣款提醒',
          body: `${subscription.name} 將在 ${formatDate(billingDate)} 扣款 ${subscription.currency}${subscription.price}，請確保帳戶餘額充足`,
          data: { subscriptionId: subscription.id, type: '2days' },
          sound: 'default',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: twoDaysBefore,
        },
        identifier,
      });
      console.log(`Scheduled 2-day reminder for ${subscription.name}`);
      await saveScheduledNotificationId(`${subscription.id}-2days`, identifier);
    } catch (error) {
      console.error(`Error scheduling 2-day notification for ${subscription.name}:`, error);
    }
  }

  // ========== 扣款當天提醒 ==========
  const billingDay = new Date(billingDate);
  billingDay.setHours(9, 0, 0, 0); // 早上9點提醒

  // 如果提醒時間已經過了，跳過
  if (billingDay.getTime() > Date.now()) {
    const identifier = `billing-today-${subscription.id}`;
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '今日扣款',
          body: `${subscription.name} 今天將扣款 ${subscription.currency}${subscription.price}，注意帳戶變動！`,
          data: { subscriptionId: subscription.id, type: 'today' },
          sound: 'default',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: billingDay,
        },
        identifier,
      });
      console.log(`Scheduled billing day reminder for ${subscription.name}`);
      await saveScheduledNotificationId(`${subscription.id}-today`, identifier);
    } catch (error) {
      console.error(`Error scheduling billing day notification for ${subscription.name}:`, error);
    }
  }
}

/**
 * 格式化日期顯示
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}/${month}/${day}`;
}

/**
 * 取消單個訂閱的通知
 */
export async function cancelNotificationForSubscription(subscriptionId: string): Promise<void> {
  const scheduledIds = await getScheduledNotificationIds();
  const identifier = scheduledIds[subscriptionId];
  
  if (identifier) {
    await Notifications.cancelScheduledNotificationAsync(identifier);
    delete scheduledIds[subscriptionId];
    await saveScheduledNotificationIds(scheduledIds);
  }
}

/**
 * 取消所有排程的通知
 */
export async function cancelAllScheduledNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await AsyncStorage.removeItem(NOTIFICATION_SCHEDULED_KEY);
}

/**
 * 儲存已排程的通知 ID
 */
async function saveScheduledNotificationId(subscriptionId: string, identifier: string): Promise<void> {
  const scheduledIds = await getScheduledNotificationIds();
  scheduledIds[subscriptionId] = identifier;
  await saveScheduledNotificationIds(scheduledIds);
}

/**
 * 讀取已排程的通知 ID
 */
async function getScheduledNotificationIds(): Promise<Record<string, string>> {
  try {
    const json = await AsyncStorage.getItem(NOTIFICATION_SCHEDULED_KEY);
    return json ? JSON.parse(json) : {};
  } catch {
    return {};
  }
}

/**
 * 保存已排程的通知 ID
 */
async function saveScheduledNotificationIds(ids: Record<string, string>): Promise<void> {
  await AsyncStorage.setItem(NOTIFICATION_SCHEDULED_KEY, JSON.stringify(ids));
}

/**
 * 測試通知功能（開發用）
 */
export async function sendTestNotification(): Promise<void> {
  if (!Device.isDevice) {
    alert('測試通知：這是網頁版測試通知！');
    return;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🔔 測試通知',
      body: '通知功能正常運作！',
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(Date.now() + 1000), // 1秒後
    },
  });
}