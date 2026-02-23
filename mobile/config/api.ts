// API設定
// 環境変数から取得、なければデフォルト値を使用
// 開発環境: ローカルサーバー (http://localhost:8000 または http://10.0.2.2:8000 for Android emulator)
// 本番環境: Azure App Service URL

import Constants from 'expo-constants';
import { Platform } from 'react-native';

const getApiBaseUrl = (): string => {
  // 環境変数から取得（Expo Constants経由）
  let envApiUrl = Constants.expoConfig?.extra?.apiUrl || Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL;

  if (envApiUrl) {
    // Android エミュレータ: localhost を 10.0.2.2 に置換（ホストPCへのアクセス用）
    if (Platform.OS === 'android' && (envApiUrl.includes('localhost') || envApiUrl.includes('127.0.0.1'))) {
      envApiUrl = envApiUrl.replace(/localhost|127\.0\.0\.1/g, '10.0.2.2');
    }
    return envApiUrl;
  }

  // 本番環境: Azure App Service URL
  return "https://stockspace-api-01-hgf2e5hxemcwckef.japaneast-01.azurewebsites.net";
};

export const API_BASE_URL = getApiBaseUrl();

/** APIが返す相対URL（/uploads/...）を絶対URLに変換。プロフィール・投稿画像の表示に必須。 */
export function getAbsoluteImageUrl(url: string | null | undefined): string | undefined {
  if (!url || !url.trim()) return undefined;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const base = API_BASE_URL.replace(/\/$/, "");
  return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
}

// API接続テスト用の関数
export const testApiConnection = async (): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000), // 10秒タイムアウト
    });

    if (response.ok) {
      return { success: true, message: 'API接続成功' };
    } else {
      return { 
        success: false, 
        message: `API接続エラー: HTTP ${response.status}` 
      };
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError' || error.message.includes('timeout')) {
        return { 
          success: false, 
          message: 'API接続タイムアウト。サーバーが応答していません。' 
        };
      }
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        return { 
          success: false, 
          message: 'ネットワークエラー。インターネット接続を確認してください。' 
        };
      }
      return { 
        success: false, 
        message: `接続エラー: ${error.message}` 
      };
    }
    return { 
      success: false, 
      message: '不明なエラーが発生しました' 
    };
  }
};


