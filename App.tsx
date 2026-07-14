import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, Alert, Modal, ActivityIndicator, Switch } from 'react-native';
import { useState, useEffect } from 'react';
import { CURRENCY, CATEGORIES } from './constants/theme';
import { templateData } from './features/templates/templates';
import {
  getSubscriptions,
  getPaymentMethods,
  saveSubscriptions,
  savePaymentMethods,
  type Subscription,
  type PaymentMethod,
} from './services/storage';
import {
  requestNotificationPermission,
  scheduleBillingReminders,
  sendTestNotification,
} from './services/notifications';

export default function App() {
  // 載入狀態
  const [loading, setLoading] = useState(true);
  
  // 狀態管理
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  
  // 表單狀態
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [cycle, setCycle] = useState<'monthly' | 'yearly' | 'quarterly'>('monthly');
  const [nextBillingDate, setNextBillingDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethodId, setPaymentMethodId] = useState('1');
  const [bankFee, setBankFee] = useState('');
  const [category, setCategory] = useState<string>('');
  const [note, setNote] = useState('');

  // 支付方式表單
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentName, setPaymentName] = useState('');
  const [paymentBank, setPaymentBank] = useState('');
  const [paymentFee, setPaymentFee] = useState('');
  const [paymentReward, setPaymentReward] = useState('');
  const [paymentNote, setPaymentNote] = useState('');

  // 通知設定
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  // 初始化 - 載入已儲存的資料
  useEffect(() => {
    async function loadData() {
      try {
        const [savedSubscriptions, savedPaymentMethods] = await Promise.all([
          getSubscriptions(),
          getPaymentMethods(),
        ]);
        setSubscriptions(savedSubscriptions);
        setPaymentMethods(savedPaymentMethods);

        // 請求通知權限
        const hasPermission = await requestNotificationPermission();
        setNotificationsEnabled(hasPermission);

        // 如果有權限，排程所有提醒
        if (hasPermission) {
          await scheduleBillingReminders(savedSubscriptions);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // 重置表單
  const resetForm = () => {
    setName('');
    setPrice('');
    setCycle('monthly');
    setNextBillingDate(new Date().toISOString().split('T')[0]);
    setPaymentMethodId('1');
    setBankFee('');
    setCategory('');
    setNote('');
    setEditingId(null);
  };

  // 使用模板
  const useTemplate = (template: any) => {
    setName(template.name);
    setPrice(template.defaultPrice.toString());
    setCycle(template.cycle);
  };

  // 新增/更新訂閱
  const saveSubscription = async () => {
    if (!name || !price) {
      Alert.alert('請填寫完整', '請填寫訂閱名稱和價格');
      return;
    }

    const now = new Date().toISOString();
    let updatedSubscriptions: Subscription[];
    
    if (editingId) {
      // 更新現有訂閱
      updatedSubscriptions = subscriptions.map(sub => 
        sub.id === editingId 
          ? {
              ...sub,
              name,
              price: parseFloat(price),
              currency: CURRENCY,
              cycle,
              nextBillingDate,
              paymentMethodId,
              bankFee: parseFloat(bankFee) || 0,
              category,
              note,
              updatedAt: now,
            }
          : sub
      );
    } else {
      // 新增訂閱
      const newSubscription: Subscription = {
        id: Date.now().toString(),
        name,
        price: parseFloat(price),
        currency: CURRENCY,
        cycle,
        nextBillingDate,
        paymentMethodId,
        bankFee: parseFloat(bankFee) || 0,
        category,
        note,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };
      updatedSubscriptions = [...subscriptions, newSubscription];
    }

    // 更新狀態
    setSubscriptions(updatedSubscriptions);
    
    // 同步到本地儲存
    await saveSubscriptions(updatedSubscriptions);

    // 重新排程通知
    if (notificationsEnabled) {
      await scheduleBillingReminders(updatedSubscriptions);
    }

    resetForm();
    setShowForm(false);
  };

  // 編輯訂閱
  const editSubscription = (subscription: Subscription) => {
    setEditingId(subscription.id);
    setName(subscription.name);
    setPrice(subscription.price.toString());
    setCycle(subscription.cycle);
    setNextBillingDate(subscription.nextBillingDate);
    setPaymentMethodId(subscription.paymentMethodId);
    setBankFee(subscription.bankFee.toString());
    setCategory(subscription.category || '');
    setNote(subscription.note || '');
    setShowForm(true);
  };

  // 切換狀態
  const toggleStatus = async (id: string) => {
    const updatedSubscriptions = subscriptions.map(sub => 
      sub.id === id 
        ? { ...sub, status: sub.status === 'active' ? 'paused' : 'active', updatedAt: new Date().toISOString() }
        : sub
    );
    
    setSubscriptions(updatedSubscriptions);
    await saveSubscriptions(updatedSubscriptions);
    
    // 重新排程通知
    if (notificationsEnabled) {
      await scheduleBillingReminders(updatedSubscriptions);
    }
  };

  // 刪除訂閱
  const deleteSubscription = (id: string) => {
    Alert.alert(
      '確認刪除',
      '確定要刪除這個訂閱嗎？',
      [
        { text: '取消', style: 'cancel' },
        { 
          text: '刪除', 
          style: 'destructive', 
          onPress: async () => {
            const updatedSubscriptions = subscriptions.filter(sub => sub.id !== id);
            setSubscriptions(updatedSubscriptions);
            await saveSubscriptions(updatedSubscriptions);
            
            // 重新排程通知
            if (notificationsEnabled) {
              await scheduleBillingReminders(updatedSubscriptions);
            }
          }
        }
      ]
    );
  };

  // 新增支付方式
  const savePaymentMethod = async () => {
    if (!paymentName) {
      Alert.alert('請填寫完整', '請填寫支付方式名稱');
      return;
    }

    const newPaymentMethod: PaymentMethod = {
      id: Date.now().toString(),
      name: paymentName,
      bank: paymentBank || undefined,
      fee: parseFloat(paymentFee) || undefined,
      reward: paymentReward || undefined,
      note: paymentNote || undefined,
    };

    const updatedMethods = [...paymentMethods, newPaymentMethod];
    setPaymentMethods(updatedMethods);
    
    // 同步到本地儲存
    await savePaymentMethods(updatedMethods);

    setPaymentName('');
    setPaymentBank('');
    setPaymentFee('');
    setPaymentReward('');
    setPaymentNote('');
    setShowPaymentForm(false);
  };

  // 計算每月花費
  const calculateMonthlyTotal = () => {
    return subscriptions
      .filter(sub => sub.status === 'active')
      .reduce((total, sub) => {
        let monthlyPrice = sub.price;
        if (sub.cycle === 'yearly') {
          monthlyPrice = sub.price / 12;
        } else if (sub.cycle === 'quarterly') {
          monthlyPrice = sub.price / 3;
        }
        return total + monthlyPrice;
      }, 0);
  };

  // 獲取支付方式名稱
  const getPaymentMethodName = (id: string) => {
    const pm = paymentMethods.find(p => p.id === id);
    return pm ? pm.name : '未知';
  };

  const monthlyTotal = calculateMonthlyTotal();
  const activeCount = subscriptions.filter(sub => sub.status === 'active').length;

  // 載入中顯示
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
        <Text style={styles.loadingText}>載入資料中...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>訂閱管理</Text>
        <TouchableOpacity 
          style={styles.paymentBtn}
          onPress={() => setShowPaymentForm(true)}
        >
          <Text style={styles.paymentBtnText}>💳 支付方式</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { borderLeftColor: '#4A90E2' }]}>
          <Text style={styles.statTitle}>每月花費</Text>
          <Text style={[styles.statValue, { color: '#4A90E2' }]}>{CURRENCY}{monthlyTotal.toFixed(0)}</Text>
        </View>
        <View style={[styles.statCard, { borderLeftColor: '#50C878' }]}>
          <Text style={styles.statTitle}>活躍訂閱</Text>
          <Text style={[styles.statValue, { color: '#50C878' }]}>{activeCount}</Text>
        </View>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.templatesSection}>
          <Text style={styles.sectionTitle}>📋 快速新增</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.templatesScroll}>
            {templateData.map((template) => (
              <TouchableOpacity
                key={template.id}
                style={styles.templateCard}
                onPress={() => {
                  useTemplate(template);
                  setShowForm(true);
                }}
              >
                <Text style={styles.templateName} numberOfLines={1}>{template.name}</Text>
                <Text style={styles.templatePrice}>{CURRENCY}{template.defaultPrice}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📝 我的訂閱</Text>
          {subscriptions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>還沒有訂閱記錄</Text>
              <Text style={styles.emptySubtext}>點擊下方按鈕或使用上方模板新增</Text>
            </View>
          ) : (
            subscriptions.map((sub) => (
              <View key={sub.id} style={styles.subscriptionItem}>
                <View style={styles.subInfo}>
                  <View style={styles.subHeader}>
                    <Text style={styles.subName}>{sub.name}</Text>
                    {sub.category && (
                      <View style={styles.categoryBadge}>
                        <Text style={styles.categoryText}>{sub.category}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.subMeta}>
                    {sub.cycle === 'monthly' ? '月繳' : sub.cycle === 'yearly' ? '年繳' : '季繳'} • {getPaymentMethodName(sub.paymentMethodId)}
                  </Text>
                  <Text style={styles.subDate}>下次扣款: {sub.nextBillingDate}</Text>
                  {sub.note && <Text style={styles.subNote}>📝 {sub.note}</Text>}
                </View>
                <View style={styles.subRight}>
                  <Text style={styles.subPrice}>{CURRENCY}{sub.price}</Text>
                  {sub.bankFee > 0 && (
                    <Text style={styles.feeText}>手續費: {CURRENCY}{sub.bankFee}</Text>
                  )}
                  <View style={styles.actions}>
                    <TouchableOpacity 
                      style={[styles.statusBadge, { backgroundColor: sub.status === 'active' ? '#E8F5E9' : '#FFF3E0' }]}
                      onPress={() => toggleStatus(sub.id)}
                    >
                      <Text style={[styles.statusText, { color: sub.status === 'active' ? '#2E7D32' : '#EF6C00' }]}>
                        {sub.status === 'active' ? '啟用' : '暫停'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.editBtn}
                      onPress={() => editSubscription(sub)}
                    >
                      <Text style={styles.editText}>✏️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.deleteBtn}
                      onPress={() => deleteSubscription(sub.id)}
                    >
                      <Text style={styles.deleteText}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {!showForm ? (
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => setShowForm(true)}
        >
          <Text style={styles.addButtonText}>➕ 新增訂閱</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.form}>
          <ScrollView>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>{editingId ? '編輯訂閱' : '新增訂閱'}</Text>
              <TouchableOpacity onPress={() => { resetForm(); setShowForm(false); }}>
                <Text style={styles.cancelText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>訂閱名稱</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="例如：Netflix"
            />

            <Text style={styles.label}>價格</Text>
            <TextInput
              style={styles.input}
              value={price}
              onChangeText={setPrice}
              placeholder="0"
              keyboardType="numeric"
            />

            <Text style={styles.label}>週期</Text>
            <View style={styles.cycleContainer}>
              {(['monthly', 'quarterly', 'yearly'] as const).map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.cycleBtn, cycle === c && styles.cycleBtnActive]}
                  onPress={() => setCycle(c)}
                >
                  <Text style={[styles.cycleText, cycle === c && styles.cycleTextActive]}>
                    {c === 'monthly' ? '月繳' : c === 'yearly' ? '年繳' : '季繳'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>下次扣款日期</Text>
            <TextInput
              style={styles.input}
              value={nextBillingDate}
              onChangeText={setNextBillingDate}
              placeholder="YYYY-MM-DD"
            />

            <Text style={styles.label}>支付方式</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.paymentScroll}>
              {paymentMethods.map((pm) => (
                <TouchableOpacity
                  key={pm.id}
                  style={[styles.paymentOption, paymentMethodId === pm.id && styles.paymentOptionActive]}
                  onPress={() => setPaymentMethodId(pm.id)}
                >
                  <Text style={[styles.paymentOptionText, paymentMethodId === pm.id && styles.paymentOptionTextActive]}>
                    {pm.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>銀行手續費（選填）</Text>
            <TextInput
              style={styles.input}
              value={bankFee}
              onChangeText={setBankFee}
              placeholder="0"
              keyboardType="numeric"
            />

            <Text style={styles.label}>分類（選填）</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryOption, category === cat && styles.categoryOptionActive]}
                  onPress={() => setCategory(cat)}
                >
                  <Text style={[styles.categoryOptionText, category === cat && styles.categoryOptionTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>備註（選填）</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={note}
              onChangeText={setNote}
              placeholder="添加備註..."
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity style={styles.saveBtn} onPress={saveSubscription}>
              <Text style={styles.saveBtnText}>{editingId ? '更新' : '儲存'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {/* 支付方式 Modal */}
      <Modal
        visible={showPaymentForm}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>支付方式</Text>
              <TouchableOpacity onPress={() => setShowPaymentForm(false)}>
                <Text style={styles.cancelText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.paymentList}>
              {paymentMethods.map((pm) => (
                <View key={pm.id} style={styles.paymentListItem}>
                  <Text style={styles.paymentListName}>{pm.name}</Text>
                  {pm.bank && <Text style={styles.paymentListMeta}>{pm.bank}</Text>}
                </View>
              ))}
            </ScrollView>

            <Text style={styles.label}>新增支付方式</Text>
            <TextInput
              style={styles.input}
              value={paymentName}
              onChangeText={setPaymentName}
              placeholder="支付方式名稱"
            />
            <Text style={styles.label}>銀行（選填）</Text>
            <TextInput
              style={styles.input}
              value={paymentBank}
              onChangeText={setPaymentBank}
              placeholder="例如：國泰世華"
            />
            <Text style={styles.label}>手續費%（選填）</Text>
            <TextInput
              style={styles.input}
              value={paymentFee}
              onChangeText={setPaymentFee}
              placeholder="1.5"
              keyboardType="numeric"
            />
            <Text style={styles.label}>回饋（選填）</Text>
            <TextInput
              style={styles.input}
              value={paymentReward}
              onChangeText={setPaymentReward}
              placeholder="例如：1% 現金回饋"
            />

            <TouchableOpacity style={styles.saveBtn} onPress={savePaymentMethod}>
              <Text style={styles.saveBtnText}>新增支付方式</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#061b31',
  },
  paymentBtn: {
    backgroundColor: '#fafafa',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  paymentBtnText: {
    color: '#0075de',
    fontSize: 14,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fafafa',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  statsRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 18,
    elevation: 0,
  },
  statTitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#061b31',
    marginBottom: 12,
  },
  templatesSection: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  templatesScroll: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  templateCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    alignItems: 'center',
    minWidth: 100,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 18,
    elevation: 0,
  },
  templateName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#061b31',
    marginBottom: 4,
  },
  templatePrice: {
    fontSize: 12,
    color: '#0075de',
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
  },
  subscriptionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 18,
    elevation: 0,
  },
  subInfo: {
    flex: 1,
    marginRight: 12,
  },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  subName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#061b31',
  },
  categoryBadge: {
    backgroundColor: '#fafafa',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 11,
    color: '#0075de',
    fontWeight: '500',
  },
  subMeta: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  subDate: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  subNote: {
    fontSize: 12,
    color: '#888',
  },
  subRight: {
    alignItems: 'flex-end',
  },
  subPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0075de',
    marginBottom: 8,
  },
  feeText: {
    fontSize: 11,
    color: '#FF6B6B',
    marginBottom: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
  },
  editBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  editText: {
    fontSize: 14,
  },
  deleteBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  deleteText: {
    fontSize: 14,
  },
  addButton: {
    backgroundColor: '#0075de',
    paddingVertical: 16,
    margin: 16,
    borderRadius: 4,
    alignItems: 'center',
    shadowColor: '#0075de',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  form: {
    backgroundColor: '#fff',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
    maxHeight: '70%',
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#061b31',
  },
  cancelText: {
    fontSize: 20,
    color: '#999',
    padding: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#061b31',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  cycleContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  cycleBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    borderRadius: 4,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#fafafa',
  },
  cycleBtnActive: {
    borderColor: '#0075de',
    backgroundColor: '#E3F2FD',
  },
  cycleText: {
    fontSize: 14,
    color: '#666',
  },
  cycleTextActive: {
    color: '#0075de',
    fontWeight: '500',
  },
  paymentScroll: {
    flexDirection: 'row',
  },
  paymentOption: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: '#fafafa',
  },
  paymentOptionActive: {
    borderColor: '#0075de',
    backgroundColor: '#E3F2FD',
  },
  paymentOptionText: {
    fontSize: 14,
    color: '#666',
  },
  paymentOptionTextActive: {
    color: '#0075de',
    fontWeight: '500',
  },
  categoryScroll: {
    flexDirection: 'row',
  },
  categoryOption: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: '#fafafa',
  },
  categoryOptionActive: {
    borderColor: '#50C878',
    backgroundColor: '#E8F5E9',
  },
  categoryOptionText: {
    fontSize: 14,
    color: '#666',
  },
  categoryOptionTextActive: {
    color: '#2E7D32',
    fontWeight: '500',
  },
  saveBtn: {
    backgroundColor: '#0075de',
    paddingVertical: 14,
    borderRadius: 4,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  paymentList: {
    maxHeight: 150,
    marginBottom: 16,
  },
  paymentListItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  paymentListName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#061b31',
  },
  paymentListMeta: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },
});
