"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function StocksPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showPopular, setShowPopular] = useState(true);

  const loadPopular = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/stocks/rankings?limit=20&scope=popular`);
      if (!res.ok) throw new Error("ランキングの取得に失敗しました");
      const data = await res.json();
      const all = [...(data.top_gainers || []), ...(data.top_losers || []).slice(0, 10)];
      setResults(all);
      setShowPopular(true);
    } catch (e: any) {
      setError(e.message || "エラーが発生しました");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPopular();
  }, []);

  const search = async () => {
    if (!query.trim()) {
      loadPopular();
      return;
    }
    setLoading(true);
    setError(null);
    setResults([]);
    setShowPopular(false);
    try {
      const res = await fetch(`${API_BASE}/stocks?search=${encodeURIComponent(query.trim())}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(typeof err.detail === "string" ? err.detail : err.detail?.join?.(" ") || "検索に失敗しました");
      }
      const data = await res.json();
      setResults(Array.isArray(data) ? data : [data]);
    } catch (e: any) {
      setError(e.message || "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="text-blue-400 hover:underline text-sm mb-6 inline-block">
          ← ホーム
        </Link>
        <h1 className="text-2xl font-bold mb-2">銘柄検索</h1>
        <p className="text-zinc-400 text-sm mb-6">銘柄コードまたは会社名（例: 7203 / トヨタ）</p>

        <div className="flex gap-2 mb-8">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="例: 7203 や トヨタ"
            className="flex-1 px-4 py-2 rounded-lg bg-zinc-900 border border-zinc-700 focus:border-blue-500 focus:outline-none"
          />
          <button
            onClick={search}
            disabled={loading}
            className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 font-medium"
          >
            {loading ? "検索中..." : "検索"}
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-900/30 border border-red-800 text-red-300">
            {error}
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-zinc-300">
              {showPopular ? "人気銘柄" : "検索結果"}
            </h2>
            {results.map((stock) => (
              <Link
                key={stock.symbol}
                href={`/stocks/${stock.symbol}`}
                className="block p-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-blue-600 hover:bg-zinc-800/50 transition"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-mono font-bold text-blue-400">{stock.symbol}</span>
                    <span className="ml-2 text-zinc-300">{stock.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">
                      {stock.price && stock.price > 0 ? `¥${stock.price.toLocaleString()}` : "—"}
                    </div>
                    <div
                      className={`text-sm ${
                        (stock.change_pct ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {stock.price && stock.price > 0 ? (
                        <>{(stock.change_pct ?? 0) >= 0 ? "+" : ""}{stock.change?.toLocaleString()} ({stock.change_pct?.toFixed(2)}%)</>
                      ) : (
                        <span className="text-zinc-500">詳細で取得</span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
