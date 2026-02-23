import React, { createContext, useContext, ReactNode, useState, useEffect, useCallback } from "react";
import { apiClient, type UserResponse, type StockRankingResponse as ApiStockRankingResponse, type StockRankingEntry } from "../services/api";
import { Stock, Post, Portfolio } from "../data/mockData";
import { API_BASE_URL } from "../config/api";

function absoluteImageUrl(url: string | null | undefined): string | undefined {
  if (!url || !url.trim()) return undefined;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const base = API_BASE_URL.replace(/\/$/, "");
  return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
}

export interface AppUser {
  id: string;
  name: string;
  handle: string;
  username?: string;
  email?: string;
  bio?: string | null;
  iconUrl?: string | null;
}

interface AppContextType {
  user: AppUser | null;
  stocks: Stock[];
  posts: Post[];
  portfolios: Portfolio[];
  rankings: StockRankings | null;
  loading: boolean;
  error: string | null;
  refreshUser: () => Promise<AppUser | null>;
  refreshStocks: () => Promise<void>;
  refreshPosts: () => Promise<void>;
  refreshPortfolios: () => Promise<void>;
  refreshRankings: () => Promise<void>;
  addPost: (post: Omit<Post, "id" | "createdAt">) => Promise<void>;
  likePost: (postId: string) => Promise<void>;
  retweetPost: (postId: string) => Promise<void>;
  deletePost: (postId: string) => Promise<void>;
}

interface StockRankings {
  updatedAt: string;
  topGainers: StockRankingEntry[];
  topLosers: StockRankingEntry[];
}

const AppContext = createContext<AppContextType | undefined>(undefined);

/** 認証まわりのエラーか（期限切れ・未ログインなど）。ログを出さず静かに扱う */
function isAuthError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("認証トークン") ||
    msg.includes("再度ログイン") ||
    msg.includes("401") ||
    msg.includes("ログインしてください")
  );
}

/** サーバー側500など。ログは控えめにし空で続行 */
function isServerError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("サーバーエラー") || msg.includes("500") || msg.includes("しばらくしてから");
}

/** タイムアウト・ネットワークエラー。ログを出さず静かに扱う */
function isTimeoutOrNetwork(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("タイムアウト") ||
    msg.includes("ムアウト") || // 「タ イムアウト」表記ゆれ対応
    msg.includes("ネットワーク") ||
    msg.includes("接続できません") ||
    msg.includes("Failed to fetch")
  );
}

