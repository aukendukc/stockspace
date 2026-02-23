import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { API_BASE_URL, testApiConnection } from '../config/api';
import { STORAGE_KEYS } from '../constants/storageKeys';

export interface ApiError {
  detail: string;
}

export interface UserResponse {
  id: number;
  name: string;
  handle: string;
  username: string;
  email: string;
  bio?: string | null;
  icon_url?: string | null;
  created_at: string;
  is_active: boolean;
}

export interface StockRankingEntry {
  symbol: string;
  name: string;
  price: number;
  change: number;
  change_pct: number;
}

export interface StockRankingResponse {
  updated_at: string;
  top_gainers: StockRankingEntry[];
  top_losers: StockRankingEntry[];
}

export interface StockListedInfo {
  symbol: string;
  name: string;
  market?: string | null;
}

// DM関連の型定義
export interface DirectMessageResponse {
  id: number;
  conversation_id: number;
  sender_id: number;
  sender: UserResponse;
  text: string;
  is_read: boolean;
  created_at: string;
}

export interface ConversationResponse {
  id: number;
  other_user: UserResponse;
  last_message: DirectMessageResponse | null;
  unread_count: number;
  created_at: string;
  updated_at: string | null;
}

export interface ConversationDetailResponse {
  id: number;
  other_user: UserResponse;
  messages: DirectMessageResponse[];
  created_at: string;
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;
  private initPromise: Promise<void>;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.initPromise = this.initialize();
  }

  private async initialize() {
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.authToken);
      if (token) {
        this.token = token;
      }
    } catch (error) {
      console.error('Failed to restore token:', error);
    }
  }

  private async ensureInitialized() {
    await this.initPromise;
  }

  private mergeHeaders(headers?: HeadersInit): Record<string, string> {
    if (!headers) {
      return {};
    }
    if (headers instanceof Headers) {
      const record: Record<string, string> = {};
      headers.forEach((value, key) => {
        record[key] = value;
      });
      return record;
    }
    if (Array.isArray(headers)) {
      return headers.reduce<Record<string, string>>((acc, [key, value]) => {
        acc[key] = value;
        return acc;
      }, {});
    }
    return { ...headers };
  }

  private getMimeTypeFromUri(uri: string) {
    const extension = uri.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'gif':
        return 'image/gif';
      case 'webp':
        return 'image/webp';
      default:
        return 'image/jpeg';
    }
  }

  private resolveUrl(path: string) {
    if (path.startsWith('http')) {
      return path;
    }
    return `${this.baseUrl}${path}`;
  }

  async setToken(token: string | null) {
    this.token = token;
    if (token) {
      await AsyncStorage.setItem(STORAGE_KEYS.authToken, token);
    } else {
      await AsyncStorage.removeItem(STORAGE_KEYS.authToken);
    }
    this.initPromise = Promise.resolve();
  }

  /** 認証必須APIの前に呼ぶ。Firebaseの有効なトークンを取得してセットする。 */
  async refreshAuthToken(): Promise<boolean> {
    try {
      const { getIdToken } = await import("../lib/firebase");
      const fresh = await getIdToken(true);
      if (fresh) {
        await this.setToken(fresh);
        return true;
      }
    } catch (_) {}
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.authToken);
      if (stored) {
        this.token = stored;
        return true;
      }
    } catch (_) {}
    return false;
  }

  async logout() {
    try {
      const { signOut } = await import("../lib/firebase");
      await signOut();
    } catch {
      // Firebase未使用時は無視
    }
    try {
      const m = await import("@react-native-google-signin/google-signin");
      if (m?.GoogleSignin?.signOut) await m.GoogleSignin.signOut();
    } catch {
      // Expo Goなど未使用時は無視
    }
    await this.setToken(null);
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    await this.ensureInitialized();
    // 認証が必要なリクエストでトークンがメモリに無い場合は AsyncStorage から再取得
    if (!this.token) {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEYS.authToken);
        if (stored) this.token = stored;
      } catch (_) {}
    }
    const url = this.resolveUrl(endpoint);
    const isFormData =
      typeof FormData !== "undefined" && options.body instanceof FormData;
    const headers = this.mergeHeaders(options.headers);

    if (!isFormData && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    try {
      // タイムアウト設定（60秒・Azureコールドスタート対策）
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 401) {
          await this.setToken(null);
        }
        
        // 503エラーの場合、サーバーがダウンしている可能性が高い
        if (response.status === 503 || response.status === 502 || response.status === 504) {
          throw new Error("サーバーに接続できません。しばらく待ってから再度お試しください。");
        }

        const text = await response.text();
        let message = "";
        try {
          const error = text ? JSON.parse(text) : {};
          const rawDetail = error?.detail;
          message =
            typeof rawDetail === "string"
              ? rawDetail
              : Array.isArray(rawDetail) && rawDetail.length > 0
                ? rawDetail.map((e: any) => e?.msg ?? JSON.stringify(e)).join(", ")
                : "";
        } catch {
          message = text?.trim().startsWith("<")
            ? "サーバーがHTMLを返しました(500)。Azureのログを確認してください。"
            : `HTTP ${response.status}: ${text?.slice(0, 80) || response.statusText}`;
        }
        const fallback =
          response.status === 500
            ? "サーバーエラーが発生しました。しばらくしてからお試しください。"
            : "API request failed";
        const finalMessage = message && message.trim() ? message : fallback;
        const err = new Error(finalMessage) as Error & { responseBody?: string; status?: number };
        err.status = response.status;
        err.responseBody = text?.slice(0, 500) ?? "";
        throw err;
      }

      if (response.status === 204) {
        return undefined as T;
      }

      const text = await response.text();
      if (!text) {
        return undefined as T;
      }
      return JSON.parse(text) as T;
    } catch (error) {
      if (error instanceof Error) {
        // タイムアウトエラーの場合
        if (error.name === "AbortError" || error.message.includes("timeout")) {
          throw new Error(`サーバーへの接続がタイムアウトしました。\nAPI URL: ${url}\nネットワーク接続を確認してください。`);
        }
        // ネットワークエラーの場合
        if (error.message.includes("Failed to fetch") || error.message.includes("NetworkError") || error.message.includes("Network request failed")) {
          throw new Error(`ネットワークエラーが発生しました。\nAPI URL: ${url}\nインターネット接続を確認してください。`);
        }
        // DNS解決エラーの場合
        if (error.message.includes("getaddrinfo") || error.message.includes("ENOTFOUND")) {
          throw new Error(`APIサーバーに接続できません。\nURL: ${url}\nサーバーが起動しているか確認してください。`);
        }
        throw error;
      }
      throw new Error("ネットワークエラーが発生しました");
    }
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "GET" });
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "DELETE" });
  }

  // 認証関連（Firebase Auth）
  async register(data: {
    email: string;
    name: string;
    handle: string;
    password: string;
    bio?: string;
  }) {
    console.log("[API] register() 開始:", { email: data.email, handle: data.handle });
    
    const { isFirebaseConfigured, signUpWithEmail, getIdToken } = await import("../lib/firebase");
    
    if (!isFirebaseConfigured) {
      console.error("[API] Firebase設定エラー");
      throw new Error("Firebase is not configured");
    }

    try {
      // Firebase Authでユーザー作成
      console.log("[API] Firebase Auth でユーザー作成中...");
      const firebaseUser = await signUpWithEmail(data.email, data.password);
      console.log("[API] Firebase Auth 成功:", firebaseUser.uid);
      
      // Firebase ID トークンを取得
      console.log("[API] Firebase トークン取得中...");
      const firebaseToken = await getIdToken(true);
      if (!firebaseToken) {
        console.error("[API] トークン取得失敗");
        throw new Error("Failed to get Firebase token");
      }
      console.log("[API] Firebase トークン取得成功");

      // トークンを保存
      await this.setToken(firebaseToken);
      console.log("[API] トークン保存完了");

      // バックエンドにユーザー情報を同期
      const handleVal = data.handle.startsWith("@") ? data.handle : `@${data.handle}`;
      console.log("[API] バックエンドに同期中...", { handle: handleVal });
      
      const response = await this.post<UserResponse>("/auth/firebase-register", {
        name: data.name,
        handle: handleVal,
        bio: data.bio || "",
      });
      
      console.log("[API] バックエンド同期成功:", response);
      return response;
    } catch (err: any) {
      console.error("[API] register() エラー:", err);
      console.error("[API] エラーコード:", err?.code);
      console.error("[API] エラーメッセージ:", err?.message);
      
      const msg = err instanceof Error ? err.message : "";
      const code = err?.code || "";
      
      if (code.includes("email-already-in-use") || msg.includes("email-already-in-use")) {
        throw new Error("このメールアドレスは既に登録されています");
      }
      if (code.includes("weak-password") || msg.includes("weak-password")) {
        throw new Error("パスワードは6文字以上にしてください");
      }
      if (code.includes("invalid-email") || msg.includes("invalid-email")) {
        throw new Error("無効なメールアドレスです");
      }
      if (code.includes("operation-not-allowed") || msg.includes("operation-not-allowed")) {
        throw new Error("auth/operation-not-allowed: Firebase ConsoleでEmail/Password認証を有効化してください");
      }
      if (msg.includes("接続") || msg.includes("ネットワーク") || msg.includes("API") || msg.includes("HTTP")) {
        throw new Error("サーバーに接続できません。ネットワークとAPIのURLを確認してください。\n\n" + msg);
      }
      if (!msg || msg === "API request failed") {
        throw new Error("登録に失敗しました。しばらく経ってからお試しください。");
      }
      throw err;
    }
  }

  /** Expo Go 用: Google ID Token を直接渡して Firebase ログイン＋バックエンド同期 */
  async loginWithGoogleIdToken(idToken: string): Promise<void> {
    const { signInWithGoogleIdToken, isFirebaseConfigured } = await import("../lib/firebase");
    if (!isFirebaseConfigured) {
      throw new Error("Firebase is not configured.");
    }
    await signInWithGoogleIdToken(idToken);
    const { getIdToken } = await import("../lib/firebase");
    const firebaseToken = await getIdToken(true);
    if (!firebaseToken) {
      throw new Error("Failed to get Firebase token");
    }
    await this.setToken(firebaseToken);
    await this.syncFirebaseUser(firebaseToken);
  }

  /** 開発ビルドではネイティブ、Expo Go ではブラウザ認証にフォールバック */
  async loginWithGoogle(): Promise<void> {
    const { isFirebaseConfigured, signInWithGoogleIdToken, GOOGLE_WEB_CLIENT_ID } =
      await import("../lib/firebase");
    if (!isFirebaseConfigured) {
      throw new Error("Firebase is not configured. Google login requires Firebase.");
    }

    try {
      const googleSignInModule = await import("@react-native-google-signin/google-signin");
      const GoogleSignin = googleSignInModule?.GoogleSignin;
      if (!GoogleSignin || typeof GoogleSignin.configure !== "function") {
        throw new Error("USE_EXPO_GO_GOOGLE");
      }
      GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });

      const res = await GoogleSignin.signIn();
      if (res.type === "cancelled" || !res.data) {
        throw new Error("Login was cancelled");
      }
      const tokens = await GoogleSignin.getTokens();
      const idToken = tokens.idToken ?? res.data.idToken;
      if (!idToken) {
        throw new Error("Could not get Google ID token");
      }
      await signInWithGoogleIdToken(idToken);

      const { getIdToken } = await import("../lib/firebase");
      const firebaseToken = await getIdToken(true);
      if (!firebaseToken) {
        throw new Error("Failed to get Firebase token");
      }

      await this.setToken(firebaseToken);
      await this.syncFirebaseUser(firebaseToken);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "USE_EXPO_GO_GOOGLE" || msg.includes("expo") || msg.includes("native") || msg.includes("development")) {
        throw new Error("USE_EXPO_GO_GOOGLE");
      }
      throw err;
    }
  }

  async login(email: string, password: string) {
    const { isFirebaseConfigured, signInWithEmail, getIdToken } = await import("../lib/firebase");
    
    if (!isFirebaseConfigured) {
      throw new Error("Firebase is not configured");
    }

    try {
      // Firebase Authでログイン
      await signInWithEmail(email, password);
      
      // Firebase ID トークンを取得
      const firebaseToken = await getIdToken(true);
      if (!firebaseToken) {
        throw new Error("Failed to get Firebase token");
      }

      // トークンを保存
      await this.setToken(firebaseToken);

      // バックエンドにユーザー情報を同期
      await this.syncFirebaseUser(firebaseToken);

      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      const code = (err as { code?: string })?.code ?? "";
      // Firebase Auth 400: メール/パスワード不一致 or 未登録
      if (
        code.startsWith("auth/") &&
        (code === "auth/invalid-credential" || code === "auth/user-not-found" || code === "auth/wrong-password")
      ) {
        throw new Error("INVALID_CREDENTIALS: メールアドレスまたはパスワードが正しくありません。未登録の場合は「新規登録」から作成してください。");
      }
      if (msg.includes("user-not-found") || msg.includes("wrong-password") || msg.includes("invalid-credential") || msg.includes("INVALID_LOGIN_CREDENTIALS")) {
        throw new Error("INVALID_CREDENTIALS: メールアドレスまたはパスワードが正しくありません。未登録の場合は「新規登録」から作成してください。");
      }
      if (msg.includes("invalid-email") || code === "auth/invalid-email") {
        throw new Error("無効なメールアドレスです");
      }
      if (msg.includes("too-many-requests") || code === "auth/too-many-requests") {
        throw new Error("ログイン試行回数が多すぎます。しばらく待ってから再度お試しください");
      }
      if (msg.includes("ユーザー同期に失敗") || msg.includes("同期に失敗")) {
        throw new Error("ログインはできましたがサーバーとの同期に失敗しました。ネットワークを確認してもう一度お試しください。");
      }
      throw err;
    }
  }

  private async syncFirebaseUser(firebaseToken: string) {
    const url = `${this.baseUrl}/auth/firebase-sync`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${firebaseToken}` },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const detail = typeof err?.detail === "string" ? err.detail : "";
        if (res.status === 404) {
          throw new Error(
            "FIREBASE_SYNC_404: このサーバーには /auth/firebase-sync がありません。バックエンドを最新版にデプロイしてください。"
          );
        }
        if (res.status === 503 && detail.includes("FIREBASE_NOT_CONFIGURED")) {
          throw new Error(
            "FIREBASE_NOT_CONFIGURED: サーバーでFirebaseが設定されていません。Azure の環境変数に FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY を設定し、App Service を再起動してください。"
          );
        }
        throw new Error(detail || `ユーザー同期に失敗しました（${res.status}）`);
      }
    } catch (e) {
      clearTimeout(timeoutId);
      if (e instanceof Error) {
        if (e.name === "AbortError") {
          throw new Error("サーバーが応答しませんでした。しばらく経ってからお試しください。");
        }
        throw e;
      }
      throw new Error("ユーザー同期に失敗しました");
    }
  }

  async getMe(): Promise<UserResponse> {
    return this.get<UserResponse>("/auth/me");
  }

  async getUserById(userId: number): Promise<UserResponse> {
    return this.get<UserResponse>(`/auth/users/${userId}`);
  }

  async updateProfile(data: { name?: string; handle?: string; bio?: string }) {
    return this.put<UserResponse>("/auth/me", data);
  }

  async updateIcon(iconUrl: string): Promise<UserResponse> {
    return this.put<UserResponse>("/auth/me/icon", { icon_url: iconUrl });
  }

  async updatePassword(newPassword: string) {
    const { isFirebaseConfigured, updatePassword } = await import("../lib/firebase");
    
    if (!isFirebaseConfigured) {
      throw new Error("Firebase is not configured");
    }

    try {
      // Firebase側でパスワードを更新
      await updatePassword(newPassword);
      
      // バックエンドにも通知（ログ記録用）
      await this.put("/auth/me/password", { new_password: newPassword });
      
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("weak-password")) {
        throw new Error("パスワードは6文字以上にしてください");
      }
      if (msg.includes("requires-recent-login")) {
        throw new Error("パスワードを変更するには、再ログインが必要です");
      }
      throw err;
    }
  }

  async uploadImage(uri: string): Promise<string> {
    await this.ensureInitialized();
    
    // React NativeのFormData形式に合わせる
    const formData = new FormData();
    const fileName = uri.split("/").pop() || `image-${Date.now()}.jpg`;
    const fileExtension = fileName.split('.').pop()?.toLowerCase() || 'jpg';
    
    // React Native用のFormData形式
    const mimeType = fileExtension === 'jpg' || fileExtension === 'jpeg' 
      ? 'image/jpeg' 
      : fileExtension === 'png' 
      ? 'image/png' 
      : fileExtension === 'webp'
      ? 'image/webp'
      : fileExtension === 'gif'
      ? 'image/gif'
      : 'image/jpeg';
    
    // React NativeのFormData形式（uriはそのまま使用）
    formData.append("file", {
      uri: uri,
      name: fileName,
      type: mimeType,
    } as any);

    if (!this.token) {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEYS.authToken);
        if (stored) this.token = stored;
      } catch (_) {}
    }
    const headers: Record<string, string> = {};
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }
    // FormData使用時はContent-Typeを設定しない（boundaryが自動付与される）

    try {
      const response = await fetch(this.resolveUrl("/api/uploads/images"), {
        method: "POST",
        headers,
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const error: ApiError = await response.json();
          errorMessage = error.detail || errorMessage;
        } catch {
          // JSON解析失敗時はデフォルトメッセージを使用
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      const imageUrl = data.url as string;
      return this.resolveUrl(imageUrl);
    } catch (error: any) {
      console.error("Image upload error:", error);
      throw new Error(error.message || "画像のアップロードに失敗しました");
    }
  }

  // 投稿関連
  async getPosts(params?: { stock_id?: number; user_id?: number; skip?: number; limit?: number }) {
    const query = new URLSearchParams();
    if (params?.stock_id) query.append("stock_id", params.stock_id.toString());
    if (params?.user_id) query.append("user_id", params.user_id.toString());
    if (params?.skip) query.append("skip", params.skip.toString());
    if (params?.limit) query.append("limit", params.limit.toString());
    
    const queryString = query.toString();
    return this.get(`/posts${queryString ? `?${queryString}` : ""}`);
  }

  async createPost(data: {
    text: string;
    post_type?: string;
    stock_id?: number;
    stock_symbol?: string;
    chart_image_url?: string;
    shares?: number;
    price?: number;
    stock_items?: Array<{
      stock_symbol: string;
      shares?: number;
      price?: number;
      holding_shares?: number;
    }>;
  }) {
    return this.post("/posts", data);
  }

  async likePost(postId: number) {
    return this.post(`/posts/${postId}/like`);
  }

  async retweetPost(postId: number) {
    return this.post(`/posts/${postId}/retweet`);
  }

  async deletePost(postId: number) {
    return this.delete(`/posts/${postId}`);
  }

  async quotePost(postId: number, data: { text: string; post_type?: string; stock_symbol?: string; chart_image_url?: string }) {
    return this.post(`/posts/${postId}/quote`, data);
  }

  // 通知関連
  async getNotifications(params?: { skip?: number; limit?: number; unread_only?: boolean }) {
    const query = new URLSearchParams();
    if (params?.skip) query.append("skip", params.skip.toString());
    if (params?.limit) query.append("limit", params.limit.toString());
    if (params?.unread_only) query.append("unread_only", "true");
    const qs = query.toString();
    return this.get<any[]>(`/notifications${qs ? `?${qs}` : ""}`);
  }

  async getUnreadNotificationCount(): Promise<{ count: number }> {
    return this.get("/notifications/unread-count");
  }

  async markNotificationRead(id: number) {
    return this.put(`/notifications/${id}/read`);
  }

  async markAllNotificationsRead() {
    return this.put("/notifications/read-all");
  }

  // 銘柄関連
  async getStocks(params?: { skip?: number; limit?: number; search?: string }) {
    const query = new URLSearchParams();
    if (params?.skip) query.append("skip", params.skip.toString());
    if (params?.limit) query.append("limit", params.limit.toString());
    if (params?.search) query.append("search", params.search);
    
    const queryString = query.toString();
    return this.get(`/stocks${queryString ? `?${queryString}` : ""}`);
  }

  async getStock(symbol: string) {
    return this.get(`/stocks/${symbol}`);
  }

  async getStockDetailed(symbol: string, period?: string): Promise<any> {
    const params = period ? `?period=${encodeURIComponent(period)}` : "";
    return this.get(`/stocks/${symbol}${params}`);
  }

  async getStockRankings(params?: { limit?: number; scope?: "popular" | "all" }): Promise<StockRankingResponse> {
    const query = new URLSearchParams();
    if (params?.limit) query.append("limit", params.limit.toString());
    if (params?.scope) query.append("scope", params.scope);
    
    const queryString = query.toString();
    return this.get<StockRankingResponse>(`/stocks/rankings${queryString ? `?${queryString}` : ""}`);
  }
  
  async getListedStocks(params?: { skip?: number; limit?: number; search?: string }): Promise<StockListedInfo[]> {
    const query = new URLSearchParams();
    if (params?.skip) query.append("skip", params.skip.toString());
    if (params?.limit) query.append("limit", params.limit.toString());
    if (params?.search) query.append("search", params.search);
    
    const queryString = query.toString();
    return this.get(`/stocks/listed${queryString ? `?${queryString}` : ""}`);
  }

  // ポートフォリオ関連
  async getPortfolios(params?: { user_id?: number }) {
    const query = new URLSearchParams();
    if (params?.user_id) query.append("user_id", params.user_id.toString());
    const queryString = query.toString();
    return this.get(`/portfolios${queryString ? `?${queryString}` : ""}`);
  }

  async createPortfolio(data: {
    name: string;
    is_public?: boolean;
    holdings?: Array<{ stock_id?: number; stock_symbol?: string; shares?: number; purchase_price?: number }>;
  }) {
    return this.post("/portfolios", data);
  }

  async updatePortfolio(portfolioId: number, data: { name?: string; is_public?: boolean }) {
    return this.put(`/portfolios/${portfolioId}`, data);
  }

  async deletePortfolio(portfolioId: number) {
    return this.delete(`/portfolios/${portfolioId}`);
  }

  async addPortfolioHolding(portfolioId: number, data: {
    stock_symbol: string;
    shares: number;
    purchase_price?: number;
    memo?: string;
  }) {
    return this.post(`/portfolios/${portfolioId}/holdings`, data);
  }

  // フォロー関連
  async followUser(followingId: number) {
    return this.post("/follows", { following_id: followingId });
  }

  async unfollowUser(followingId: number) {
    return this.delete(`/follows/${followingId}`);
  }

  async getFollowing(userId?: number): Promise<UserResponse[]> {
    const query = userId ? `?user_id=${userId}` : "";
    return this.get<UserResponse[]>(`/follows/following${query}`);
  }

  async getFollowers(userId?: number): Promise<UserResponse[]> {
    const query = userId ? `?user_id=${userId}` : "";
    return this.get<UserResponse[]>(`/follows/followers${query}`);
  }

  async getUserFollowing(userId: number): Promise<UserResponse[]> {
    return this.get<UserResponse[]>(`/follows/users/${userId}/following`);
  }

  async getUserFollowers(userId: number): Promise<UserResponse[]> {
    return this.get<UserResponse[]>(`/follows/users/${userId}/followers`);
  }

  // DM（ダイレクトメッセージ）関連
  async getConversations(): Promise<ConversationResponse[]> {
    return this.get<ConversationResponse[]>("/messages");
  }

  async getConversation(conversationId: number): Promise<ConversationDetailResponse> {
    return this.get<ConversationDetailResponse>(`/messages/${conversationId}`);
  }

  async startConversation(userId: number, initialMessage: string): Promise<ConversationDetailResponse> {
    return this.post<ConversationDetailResponse>("/messages", {
      user_id: userId,
      initial_message: initialMessage,
    });
  }

  async sendMessage(conversationId: number, text: string): Promise<DirectMessageResponse> {
    return this.post<DirectMessageResponse>(`/messages/${conversationId}/messages`, { text });
  }

  async markConversationAsRead(conversationId: number): Promise<void> {
    return this.put(`/messages/${conversationId}/read`);
  }
}

export const apiClient = new ApiClient(API_BASE_URL);

// API接続テスト用のメソッドを追加
export const checkApiConnection = async (): Promise<{ success: boolean; message: string }> => {
  return testApiConnection();
};

