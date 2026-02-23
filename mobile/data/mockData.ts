export interface Stock {
  id?: string;
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  high?: number;
  low?: number;
  per?: number;
  pbr?: number;
  dividendYield?: number;
  dividendPayoutRatio?: number;
  marketCap?: number;
  revenue?: number;
  profit?: number;
  history?: number[];
  historyLabels?: string[];
  revenueHistory?: number[];
  profitHistory?: number[];
  dividendHistory?: number[];
  dividendLabels?: string[];
}

export interface WatchlistItem extends Stock {
  shares?: number; // 保有株数
  purchasePrice?: number; // 取得金額（1株あたり）
}

export interface User {
  id: string;
  name: string;
  handle: string;
  iconUrl?: string;
  bio?: string;
}

export interface PostStockItem {
  stock: Stock;
  shares?: number;
  price?: number;
  holding_shares?: number;
}

export interface Post {
  id: string;
  type: "bot" | "user" | "purchase" | "sale";
  user: User;
  text: string;
  stock?: Stock;
  stockItems?: PostStockItem[];  // 複数銘柄報告
  createdAt: string;
  likes?: number;
  retweets?: number;
  comments?: number;
  chartImage?: string;
  isLiked?: boolean;
  isRetweeted?: boolean;
  retweetedBy?: User;  // リツイートした人
  retweetedAt?: string;  // リツイートした日時
  quotedPost?: Post;  // 引用された元の投稿
}

export interface Portfolio {
  id?: number;
  name: string;
  is_public?: boolean;
  holdings: {
    stock: Stock;
    shares: number;
    purchase_price?: number;
    memo?: string;
  }[];
}

// モックデータは削除 - 常にAPIからリアルタイムデータを取得
export const mockStocks: Stock[] = [];

export const mockUsers: User[] = [
  { id: "1", name: "田中太郎", handle: "@tanaka" },
  { id: "2", name: "佐藤花子", handle: "@sato" },
  { id: "3", name: "鈴木一郎", handle: "@suzuki" },
];

export const mockPosts: Post[] = [
  {
    id: "1",
    type: "user",
    user: mockUsers[0],
    text: "トヨタの決算が良さそう。長期保有を続けます。",
    stock: mockStocks[0],
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    likes: 24,
    retweets: 5,
    comments: 3,
  },
  {
    id: "2",
    type: "bot",
    user: { id: "bot1", name: "AIアナリスト", handle: "@ai_analyst" },
    text: "ソニーグループの新製品発表が市場に好影響を与える可能性があります。",
    stock: mockStocks[1],
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    likes: 18,
    retweets: 8,
    comments: 2,
  },
  {
    id: "3",
    type: "user",
    user: mockUsers[1],
    text: "キーエンスの株価が堅調。技術力の高さが評価されている。",
    stock: mockStocks[4],
    createdAt: new Date(Date.now() - 10800000).toISOString(),
    likes: 31,
    retweets: 12,
    comments: 7,
  },
  {
    id: "4",
    type: "purchase",
    user: mockUsers[0],
    text: "トヨタ自動車(7203)を購入しました",
    stock: mockStocks[0],
    createdAt: new Date(Date.now() - 14400000).toISOString(),
    likes: 15,
    retweets: 3,
    comments: 1,
  },
];

export const mockPortfolios: Portfolio[] = [
  {
    name: "メインポートフォリオ",
    holdings: [
      { stock: mockStocks[0], shares: 10 },
      { stock: mockStocks[1], shares: 5 },
      { stock: mockStocks[2], shares: 8 },
    ],
  },
];

