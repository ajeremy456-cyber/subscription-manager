import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  TextInput, Alert, Modal, ActivityIndicator,
} from 'react-native';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { NavigationContainer, useNavigation, useRoute, useFocusEffect, type RouteProp } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CURRENCY, CATEGORIES } from './constants/theme';
import { VIP_CONFIG } from './constants/version';
import { checkVIPStatus, purchaseVIP, restorePurchases, initIAP } from './services/iap';
import { templateData } from './features/templates/templates';
import {
  getSubscriptions,
  getPaymentMethods,
  saveSubscriptions,
  savePaymentMethods,
  calculateActualNextBillingDate,
  type Subscription,
  type PaymentMethod,
} from './services/storage';
import {
  requestNotificationPermission,
  scheduleBillingReminders,
} from './services/notifications';
import VIPScreen from './components/VIPScreen';
import AdBanner from './components/AdBanner';
import AddSubscriptionScreen from './screens/AddSubscriptionScreen';

// ─── 顏色系統 ────────────────────────────────────────────────
const C = {
  bg: '#F5F7FA',
  white: '#FFFFFF',
  border: '#E2E8F0',
  borderLight: '#E8ECF0',

  text: '#1A202C',
  textSub: '#4A5568',
  textMuted: '#94A3B8',
  textDim: '#CBD5E1',

  blue: '#2563EB',
  blueLight: '#EFF6FF',
  blueBorder: '#BFDBFE',

  green: '#059669',
  greenLight: '#ECFDF5',
  greenBorder: '#A7F3D0',

  amber: '#D97706',
  amberBorder: '#F59E0B',

  pillPausedBg: '#F8FAFC',
  pillPausedText: '#94A3B8',
  pillPausedBorder: '#E2E8F0',
};

