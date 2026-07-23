import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VIP_CONFIG } from '../constants/version';

interface AdBannerProps {
  onUpgradePress: () => void;
}

export default function AdBanner({ onUpgradePress }: AdBannerProps) {
  return (
    <View style={styles.container}>
      <View style={styles.adContent}>
        <View style={styles.adIcon}>
          <Ionicons name="star" size={16} color="#FFD700" />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title}>解鎖完整功能</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.upgradeBtn} onPress={onUpgradePress}>
        <Text style={styles.upgradeBtnText}>升級 NT$ {VIP_CONFIG.VIP_PRICE}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF3C7',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#FDE68A',
  },
  adContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  adIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFBEB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
  },
  subtitle: {
    fontSize: 12,
    color: '#B45309',
    marginTop: 2,
  },
  upgradeBtn: {
    backgroundColor: '#FFD700',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  upgradeBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#78350F',
  },
});