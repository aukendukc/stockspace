"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  ComposedChart,
} from "recharts";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function StockDetailPage() {
  const params = useParams();
  const router = useRouter();
  const symbol = params.symbol as string;

  const [stock, setStock] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartPeriod, setChartPeriod] = useState<string>("3m");

  useEffect(() => {
    if (!symbol) return;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/stocks/${encodeURIComponent(symbol)}?period=${encodeURIComponent(chartPeriod)}`);
        if (!res.ok) throw new Error("銘柄が見つかりませんでした");
        const data = await res.json();
        setStock(data);
      } catch (e: any) {
        setError(e.message || "エラーが発生しました");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [symbol, chartPeriod]);

  // チャートには最低2点必要。APIから1点以下の場合は価格から補完
  const rawPriceHistory = stock?.price_history ?? [];
  const rawLabels = stock?.price_history_labels ?? [];
  let priceData = rawPriceHistory.map((p: number, i: number) => ({
    price: p,
    label: rawLabels[i] ?? `Day ${i + 1}`,
  }));
  if (priceData.length < 2 && typeof stock?.price === "number" && !Number.isNaN(stock.price)) {
    const prev = stock?.previous_close ?? stock.price;
    priceData = [
      { price: prev, label: "前日" },
      { price: stock.price, label: "当日" },
    ];
  }

  // Y軸ドメイン（同値・2点でもチャートが正しく描画されるよう範囲を確保）
  const prices = priceData.map((d: { price: number }) => d.price).filter((p: unknown): p is number => typeof p === "number");
  const priceMin = prices.length ? Math.min(...prices) : 0;
  const priceMax = prices.length ? Math.max(...prices) : 1;
  const padding = Math.max((priceMax - priceMin) * 0.02, priceMax * 0.001, priceMax * 0.01, 1);
  const yMin = Math.max(0, Math.floor(priceMin - padding));
  const yMax = Math.ceil(priceMax + padding);
  const yDomain: [number, number] = yMin === yMax ? [yMin, yMax + 1] : [yMin, yMax];

  const financialData =
    stock?.revenue_history?.map((rev: number, i: number) => ({
      revenue: rev / 100000000,
      profit: (stock?.profit_history?.[i] ?? 0) / 100000000,
      label: stock?.period_labels?.[i] ?? stock?.dividend_labels?.[i] ?? (i === 0 ? "直近" : `${i + 1}期前`),
    })) ?? [];

  const dividendData =
    stock?.dividend_history?.map((d: number, i: number) => ({
      dividend: d,
      label: stock?.dividend_labels?.[i] || `年${i + 1}`,
    })) ?? [];

  const positive = (stock?.change_pct ?? 0) >= 0;
  const formatOku = (v: number | null | undefined) =>
    typeof v === "number" && !Number.isNaN(v) ? `¥${(v / 100000000).toFixed(1)}億` : "-";

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <div className="text-zinc-400">読み込み中...</div>
      </main>
    );
  }

  if (error || !stock) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
        <Link href="/stocks" className="text-blue-400 hover:underline text-sm mb-6 inline-block">
          ← 銘柄検索へ
        </Link>
        <div className="text-red-400">{error || "銘柄が見つかりませんでした"}</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6 pb-20">
      <div className="max-w-3xl mx-auto">
        <Link href="/stocks" className="text-blue-400 hover:underline text-sm mb-6 inline-block">
          ← 銘柄検索へ
        </Link>

        {/* ヘッダー */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold">
            <span className="text-blue-400 font-mono">{stock.symbol}</span> {stock.name}
          </h1>
          <p className="text-zinc-500 text-sm mt-1">
            {stock.source === "jquants" && "※J-Quants無料版のため約12週間遅延あり"}
          </p>
        </div>

        {/* 現在価格 */}
        <div className="mb-6 p-6 rounded-2xl bg-zinc-900 border border-zinc-800">
          <div className="text-zinc-400 text-sm mb-1">現在価格</div>
          <div className="text-3xl font-bold mb-1">¥{stock.price?.toLocaleString()}</div>
          <div
            className={`text-lg font-semibold ${
              positive ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {positive ? "+" : ""}
            {stock.change?.toLocaleString()} ({stock.change_pct?.toFixed(2)}%)
          </div>
        </div>

        {/* 株価チャート */}
        {priceData.length >= 2 ? (
          <div className="mb-6 p-6 rounded-2xl bg-zinc-900 border border-zinc-800">
            <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
              <h2 className="text-zinc-400 text-sm">株価推移</h2>
              <div className="flex flex-wrap gap-1">
                {["1d", "5d", "1m", "3m", "6m", "1y", "5y"].map((p) => (
                  <button
                    key={p}
                    onClick={() => setChartPeriod(p)}
                    className={`px-2 py-1 rounded text-xs font-medium transition ${
                      chartPeriod === p
                        ? "bg-blue-600 text-white"
                        : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                    }`}
                  >
                    {p.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={priceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="label" stroke="#71717a" tick={{ fontSize: 11 }} />
                  <YAxis
                    stroke="#71717a"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `¥${Number(v).toLocaleString()}`}
                    domain={yDomain}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#18181b",
                      border: "1px solid #27272a",
                      borderRadius: 8,
                    }}
                    formatter={(v: number) => [`¥${v.toLocaleString()}`, "価格"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke={positive ? "#22c55e" : "#ef4444"}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="mb-6 p-6 rounded-2xl bg-zinc-900 border border-zinc-800">
            <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
              <h2 className="text-zinc-400 text-sm">株価推移</h2>
              <div className="flex flex-wrap gap-1">
                {["1d", "5d", "1m", "3m", "6m", "1y", "5y"].map((p) => (
                  <button
                    key={p}
                    onClick={() => setChartPeriod(p)}
                    className={`px-2 py-1 rounded text-xs font-medium transition ${
                      chartPeriod === p
                        ? "bg-blue-600 text-white"
                        : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                    }`}
                  >
                    {p.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div className="text-center text-zinc-500 py-8">
              チャートデータがありません。期間を変えてお試しください。
            </div>
          </div>
        )}

        {/* 財務情報 */}
        <div className="mb-6 p-6 rounded-2xl bg-zinc-900 border border-zinc-800">
          <h2 className="text-zinc-400 text-sm mb-4">財務情報</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <div className="text-zinc-500 text-xs">時価総額</div>
              <div className="font-semibold">{formatOku(stock.market_cap)}</div>
            </div>
            <div>
              <div className="text-zinc-500 text-xs">売上</div>
              <div className="font-semibold">{formatOku(stock.revenue)}</div>
            </div>
            <div>
              <div className="text-zinc-500 text-xs">利益</div>
              <div className="font-semibold">{formatOku(stock.profit)}</div>
            </div>
            <div>
              <div className="text-zinc-500 text-xs">PER</div>
              <div className="font-semibold">
                {typeof stock.per === "number" ? stock.per.toFixed(1) : "-"}
              </div>
            </div>
            <div>
              <div className="text-zinc-500 text-xs">PBR</div>
              <div className="font-semibold">
                {typeof stock.pbr === "number" ? stock.pbr.toFixed(1) : "-"}
              </div>
            </div>
            <div>
              <div className="text-zinc-500 text-xs">配当利回り</div>
              <div className="font-semibold">
                {typeof stock.dividend_yield === "number"
                  ? `${stock.dividend_yield.toFixed(2)}%`
                  : "-"}
              </div>
            </div>
          </div>
        </div>

        {/* 業績推移チャート */}
        {financialData.length > 0 ? (
          <div className="mb-6 p-6 rounded-2xl bg-zinc-900 border border-zinc-800">
            <h2 className="text-zinc-400 text-sm mb-4">業績推移（億円）</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={financialData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="label" stroke="#71717a" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#71717a" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}億`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#18181b",
                      border: "1px solid #27272a",
                      borderRadius: 8,
                    }}
                    formatter={(v: number) => [`${v.toFixed(1)}億円`, ""]}
                  />
                  <Legend />
                  <Bar dataKey="revenue" name="売上(億円)" fill="#3b82f6" radius={[4, 4, 0, 0]} stackId="a" />
                  <Bar dataKey="profit" name="利益(億円)" fill="#22c55e" radius={[4, 4, 0, 0]} stackId="a" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : null}

        {/* 配当推移チャート */}
        {dividendData.length > 0 ? (
          <div className="mb-6 p-6 rounded-2xl bg-zinc-900 border border-zinc-800">
            <h2 className="text-zinc-400 text-sm mb-4">配当推移（円/株）</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dividendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="label" stroke="#71717a" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#71717a" tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#18181b",
                      border: "1px solid #27272a",
                      borderRadius: 8,
                    }}
                  />
                  <Bar
                    dataKey="dividend"
                    name="配当(円)"
                    fill="#8b5cf6"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