// ─── 導航類型定義 ────────────────────────────────────────────
type RootStackParamList = {
  Home: undefined;
  AddSubscription: {
    editingId?: string;
    editData?: Subscription;
    templateName?: string;
    templatePrice?: number;
    templateCycle?: 'monthly' | 'quarterly' | 'yearly';
    subscriptionCount?: number;
    isVIP?: boolean;
  };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// ─── 小型 Label 元件 ──────────────────────────────────────────
function FormLabel({ children }: { children: string }) {
  return <Text style={s.formLabel}>{children}</Text>;
}

// ─── 從訂閱名稱取得品牌色 ───────────────────────────────────
const BRAND_COLORS: Record<string, string> = {
  Netflix: '#E50914',
  Spotify: '#1DB954',
  'YouTube Premium': '#FF0000',
  KKBOX: '#00BFFF',
  '巴哈姆特動畫瘋': '#FF6600',
  Gogoro: '#00B900',
  '健身工廠': '#F59E0B',
  'World Gym': '#1A56DB',
};
function tplColor(name: string): string | undefined {
  return BRAND_COLORS[name];
}

const cycleLabel = (c: string) =>
  c === 'monthly' ? '月繳' : c === 'yearly' ? '年繳' : '季繳';

// ─── 主頁面元件 ────────────────────────────────────────────────
function HomeScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'Home'>>();

  // ─── 載入狀態 ───────────────────────────────────────────────
  const [loading, setLoading] = useState(true);

  // ─── 核心資料 ───────────────────────────────────────────────
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingName, setDeletingName] = useState('');

  // ─── 支付方式表單狀態 ────────────────────────────────────────
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [paymentName, setPaymentName] = useState('');
  const [paymentBank, setPaymentBank] = useState('');
  const [paymentFee, setPaymentFee] = useState('');
  const [paymentReward, setPaymentReward] = useState('');
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);

  // ─── VIP 狀態 ───────────────────────────────────────────────
  const [isVIP, setIsVIP] = useState(false);
  const [showVIPModal, setShowVIPModal] = useState(false);
  const [purchasing, setPurchasing] = useState(false);

  // ─── 初始化：從 Storage 載入資料 ────────────────────────────
  useFocusEffect(
    useCallback(() => {
      async function loadData() {
        try {
          const [savedSubs, savedPMs, vipStatus] = await Promise.all([
            getSubscriptions(),
            getPaymentMethods(),
            checkVIPStatus(),
          ]);
          setSubscriptions(savedSubs);
          setPaymentMethods(savedPMs);
          setIsVIP(vipStatus);

          // 初始化 IAP
          await initIAP();

          const hasPermission = await requestNotificationPermission();
          setNotificationsEnabled(hasPermission);
          if (hasPermission) await scheduleBillingReminders(savedSubs);
        } catch (e) {
          console.error('載入資料失敗:', e);
        } finally {
          setLoading(false);
        }
      }
      loadData();
    }, [])
  );

  // ─── VIP 購買 ───────────────────────────────────────────────
  const handlePurchaseVIP = async () => {
    if (purchasing) return;
    setPurchasing(true);
    try {
      const result = await purchaseVIP();
      if (result.success) {
        setIsVIP(true);
        setShowVIPModal(false);
        Alert.alert('恭喜', '您已成功升級為 VIP！');
      } else if (result.error && result.error !== '使用者取消') {
        Alert.alert('購買失敗', result.error);
      }
    } catch (e) {
      Alert.alert('錯誤', '購買過程中發生錯誤，請稍後再試');
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestorePurchases = async () => {
    const restored = await restorePurchases();
    if (restored) {
      setIsVIP(true);
      setShowVIPModal(false);
      Alert.alert('復原成功', '已恢復您的 VIP 會員資格');
    } else {
      Alert.alert('復原失敗', '找不到之前的購買記錄');
    }
  };

  // ─── 刪除訂閱 ────────────────────────────────────────────────
  const confirmDelete = (id: string, subName: string) => {
    setDeletingId(id);
    setDeletingName(subName);
    setDeleteModalVisible(true);
  };

  const executeDelete = async () => {
    if (deletingId) {
      const updated = subscriptions.filter(sub => sub.id !== deletingId);
      setSubscriptions(updated);
      await saveSubscriptions(updated);
      if (notificationsEnabled) await scheduleBillingReminders(updated);
    }
    setDeleteModalVisible(false);
    setDeletingId(null);
  };

  // ─── 新增支付方式 ────────────────────────────────────────────
  const savePaymentMethod = async () => {
    if (!paymentName) {
      Alert.alert('請填寫完整', '請填寫支付方式名稱');
      return;
    }
    const newPM: PaymentMethod = {
      id: Date.now().toString(), name: paymentName,
      bank: paymentBank || undefined, fee: parseFloat(paymentFee) || undefined,
      reward: paymentReward || undefined,
    };
    const updated = [...paymentMethods, newPM];
    setPaymentMethods(updated);
    await savePaymentMethods(updated);
    setPaymentName(''); setPaymentBank(''); setPaymentFee(''); setPaymentReward('');
  };

  // ─── 刪除支付方式 ────────────────────────────────────────────
  const deletePaymentMethod = async (id: string) => {
    Alert.alert(
      '確認刪除',
      '確定要刪除這個支付方式嗎？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '刪除',
          style: 'destructive',
          onPress: async () => {
            const updated = paymentMethods.filter(pm => pm.id !== id);
            setPaymentMethods(updated);
            await savePaymentMethods(updated);
          },
        },
      ]
    );
  };

  // ─── 切換啟用 / 暫停 ─────────────────────────────────────────
  const toggleStatus = async (id: string) => {
    const updated = subscriptions.map(sub =>
      sub.id === id
        ? { ...sub, status: sub.status === 'active' ? 'paused' : 'active',
            updatedAt: new Date().toISOString() }
        : sub
    );
    setSubscriptions(updated);
    await saveSubscriptions(updated);
    if (notificationsEnabled) await scheduleBillingReminders(updated);
  };

  // ─── 跳轉到新增頁面 ──────────────────────────────────────────
  const navigateToAdd = () => {
    navigation.navigate('AddSubscription', {
      subscriptionCount: subscriptions.length,
      isVIP,
    });
  };

  // ─── 跳轉到編輯頁面 ──────────────────────────────────────────
  const navigateToEdit = (sub: Subscription) => {
    navigation.navigate('AddSubscription', {
      editingId: sub.id,
      editData: sub,
      subscriptionCount: subscriptions.length,
      isVIP,
    });
  };

  // ─── 快速新增（從模板）───────────────────────────────────────
  const handleQuickAdd = (template: any) => {
    navigation.navigate('AddSubscription', {
      templateName: template.name,
      templatePrice: template.defaultPrice,
      templateCycle: template.cycle,
      subscriptionCount: subscriptions.length,
      isVIP,
    });
  };

  // ─── 計算數據 ─────────────────────────────────────────────────
  const activeSubs = subscriptions.filter(s => s.status === 'active');

  const monthlyTotal = activeSubs.reduce((total, sub) => {
    if (sub.cycle === 'yearly') return total + sub.price / 12;
    if (sub.cycle === 'quarterly') return total + sub.price / 3;
    return total + sub.price;
  }, 0);

  const yearlyTotal = monthlyTotal * 12;

  // 判斷是否在 7 天內即將扣款（使用自動計算的日期）
  const isDueSoon = (sub: Subscription) => {
    const actualDate = calculateActualNextBillingDate(sub.nextBillingDate, sub.cycle);
    const today = new Date();
    const due = new Date(actualDate);
    const diff = (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 7;
  };

  // 計算距今天數文字（使用自動計算的日期）
  const getDueLabel = (sub: Subscription) => {
    const actualDate = calculateActualNextBillingDate(sub.nextBillingDate, sub.cycle);
    const today = new Date();
    const due = new Date(actualDate);
    const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return '今天扣款';
    if (diff === 1) return '明天扣款';
    return `${diff} 天後扣款`;
  };

  const dueSoonCount = activeSubs.filter(s => isDueSoon(s)).length;

  // 按下次扣款日排序（最近的在前）
  const sortedSubscriptions = useMemo(() => {
    return [...subscriptions].sort((a, b) => {
      const dateA = new Date(calculateActualNextBillingDate(a.nextBillingDate, a.cycle) + 'T00:00:00');
      const dateB = new Date(calculateActualNextBillingDate(b.nextBillingDate, b.cycle) + 'T00:00:00');
      return dateA.getTime() - dateB.getTime();
    });
  }, [subscriptions]);

  const getPaymentMethodName = (id: string) =>
    paymentMethods.find(p => p.id === id)?.name ?? '未設定';

  // ─── 載入畫面 ─────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.loadingContainer}>
        <ActivityIndicator size="large" color={C.blue} />
        <Text style={s.loadingText}>載入資料中...</Text>
      </View>
    );
  }

  // ─── 主畫面 ───────────────────────────────────────────────────
  return (
    <View style={s.container}>
      {/* ── Header ── */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <Text style={s.headerTitle}>訂閱管家</Text>
          {isVIP && (
            <View style={s.vipBadgeSmall}>
              <Text style={s.vipBadgeText}>VIP</Text>
            </View>
          )}
        </View>
        <TouchableOpacity style={s.headerBtn} onPress={() => setShowPaymentForm(true)}>
          <Text style={s.headerBtnText}>💳 支付方式</Text>
        </TouchableOpacity>
      </View>

      {/* ── 儀表板 Hero ── */}
      <View style={s.hero}>
        <Text style={s.heroLabel}>本月訂閱支出</Text>
        <Text style={s.heroAmount}>
          <Text style={s.heroCurrency}>{CURRENCY} </Text>
          {monthlyTotal.toFixed(0)}
        </Text>
        <View style={s.heroStats}>
          <View style={s.heroStat}>
            {isVIP ? (
              <Text style={s.heroStatVal}>{activeSubs.length} 項</Text>
            ) : (
              <Text style={s.heroStatVal}>{subscriptions.length}/{VIP_CONFIG.FREE_LIMIT}</Text>
            )}
            <Text style={s.heroStatLabel}>{isVIP ? '啟用中' : '已用/上限'}</Text>
          </View>
          <View style={[s.heroStat, s.heroStatBorder]}>
            <Text style={s.heroStatVal}>{CURRENCY} {yearlyTotal.toFixed(0)}</Text>
            <Text style={s.heroStatLabel}>年化金額</Text>
          </View>
          <View style={[s.heroStat, s.heroStatBorder]}>
            <Text style={s.heroStatVal}>{dueSoonCount} 項</Text>
            <Text style={s.heroStatLabel}>本週即將扣款</Text>
          </View>
        </View>
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        {/* ── 訂閱清單 ── */}
        <View style={[s.section, { marginTop: 16 }]}>
          <Text style={s.sectionLabel}>我的訂閱</Text>

          {subscriptions.length === 0 ? (
            <View style={s.emptyCard}>
              <Text style={s.emptyTitle}>還沒有訂閱記錄</Text>
              <Text style={s.emptySubtitle}>點擊下方按鈕新增</Text>
            </View>
          ) : (
            sortedSubscriptions.map((sub) => {
              const soon = sub.status === 'active' && isDueSoon(sub);
              const actualDate = calculateActualNextBillingDate(sub.nextBillingDate, sub.cycle);
              return (
                <View
                  key={sub.id}
                  style={[
                    s.subCard,
                    soon && s.subCardDue,
                    sub.status === 'paused' && s.subCardPaused,
                  ]}
                >
                  {/* 左側：圖示 + 資訊 */}
                  <View style={s.subLeft}>
                    {/* 品牌首字母色塊 */}
                    <View style={[s.subIcon, { backgroundColor: (tplColor(sub.name) ?? C.blue) + '1A' }]}>
                      <Text style={[s.subIconText, { color: tplColor(sub.name) ?? C.blue }]}>
                        {sub.name.slice(0, 2).toUpperCase()}
                      </Text>
                    </View>

                    <View style={s.subInfo}>
                      <Text style={s.subName}>{sub.name}</Text>
                      <View style={s.subMeta}>
                        <Text style={s.subMetaText}>{cycleLabel(sub.cycle)}</Text>
                        {sub.category ? (
                          <>
                            <View style={s.metaDot} />
                            <Text style={s.subMetaText}>{sub.category}</Text>
                          </>
                        ) : null}
                      </View>

                      {/* 即將扣款 or 下次扣款日 */}
                      {soon ? (
                        <Text style={s.subDateSoon}>
                          ⏰ {getDueLabel(sub)}（{actualDate.slice(5)}）
                        </Text>
                      ) : (
                        <Text style={s.subDate}>
                          {sub.status === 'paused' ? '已暫停' : `下次扣款：${actualDate.slice(5)}`}
                        </Text>
                      )}

                      {sub.note ? (
                        <Text style={s.subNote} numberOfLines={1}>📝 {sub.note}</Text>
                      ) : null}
                    </View>
                  </View>

                  {/* 右側：金額 + 標籤 + 操作 */}
                  <View style={s.subRight}>
                    <Text style={s.subPrice}>
                      {sub.price}
                      <Text style={s.subPriceUnit}> / {cycleLabel(sub.cycle).replace('繳', '')}</Text>
                    </Text>

                    {/* 啟用 / 暫停 pill（點擊切換） */}
                    <TouchableOpacity
                      style={[s.statusPill, sub.status === 'active' ? s.pillActive : s.pillPaused]}
                      onPress={() => toggleStatus(sub.id)}
                    >
                      <Text style={[s.statusPillText, sub.status === 'active' ? s.pillActiveText : s.pillPausedText]}>
                        {sub.status === 'active' ? '啟用' : '暫停'}
                      </Text>
                    </TouchableOpacity>

                    {/* 綁定信用卡標籤 */}
                    <View style={s.cardTag}>
                      <Text style={s.cardTagText}>{getPaymentMethodName(sub.paymentMethodId)}</Text>
                    </View>

                    {/* 手續費提示 */}
                    {sub.bankFee > 0 && (
                      <Text style={s.feeText}>+{CURRENCY}{sub.bankFee} 手續費</Text>
                    )}

                    {/* 編輯 / 刪除 */}
                    <View style={s.subActions}>
                      <TouchableOpacity onPress={() => navigateToEdit(sub)} style={s.actionBtn}>
                        <Text style={s.actionBtnText}>✏️</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        onPress={() => confirmDelete(sub.id, sub.name)} 
                        style={s.actionBtn}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Text style={[s.actionBtnText, { color: '#dc2626' }]}>X</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View style={{ height: 16 }} />
      </ScrollView>

      {/* ── 底部雙按鈕 ── */}
      <View style={s.bottomButtons}>
        <TouchableOpacity style={s.quickAddBtn} onPress={() => setShowQuickAddModal(true)}>
          <Text style={s.quickAddBtnText}>⚡ 快速新增</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.fab} onPress={navigateToAdd}>
          <Text style={s.fabText}>＋ 新增訂閱</Text>
        </TouchableOpacity>
      </View>

      {/* ── 快速新增 Modal ── */}
      <Modal visible={showQuickAddModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.quickAddSheet}>
            <View style={s.formHeader}>
              <Text style={s.formTitle}>快速新增</Text>
              <TouchableOpacity onPress={() => setShowQuickAddModal(false)}>
                <Text style={s.formClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {templateData.map((tpl) => (
                <TouchableOpacity
                  key={tpl.id}
                  style={s.templateItem}
                  onPress={() => {
                    handleQuickAdd(tpl);
                    setShowQuickAddModal(false);
                  }}
                >
                  <View style={[s.templateIcon, { backgroundColor: tpl.color + '20' }]}>
                    <Text style={[s.templateIconText, { color: tpl.color }]}>
                      {tpl.name.slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View style={s.templateInfo}>
                    <Text style={s.templateName}>{tpl.name}</Text>
                    <Text style={s.templatePrice}>
                      {CURRENCY}{tpl.defaultPrice} / {cycleLabel(tpl.cycle)}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── 支付方式 Modal ── */}
      <Modal visible={showPaymentForm} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.formHeader}>
              <Text style={s.formTitle}>支付方式管理</Text>
              <TouchableOpacity onPress={() => setShowPaymentForm(false)}>
                <Text style={s.formClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* 現有支付方式清單 */}
            <ScrollView style={s.pmList} showsVerticalScrollIndicator={false}>
              {paymentMethods.length === 0 ? (
                <Text style={s.pmEmptyText}>還沒有支付方式</Text>
              ) : (
                paymentMethods.map((pm) => (
                  <View key={pm.id} style={s.pmItem}>
                    <View style={s.pmItemContent}>
                      <Text style={s.pmName}>{pm.name}</Text>
                      {pm.bank && <Text style={s.pmMeta}>{pm.bank}</Text>}
                      {pm.fee && <Text style={s.pmFee}>手續費 {pm.fee}%</Text>}
                      {pm.reward && <Text style={s.pmReward}>回饋：{pm.reward}</Text>}
                    </View>
                    <TouchableOpacity
                      onPress={() => deletePaymentMethod(pm.id)}
                      style={s.pmDeleteBtn}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Text style={s.pmDeleteBtnText}>X</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>

            {/* 新增支付方式表單 */}
            <View style={s.pmDivider} />
            <Text style={s.pmAddTitle}>新增支付方式</Text>

            <FormLabel>名稱</FormLabel>
            <TextInput style={s.input} value={paymentName} onChangeText={setPaymentName} placeholder="例如：國泰 CUBE 卡" placeholderTextColor={C.textMuted} />

            {/*<FormLabel>銀行（選填）</FormLabel>
            <TextInput style={s.input} value={paymentBank} onChangeText={setPaymentBank} placeholder="例如：國泰世華" placeholderTextColor={C.textMuted} />

            <FormLabel>海外手續費 %（選填）</FormLabel>
            <TextInput style={s.input} value={paymentFee} onChangeText={setPaymentFee} placeholder="1.5" keyboardType="numeric" placeholderTextColor={C.textMuted} />
            */}
            <FormLabel>說明（選填）</FormLabel>
            <TextInput style={s.input} value={paymentReward} onChangeText={setPaymentReward} placeholder="例如：訂閱服務 3% 回饋" placeholderTextColor={C.textMuted} />

            <TouchableOpacity style={s.saveBtn} onPress={savePaymentMethod}>
              <Text style={s.saveBtnText}>新增支付方式</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 刪除確認彈窗 */}
      {deleteModalVisible && (
        <View style={s.deleteModalOverlay}>
          <View style={s.deleteModal}>
            <Text style={s.deleteModalTitle}>確認刪除</Text>
            <Text style={s.deleteModalText}>確定要刪除「{deletingName}」嗎？</Text>
            <View style={s.deleteModalBtns}>
              <TouchableOpacity style={s.deleteCancelBtn} onPress={() => setDeleteModalVisible(false)}>
                <Text style={s.deleteCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.deleteConfirmBtn} onPress={executeDelete}>
                <Text style={s.deleteConfirmText}>刪除</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ── 廣告橫幅（免費版） ── */}
      {!isVIP && (
        <AdBanner onUpgradePress={() => setShowVIPModal(true)} />
      )}

      {/* ── VIP 升級彈窗 ── */}
      <VIPScreen
        visible={showVIPModal}
        onClose={() => setShowVIPModal(false)}
        onPurchase={handlePurchaseVIP}
        onRestore={handleRestorePurchases}
      />

      <StatusBar style="dark" />
    </View>
  );
}

// ─── App 導航容器 ──────────────────────────────────────────────
export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen 
          name="AddSubscription" 
          component={AddSubscriptionScreen}
          options={{
            animation: 'slide_from_right',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// ─── 樣式 ─────────────────────────────────────────────────────
const s = StyleSheet.create({
  // 容器
  container: { flex: 1, backgroundColor: C.bg },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },
  loadingText: { marginTop: 12, fontSize: 15, color: C.textMuted },
  scroll: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
    backgroundColor: C.white, borderBottomWidth: 0.5, borderBottomColor: C.borderLight,
  },
  headerTitle: { fontSize: 20, fontWeight: '500', color: C.text, letterSpacing: -0.3 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  vipBadgeSmall: {
    backgroundColor: '#FFD700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4,
  },
  vipBadgeText: {
    fontSize: 10, fontWeight: '700', color: '#78350F',
  },
  headerBtn: {
    backgroundColor: C.white, borderWidth: 0.5, borderColor: '#D1D9E0',
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
  },
  headerBtnText: { fontSize: 13, color: C.textSub },

  // Hero 儀表板
  hero: {
    backgroundColor: C.white, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 22,
    borderBottomWidth: 0.5, borderBottomColor: C.borderLight,
  },
  heroLabel: { fontSize: 11, color: C.textMuted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6 },
  heroAmount: { fontSize: 44, fontWeight: '500', color: C.text, letterSpacing: -1.5, lineHeight: 48, marginBottom: 18 },
  heroCurrency: { fontSize: 22, color: C.textMuted, fontWeight: '400' },
  heroStats: { flexDirection: 'row' },
  heroStat: { flex: 1 },
  heroStatBorder: { borderLeftWidth: 0.5, borderLeftColor: C.borderLight, paddingLeft: 14, marginLeft: 14 },
  heroStatVal: { fontSize: 15, fontWeight: '500', color: '#2D3748' },
  heroStatLabel: { fontSize: 11, color: C.textMuted, marginTop: 2 },

  // Section
  section: { paddingHorizontal: 16, paddingTop: 20 },
  sectionLabel: {
    fontSize: 11, color: C.textMuted, letterSpacing: 0.6,
    textTransform: 'uppercase', marginBottom: 11,
  },

  // 模板 chip
  tplChip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: C.white, borderWidth: 0.5, borderColor: C.border,
    borderRadius: 20, paddingHorizontal: 13, paddingVertical: 7,
    marginRight: 8,
  },
  tplDot: { width: 7, height: 7, borderRadius: 4 },
  tplName: { fontSize: 13, color: '#374151' },
  tplPrice: { fontSize: 12, color: C.textMuted },

  // 空狀態
  emptyCard: {
    backgroundColor: C.white, borderWidth: 0.5, borderColor: C.border,
    borderRadius: 12, paddingVertical: 36, alignItems: 'center',
  },
  emptyTitle: { fontSize: 15, color: C.textSub, marginBottom: 6 },
  emptySubtitle: { fontSize: 13, color: C.textMuted },

  // 訂閱卡片
  subCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    backgroundColor: C.white, borderWidth: 0.5, borderColor: C.border,
    borderRadius: 12, padding: 14, marginBottom: 8,
  },
  subCardDue: { borderLeftWidth: 3, borderLeftColor: C.amberBorder, paddingLeft: 11 },
  subCardPaused: { opacity: 0.45 },

  subLeft: { flexDirection: 'row', alignItems: 'flex-start', flex: 1, gap: 12 },
  subIcon: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  subIconText: { fontSize: 12, fontWeight: '600' },
  subInfo: { flex: 1 },
  subName: { fontSize: 15, fontWeight: '500', color: C.text, marginBottom: 3 },
  subMeta: { flexDirection: 'row', alignItems: 'center' },
  subMetaText: { fontSize: 12, color: C.textMuted },
  metaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#CBD5E1', marginHorizontal: 5 },
  subDate: { fontSize: 11, color: C.textDim, marginTop: 4 },
  subDateSoon: { fontSize: 11, color: C.amber, fontWeight: '500', marginTop: 4 },
  subNote: { fontSize: 11, color: C.textMuted, marginTop: 3 },

  subRight: { alignItems: 'flex-end', gap: 4 },
  subPrice: { fontSize: 17, fontWeight: '500', color: C.text, letterSpacing: -0.3 },
  subPriceUnit: { fontSize: 11, color: C.textMuted, fontWeight: '400' },

  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 0.5 },
  pillActive: { backgroundColor: C.greenLight, borderColor: C.greenBorder },
  pillPaused: { backgroundColor: C.pillPausedBg, borderColor: C.pillPausedBorder },
  statusPillText: { fontSize: 11 },
  pillActiveText: { color: C.green },
  pillPausedText: { color: C.pillPausedText },

  cardTag: {
    backgroundColor: C.blueLight, borderWidth: 0.5, borderColor: C.blueBorder,
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5,
  },
  cardTagText: { fontSize: 11, color: C.blue },

  feeText: { fontSize: 11, color: '#EF4444' },

  subActions: { flexDirection: 'row', gap: 4, marginTop: 2 },
  actionBtn: { padding: 4 },
  actionBtnText: { fontSize: 14 },

  // FAB
  fab: {
    backgroundColor: C.blue, flex: 1,
    borderRadius: 12, paddingVertical: 14, alignItems: 'center',
  },
  fabText: { color: C.white, fontSize: 15, fontWeight: '500' },

  // 底部雙按鈕容器
  bottomButtons: {
    flexDirection: 'row', gap: 12,
    marginHorizontal: 16, marginVertical: 12,
  },

  // 快速新增按鈕
  quickAddBtn: {
    backgroundColor: C.white, borderWidth: 1, borderColor: C.blue,
    flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center',
  },
  quickAddBtnText: { color: C.blue, fontSize: 15, fontWeight: '500' },

  // 快速新增 Modal
  quickAddSheet: {
    backgroundColor: C.white, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 40, flex: 1,
  },

  // 模板列表項目
  templateItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: C.borderLight,
  },
  templateIcon: {
    width: 44, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center',
  },
  templateIconText: { fontSize: 14, fontWeight: '600' },
  templateInfo: { marginLeft: 14, flex: 1 },
  templateName: { fontSize: 15, fontWeight: '500', color: C.text },
  templatePrice: { fontSize: 13, color: C.textMuted, marginTop: 2 },

  // 支付方式 Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: C.white, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 40, flex: 1, minHeight: 400,
  },
  pmList: { maxHeight: 300, marginBottom: 8 },
  pmEmptyText: { fontSize: 13, color: C.textMuted, textAlign: 'center', paddingVertical: 20 },
  pmItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: C.borderLight,
  },
  pmItemContent: { flex: 1 },
  pmName: { fontSize: 15, fontWeight: '500', color: C.text },
  pmMeta: { fontSize: 12, color: C.textMuted },
  pmFee: { fontSize: 12, color: '#EF4444' },
  pmReward: { fontSize: 12, color: C.green },
  pmDeleteBtn: { padding: 8, marginLeft: 8, justifyContent: 'center', alignItems: 'center' },
  pmDeleteBtnText: { fontSize: 14, color: '#dc2626', fontWeight: '600' },
  pmDivider: { height: 0.5, backgroundColor: C.borderLight, marginVertical: 16 },
  pmAddTitle: { fontSize: 14, fontWeight: '500', color: C.text, marginBottom: 4 },

  // 刪除確認彈窗
  deleteModalOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', zIndex: 999,
  },
  deleteModal: {
    backgroundColor: C.white, borderRadius: 16, padding: 24,
    width: '80%', maxWidth: 320,
  },
  deleteModalTitle: {
    fontSize: 18, fontWeight: '600', color: C.text, marginBottom: 8,
  },
  deleteModalText: {
    fontSize: 14, color: C.textSub, marginBottom: 20,
  },
  deleteModalBtns: {
    flexDirection: 'row', justifyContent: 'flex-end', gap: 12,
  },
  deleteCancelBtn: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8,
    backgroundColor: C.bg,
  },
  deleteCancelText: {
    fontSize: 14, color: C.textSub, fontWeight: '500',
  },
  deleteConfirmBtn: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8,
    backgroundColor: '#dc2626',
  },
  deleteConfirmText: {
    fontSize: 14, color: C.white, fontWeight: '500',
  },

  // 表單元件（用於支付方式 Modal）
  formHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 20, paddingTop: 16,
  },
  formTitle: { fontSize: 18, fontWeight: '500', color: C.text },
  formClose: { fontSize: 20, color: C.textMuted, padding: 4 },
  formLabel: { fontSize: 13, fontWeight: '500', color: C.text, marginTop: 14, marginBottom: 7 },
  input: {
    borderWidth: 0.5, borderColor: C.border, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 11, fontSize: 15,
    backgroundColor: '#FAFAFA', color: C.text,
  },
  saveBtn: {
    backgroundColor: C.blue, borderRadius: 10, paddingVertical: 13,
    alignItems: 'center', marginTop: 20, marginBottom: 8,
  },
  saveBtnText: { color: C.white, fontSize: 15, fontWeight: '500' },
});