const API_BASE =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000")
    : process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function fetchStockByCode(code: string) {
  const res = await fetch(`${API_BASE}/stocks?search=${encodeURIComponent(code)}`);
  if (!res.ok) throw new Error("銘柄が見つかりませんでした");
  return res.json();
}

export async function fetchStockDetail(symbol: string) {
  const res = await fetch(`${API_BASE}/stocks/${encodeURIComponent(symbol)}`);
  if (!res.ok) throw new Error("銘柄が見つかりませんでした");
  return res.json();
}