export const toAppUser = (data: UserResponse): AppUser => ({
  id: data.id.toString(),
  name: data.name,
  handle: data.handle,
  username: data.username,
  email: data.email,
  bio: data.bio ?? null,
  iconUrl: absoluteImageUrl(data.icon_url ?? null) ?? null,
});

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [rankings, setRankings] = useState<StockRankings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshUser = useCallback(async (): Promise<AppUser | null> => {
    try {
      const data = await apiClient.getMe();
      const converted = toAppUser(data);
      setUser(converted);
      return converted;
    } catch (err) {
      if (!isAuthError(err) && !isTimeoutOrNetwork(err) && !isServerError(err)) {
        console.error("Error fetching user:", err);
      }
      setUser(null);
      return null;
    }
  }, []);

  const refreshStocks = useCallback(async () => {
    try {
      // 検索クエリがない場合は空のリストを返す（検索必須のため）
      // 実際のデータは検索時に取得される
      setStocks([]);
    } catch (err) {
      console.error("Error fetching stocks:", err);
      setStocks([]);
    }
  }, []);

  const refreshPosts = useCallback(async () => {
    try {
      const data = await apiClient.getPosts({ limit: 50 });
      // APIレスポンスをPost型に変換
      const convertedPosts = (data as any[]).map((p: any) => ({
        id: p.id.toString(),
        type: p.post_type as "bot" | "user" | "purchase" | "sale",
        user: {
          id: p.user.id.toString(),
          name: p.user.name,
          handle: p.user.handle,
          iconUrl: absoluteImageUrl(p.user.icon_url),
        },
        text: p.text,
        stock: p.stock ? {
          symbol: p.stock.symbol,
          name: p.stock.name,
          price: p.stock.price,
          change: p.stock.change,
          changePct: p.stock.change_pct,
          high: p.stock.high,
          low: p.stock.low,
        } : undefined,
        stockItems: p.stock_items?.length
          ? p.stock_items.map((si: any) => ({
              stock: {
                symbol: si.stock.symbol,
                name: si.stock.name,
                price: si.stock.price ?? 0,
                change: si.stock.change ?? 0,
                changePct: si.stock.change_pct ?? si.stock.changePct ?? 0,
                high: si.stock.high,
                low: si.stock.low,
              },
              shares: si.shares,
              price: si.price,
              holding_shares: si.holding_shares,
            }))
          : undefined,
        createdAt: p.created_at,
        likes: p.likes_count,
        retweets: p.retweets_count,
        comments: p.comments_count,
        chartImage: absoluteImageUrl(p.chart_image_url),
        isLiked: p.is_liked,
        isRetweeted: p.is_retweeted,
        // リツイート情報
        retweetedBy: p.retweeted_by ? {
          id: p.retweeted_by.id.toString(),
          name: p.retweeted_by.name,
          handle: p.retweeted_by.handle,
        } : undefined,
        retweetedAt: p.retweeted_at,
        // 引用リツイート情報
        quotedPost: p.quoted_post ? {
          id: p.quoted_post.id.toString(),
          type: p.quoted_post.post_type as "bot" | "user" | "purchase" | "sale",
          user: {
            id: p.quoted_post.user.id.toString(),
            name: p.quoted_post.user.name,
            handle: p.quoted_post.user.handle,
            iconUrl: absoluteImageUrl(p.quoted_post.user.icon_url),
          },
          text: p.quoted_post.text,
          stock: p.quoted_post.stock ? {
            symbol: p.quoted_post.stock.symbol,
            name: p.quoted_post.stock.name,
            price: p.quoted_post.stock.price,
            change: p.quoted_post.stock.change,
            changePct: p.quoted_post.stock.change_pct,
            high: p.quoted_post.stock.high,
            low: p.quoted_post.stock.low,
          } : undefined,
          createdAt: p.quoted_post.created_at,
          likes: p.quoted_post.likes_count,
          retweets: p.quoted_post.retweets_count,
          comments: p.quoted_post.comments_count,
          chartImage: absoluteImageUrl(p.quoted_post.chart_image_url),
        } : undefined,
      }));
      setPosts(convertedPosts);
    } catch (err) {
      if (!isAuthError(err) && !isTimeoutOrNetwork(err) && !isServerError(err)) console.error("Error fetching posts:", err);
      setPosts([]);
    }
  }, []);

  const refreshPortfolios = useCallback(async () => {
    try {
      const data = await apiClient.getPortfolios();
      const me = await apiClient.getMe().catch(() => null);
      const raw = (data as any[]) || [];
      let mine = me ? raw.filter((p: any) => String(p.user_id) === String(me.id)) : [];
      if (me && mine.length === 0) {
        try {
          await apiClient.refreshAuthToken();
          await apiClient.createPortfolio({ name: "ウォッチリスト", is_public: false, holdings: [] });
          const newData = await apiClient.getPortfolios();
          const newRaw = (newData as any[]) || [];
          mine = newRaw.filter((p: any) => String(p.user_id) === String(me.id));
        } catch (_) {}
      }
      const converted = mine.map((p: any) => ({
        id: p.id,
        name: p.name,
        is_public: p.is_public ?? false,
        holdings: (p.holdings || []).map((h: any) => ({
          stock: {
            symbol: h.stock?.symbol ?? "",
            name: h.stock?.name ?? "",
            price: h.stock?.price ?? 0,
            change: h.stock?.change ?? 0,
            changePct: h.stock?.change_pct ?? 0,
          },
          shares: h.shares ?? 0,
          purchase_price: h.purchase_price,
          memo: h.memo,
        })),
      }));
      setPortfolios(converted);
    } catch (err) {
      if (!isAuthError(err) && !isServerError(err) && !isTimeoutOrNetwork(err)) console.error("Error fetching portfolios:", err);
      setPortfolios([]);
    }
  }, []);

  const refreshRankings = useCallback(async () => {
    try {
      const data: ApiStockRankingResponse = await apiClient.getStockRankings({ scope: "all" });
      setRankings({
        updatedAt: data.updated_at,
        topGainers: data.top_gainers,
        topLosers: data.top_losers,
      });
    } catch (err) {
      if (!isTimeoutOrNetwork(err) && !isServerError(err)) console.error("Error fetching rankings:", err);
      // エラー時はランキングを空にする（モックデータは使用しない）
      setRankings(null);
      throw err;
    }
  }, []);

  const addPost = async (
    postData: Omit<Post, "id" | "createdAt"> & {
      shares?: number;
      price?: number;
      stockItems?: Array<{ stock_symbol: string; shares?: number; price?: number; holding_shares?: number }>;
    }
  ) => {
    try {
      await apiClient.createPost({
        text: postData.text,
        post_type: postData.type || "user",
        stock_symbol: postData.stockItems == null ? postData.stock?.symbol : undefined,
        chart_image_url: postData.chartImage,
        shares: postData.stockItems == null ? postData.shares : undefined,
        price: postData.stockItems == null ? postData.price : undefined,
        stock_items: postData.stockItems ?? undefined,
      });
      await refreshPosts();
    } catch (err) {
      console.error("Error creating post:", err);
      throw err;
    }
  };

  const likePost = useCallback(async (postId: string) => {
    try {
      const response = await apiClient.likePost(parseInt(postId));
      // ローカルの投稿リストを更新
      setPosts(prevPosts => prevPosts.map(post => {
        if (post.id === postId) {
          const apiPost = response as any;
          return {
            ...post,
            likes: apiPost.likes_count,
            isLiked: apiPost.is_liked,
          };
        }
        return post;
      }));
    } catch (err) {
      console.error("Error liking post:", err);
      throw err;
    }
  }, []);

  const retweetPost = useCallback(async (postId: string) => {
    try {
      const response = await apiClient.retweetPost(parseInt(postId));
      // ローカルの投稿リストを更新
      setPosts(prevPosts => prevPosts.map(post => {
        if (post.id === postId) {
          const apiPost = response as any;
          return {
            ...post,
            retweets: apiPost.retweets_count,
            isRetweeted: apiPost.is_retweeted,
          };
        }
        return post;
      }));
    } catch (err) {
      console.error("Error retweeting post:", err);
      throw err;
    }
  }, []);

  const deletePost = useCallback(async (postId: string) => {
    try {
      await apiClient.deletePost(parseInt(postId));
      // ローカルの投稿リストから削除
      setPosts(prevPosts => prevPosts.filter(post => post.id !== postId));
    } catch (err) {
      console.error("Error deleting post:", err);
      throw err;
    }
  }, []);

  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // 起動時にトークンを更新（期限切れなら新しいトークンを取得）
      await apiClient.refreshAuthToken();

      // データを並列で取得（allSettledでエラーがあっても続行）
      const results = await Promise.allSettled([
        refreshUser(),
        refreshStocks(),
        refreshPosts(),
        refreshPortfolios(),
        refreshRankings(),
      ]);

      // 認証・サーバー・タイムアウト以外のときだけログ
      results.forEach((result, index) => {
        if (
          result.status === "rejected" &&
          !isAuthError(result.reason) &&
          !isServerError(result.reason) &&
          !isTimeoutOrNetwork(result.reason)
        ) {
          const names = ["refreshUser", "refreshStocks", "refreshPosts", "refreshPortfolios", "refreshRankings"];
          console.error(`Error in ${names[index]}:`, result.reason);
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "データの読み込みに失敗しました");
      if (!isTimeoutOrNetwork(err) && !isServerError(err)) console.error("Error loading initial data:", err);
    } finally {
      setLoading(false);
    }
  }, [refreshUser, refreshStocks, refreshPosts, refreshPortfolios, refreshRankings]);

  // 初期データ読み込み
  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // 株価の定期更新（30秒ごと）
  useEffect(() => {
    const interval = setInterval(() => {
      refreshStocks().catch((err) => {
        if (!isTimeoutOrNetwork(err) && !isServerError(err)) console.error("Error in periodic stock refresh:", err);
      });
    }, 30000); // 30秒ごと

    return () => clearInterval(interval);
  }, [refreshStocks]);

  return (
    <AppContext.Provider
      value={{
        user,
        stocks,
        posts,
        portfolios,
        rankings,
        loading,
        error,
        refreshUser,
        refreshStocks,
        refreshPosts,
        refreshPortfolios,
        refreshRankings,
        addPost,
        likePost,
        retweetPost,
        deletePost,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within AppProvider");
  }
  return context;
}
