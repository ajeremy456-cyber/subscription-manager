
# Subscription Manager - 訂閱管理工具

一個使用 Expo React Native 開發的訂閱管理應用，幫助你追蹤和管理所有的訂閱服務。

## 功能特色

- 訂閱管理：新增、編輯、刪除訂閱
- 支付方式管理：管理你的信用卡、行動支付等支付方式
- 訂閱模板：內建常用訂閱服務模板
- 數據持久化：本地存儲，數據不丟失
- 幣別支援：預設使用新台幣 (NT$)

## 技術棧

- **框架**: Expo 57 + React Native 0.86
- **狀態管理**: Zustand
- **數據存儲**: AsyncStorage
- **語言**: TypeScript
- **日期處理**: date-fns

## 安裝與執行

### 前置需求

- Node.js (建議版本 18 或以上)
- npm 或 yarn

### 安裝步驟

1. 安裝相依套件：
```powershell
npm install
```

### 執行應用

選擇以下任一方式啟動：

#### 1. 啟動開發伺服器
```powershell
npm start
```

#### 2. 在 Android 模擬器/裝置上執行
```powershell
npm run android
```

#### 3. 在 iOS 模擬器/裝置上執行 (僅限 macOS)
```powershell
npm run ios
```

#### 4. 在網頁瀏覽器上執行
```powershell
npm run web
```

## 專案結構

```
subscription-manager/
├── assets/              # 靜態資源 (圖示、圖片)
├── components/          # 可複用元件
├── constants/           # 常數設定 (主題、幣別等)
├── features/            # 功能模組
│   └── templates/       # 訂閱模板
├── services/            # 服務層 (StorageService)
├── store/               # Zustand 狀態管理
├── types/               # TypeScript 型別定義
├── App.tsx              # 應用進入點
├── app.json             # Expo 設定
└── package.json         # 專案設定
```

## 核心功能說明

### 訂閱管理 ([Subscription](file:///c:/Users/Liao/subscription-manager/types/index.ts#L1-L17))

可以記錄以下資訊：
- 訂閱名稱
- 價格與幣別
- 週期 (月繳/年繳/季繳)
- 下次扣款日期
- 支付方式
- 銀行手續費
- 分類與備註

### 支付方式管理 ([PaymentMethod](file:///c:/Users/Liao/subscription-manager/types/index.ts#L19-L26))

管理你的支付工具：
- 卡片名稱 (如：國泰 CUBE、LINE Pay)
- 發卡銀行
- 手續費率
- 回饋資訊

### 訂閱模板 ([Template](file:///c:/Users/Liao/subscription-manager/types/index.ts#L28-L35))

內建常用訂閱服務模板，快速新增訂閱。

## 狀態管理

使用 [useSubscriptionStore](file:///c:/Users/Liao/subscription-manager/store/subscriptionStore.ts#L42-L139) 管理全域狀態，包含：
- `addSubscription` - 新增訂閱
- `updateSubscription` - 更新訂閱
- `deleteSubscription` - 刪除訂閱
- `toggleSubscriptionStatus` - 切換訂閱狀態 (啟用/暫停)
- `addPaymentMethod` - 新增支付方式
- `updatePaymentMethod` - 更新支付方式
- `deletePaymentMethod` - 刪除支付方式

## 自訂設定

### 變更幣別

編輯 [constants/theme.ts](file:///c:/Users/Liao/subscription-manager/constants/theme.ts)：
```typescript
export const CURRENCY = 'NT$'; // 變更為你想要的幣別
```

## 開發說明

- Expo 文件：https://docs.expo.dev/versions/v57.0.0/
- 程式碼變更後會自動熱重載
- 數據會透過 AsyncStorage 持久化保存

## 授權

請參閱 [LICENSE](file:///c:/Users/Liao/subscription-manager/LICENSE) 檔案。

