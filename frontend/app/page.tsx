import Link from "next/link";

export default function Home() {
  return (
    <main style={{ textAlign: 'center', marginTop: '100px' }}>
      <h1>Hello StockSpace 🚀</h1>
      <p>株の世界を学生から変えていく</p>
      <br />
      <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link href="/stocks" style={{ color: 'blue', textDecoration: 'underline' }}>
          → 銘柄検索・チャート
        </Link>
        <Link href="/profile" style={{ color: 'blue', textDecoration: 'underline' }}>
          → プロフィールページへ
        </Link>
      </div>
    </main>
  );
}
