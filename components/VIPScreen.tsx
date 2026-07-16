import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VIP_CONFIG } from '../constants/version';

interface VIPScreenProps {
  visible: boolean;
  onClose: () => void;
  onPurchase: () => void;
  onRestore: () => void;
}

export default function VIPScreen({ visible, onClose, onPurchase, onRestore }: VIPScreenProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* 關閉按鈕 */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>

          {/* VIP 標誌 */}
          <View style={styles.vipBadge}>
            <Ionicons name="star" size={32} color="#FFD700" />
          </View>

          {/* 標題 */}
          <Text style={styles.title}>升級 VIP</Text>
          <Text style={styles.subtitle}>解鎖完整功能</Text>

          {/* 功能列表 */}
          <View style={styles.featureList}>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color="#059669" />
              <Text style={styles.featureText}>無訂閱數量限制</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color="#059669" />
              <Text style={styles.featureText}>移除所有廣告</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color="#059669" />
              <Text style={styles.featureText}>進階通知提醒</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color="#059669" />
              <Text style={styles.featureText}>雲端備份功能</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color="#059669" />
              <Text style={styles.featureText}>未來更多功能</Text>
            </View>
          </View>

          {/* 價格 */}
          <View style={styles.priceContainer}>
            <Text style={styles.priceLabel}>一次買斷</Text>
            <Text style={styles.price}>NT$ {VIP_CONFIG.VIP_PRICE}</Text>
          </View>

          {/* 購買按鈕 */}
          <TouchableOpacity style={styles.purchaseBtn} onPress={onPurchase}>
            <Text style={styles.purchaseBtnText}>立即解鎖 VIP</Text>
          </TouchableOpacity>

          {/* 恢復購買 */}
          <TouchableOpacity style={styles.restoreBtn} onPress={onRestore}>
            <Text style={styles.restoreBtnText}>恢復購買</Text>
          </TouchableOpacity>

          {/* 說明 */}
          <Text style={styles.note}>
            購買後可永久使用完整功能{'\n'}
            如有問題請聯繫客服
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 8,
  },
  vipBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF8DC',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A202C',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
  },
  featureList: {
    width: '100%',
    marginBottom: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureText: {
    marginLeft: 10,
    fontSize: 15,
    color: '#333',
  },
  priceContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  priceLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  price: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A202C',
  },
  purchaseBtn: {
    backgroundColor: '#FFD700',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  purchaseBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A202C',
  },
  restoreBtn: {
    paddingVertical: 8,
    marginBottom: 16,
  },
  restoreBtnText: {
    fontSize: 14,
    color: '#2563EB',
  },
  note: {
    fontSize: 11,
    color: '#999',
    textAlign: 'center',
    lineHeight: 16,
  },
});