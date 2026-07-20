import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  TextInput, Alert,
} from 'react-native';
import { useState, useEffect } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { CURRENCY, CATEGORIES } from '../constants/theme';
import { VIP_CONFIG } from '../constants/version';
import type { Subscription, PaymentMethod } from '../services/storage';
import { getPaymentMethods } from '../services/storage';

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
};

// ─── 路由參數類型 ────────────────────────────────────────────
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

type AddSubscriptionRouteProp = RouteProp<RootStackParamList, 'AddSubscription'>;

// ─── 週期標籤 ────────────────────────────────────────────────
function cycleLabel(cycle: 'monthly' | 'quarterly' | 'yearly'): string {
  const map = { monthly: '月繳', quarterly: '季繳', yearly: '年繳' };
  return map[cycle];
}

export default function AddSubscriptionScreen() {
  const navigation = useNavigation();
  const route = useRoute<AddSubscriptionRouteProp>();
  const params = route.params || {};

  // 編輯模式
  const editingId = params.editingId;
  const isEditMode = !!editingId;

  // 快速新增模式（從模板）
  const templateName = params.templateName;
  const templatePrice = params.templatePrice;
  const templateCycle = params.templateCycle;

  // VIP 狀態
  const subscriptionCount = params.subscriptionCount ?? 0;
  const isVIP = params.isVIP ?? false;

  // ─── 表單狀態 ───────────────────────────────────────────────
  const [name, setName] = useState(params.editData?.name ?? templateName ?? '');
  const [price, setPrice] = useState(
    params.editData?.price?.toString() ?? templatePrice?.toString() ?? ''
  );
  const [cycle, setCycle] = useState<'monthly' | 'quarterly' | 'yearly'>(
    params.editData?.cycle ?? templateCycle ?? 'monthly'
  );
  const [nextBillingDate, setNextBillingDate] = useState(
    params.editData?.nextBillingDate ?? new Date().toISOString().split('T')[0]
  );
  const [paymentMethodId, setPaymentMethodId] = useState(
    params.editData?.paymentMethodId ?? '1'
  );
  const [bankFee, setBankFee] = useState(
    params.editData?.bankFee?.toString() ?? ''
  );
  const [category, setCategory] = useState(params.editData?.category ?? '');
  const [note, setNote] = useState(params.editData?.note ?? '');
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  // ─── 載入支付方式 ─────────────────────────────────────────────
  useEffect(() => {
    async function loadPaymentMethods() {
      const methods = await getPaymentMethods();
      setPaymentMethods(methods);
    }
    loadPaymentMethods();
  }, []);

  // ─── 小型 Label 元件 ──────────────────────────────────────────
  function FormLabel({ children }: { children: string }) {
    return <Text style={s.formLabel}>{children}</Text>;
  }

  // ─── 儲存 ─────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!name || !price) {
      Alert.alert('請填寫完整', '請填寫訂閱名稱和價格');
      return;
    }

    const now = new Date().toISOString();
    const subData: Subscription = {
      id: editingId ?? Date.now().toString(),
      name,
      price: parseFloat(price),
      currency: CURRENCY,
      cycle,
      nextBillingDate,
      paymentMethodId,
      bankFee: parseFloat(bankFee) || 0,
      category,
      note,
      status: params.editData?.status ?? 'active',
      createdAt: params.editData?.createdAt ?? now,
      updatedAt: now,
    };

    // 直接保存到 storage
    const { saveSubscriptions, getSubscriptions } = await import('../services/storage');
    const currentSubs = await getSubscriptions();
    
    let updated: Subscription[];
    if (isEditMode) {
      updated = currentSubs.map(sub => sub.id === subData.id ? subData : sub);
    } else {
      updated = [...currentSubs, subData];
    }
    
    await saveSubscriptions(updated);
    
    // 返回首頁
    navigation.goBack();
  };

  return (
    <View style={s.container}>
      <StatusBar style="dark" />

      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backBtnText}>{'<'} 返回</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>
          {isEditMode ? '編輯訂閱' : (templateName ? '快速新增' : '新增訂閱')}
        </Text>
        <View style={s.headerRight} />
      </View>

      {/* ── 表單 ── */}
      <ScrollView style={s.form} showsVerticalScrollIndicator={false}>
        <FormLabel>訂閱名稱</FormLabel>
        <TextInput
          style={s.input}
          value={name}
          onChangeText={setName}
          placeholder="例如：Netflix"
          placeholderTextColor={C.textMuted}
        />

        <FormLabel>價格（{CURRENCY}）</FormLabel>
        <TextInput
          style={s.input}
          value={price}
          onChangeText={setPrice}
          placeholder="0"
          keyboardType="numeric"
          placeholderTextColor={C.textMuted}
        />

        <FormLabel>扣款週期</FormLabel>
        <View style={s.cycleRow}>
          {(['monthly', 'quarterly', 'yearly'] as const).map((c) => (
            <TouchableOpacity
              key={c}
              style={[s.cycleBtn, cycle === c && s.cycleBtnActive]}
              onPress={() => setCycle(c)}
            >
              <Text style={[s.cycleBtnText, cycle === c && s.cycleBtnTextActive]}>
                {cycleLabel(c)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <FormLabel>下次扣款日期</FormLabel>
        <TextInput
          style={s.input}
          value={nextBillingDate}
          onChangeText={setNextBillingDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={C.textMuted}
        />

        <FormLabel>支付方式</FormLabel>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll}>
          {paymentMethods.map((pm) => (
            <TouchableOpacity
              key={pm.id}
              style={[s.chip, paymentMethodId === pm.id && s.chipActive]}
              onPress={() => setPaymentMethodId(pm.id)}
            >
              <Text style={[s.chipText, paymentMethodId === pm.id && s.chipTextActive]}>
                {pm.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <FormLabel>分類（選填）</FormLabel>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[s.chip, category === cat && s.chipActive]}
              onPress={() => setCategory(category === cat ? '' : cat)}
            >
              <Text style={[s.chipText, category === cat && s.chipTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <FormLabel>銀行手續費（選填，{CURRENCY}）</FormLabel>
        <TextInput
          style={s.input}
          value={bankFee}
          onChangeText={setBankFee}
          placeholder="0"
          keyboardType="numeric"
          placeholderTextColor={C.textMuted}
        />

        <FormLabel>備註（選填）</FormLabel>
        <TextInput
          style={[s.input, s.inputTextArea]}
          value={note}
          onChangeText={setNote}
          placeholder="例如：家庭方案 / 合租備注..."
          multiline
          numberOfLines={3}
          placeholderTextColor={C.textMuted}
        />

        <TouchableOpacity style={s.saveBtn} onPress={handleSave}>
          <Text style={s.saveBtnText}>{isEditMode ? '更新訂閱' : '儲存訂閱'}</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ─── 樣式 ─────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
    backgroundColor: C.white,
    borderBottomWidth: 0.5,
    borderBottomColor: C.borderLight,
  },
  backBtn: { padding: 4 },
  backBtnText: { fontSize: 16, color: C.blue },
  headerTitle: { fontSize: 18, fontWeight: '600', color: C.text },
  headerRight: { width: 60 },
  form: { flex: 1, paddingHorizontal: 20, paddingTop: 24 },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: C.textSub,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: C.text,
  },
  inputTextArea: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  cycleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cycleBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    backgroundColor: C.white,
  },
  cycleBtnActive: {
    backgroundColor: C.blue,
    borderColor: C.blue,
  },
  cycleBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: C.textSub,
  },
  cycleBtnTextActive: {
    color: C.white,
  },
  chipScroll: { marginTop: -4 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.white,
    marginRight: 8,
    marginBottom: 12,
  },
  chipActive: {
    backgroundColor: C.blueLight,
    borderColor: C.blueBorder,
  },
  chipText: {
    fontSize: 13,
    color: C.textSub,
  },
  chipTextActive: {
    color: C.blue,
    fontWeight: '500',
  },
  saveBtn: {
    backgroundColor: C.blue,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: C.white,
  },
});