import { useEffect, useState } from "react";
import { Link } from "wouter";

interface BlogPost {
  id: number;
  title: string;
  blogSlug: string;
  imageUrl: string | null;
  metaDescription: string | null;
  createdAt: string;
  topic: string | null;
}

export default function BlogListPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/blog/posts")
      .then((r) => r.json())
      .then((d) => { setPosts(d.posts ?? []); setLoading(false); })
      .catch(() => { setError("Blog yazıları yüklenemedi."); setLoading(false); });
  }, []);

  return (
    <div className="min-h-screen bg-[#f8faff]">
      <header className="bg-[#14213D] text-white px-6 py-4">
        <a href="/" className="font-bold text-xl" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          İhaleZeka
        </a>
        <div className="text-sm opacity-70 mt-0.5">Akıllı İhale Takip Platformu</div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          İhaleZeka Blog
        </h1>
        <p className="text-gray-500 mb-10">İhale dünyasından haberler, stratejiler ve ipuçları.</p>

        {loading && (
          <div className="space-y-4">
            {[1,2,3].map((i) => (
              <div key={i} className="bg-white rounded-xl p-6 shadow-sm animate-pulse flex gap-5">
                <div className="w-36 h-24 bg-gray-200 rounded-lg shrink-0" />
                <div className="flex-1 space-y-3">
                  <div className="h-5 bg-gray-200 rounded w-3/4" />
                  <div className="h-4 bg-gray-100 rounded w-full" />
                  <div className="h-3 bg-gray-100 rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        )}

        {error && <p className="text-red-500">{error}</p>}

        {!loading && !error && posts.length === 0 && (
          <p className="text-gray-400">Henüz blog yazısı yayınlanmamış.</p>
        )}

        <div className="space-y-4">
          {posts.map((post) => (
            <article key={post.id} className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow">
              <Link href={`/blog/${post.blogSlug}`} className="flex gap-5 p-6 no-underline">
                {post.imageUrl ? (
                  <img
                    src={post.imageUrl}
                    alt={post.title}
                    className="w-36 h-24 object-cover rounded-lg shrink-0"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <div className="w-36 h-24 bg-gray-100 rounded-lg shrink-0 flex items-center justify-center text-gray-400 text-xs">
                    Görsel yok
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-semibold text-[#2D5BFF] mb-2 leading-snug hover:underline">
                    {post.title}
                  </h2>
                  <p className="text-gray-500 text-sm mb-2 line-clamp-2">{post.metaDescription}</p>
                  <span className="text-xs text-gray-400">
                    {new Date(post.createdAt).toLocaleDateString("tr-TR", { year: "numeric", month: "long", day: "numeric" })}
                  </span>
                </div>
              </Link>
            </article>
          ))}
        </div>
      </div>

      <footer className="bg-[#1a2030] text-gray-400 px-6 py-8 text-center text-sm mt-16">
        <p>© {new Date().getFullYear()} İhaleZeka — Akıllı İhale Takip Platformu</p>
        <p className="mt-2 space-x-4">
          <a href="/" className="hover:text-white transition-colors">Ana Sayfa</a>
          <a href="/gizlilik" className="hover:text-white transition-colors">Gizlilik</a>
          <a href="/kvkk" className="hover:text-white transition-colors">KVKK</a>
          <a href="/kullanim-sartlari" className="hover:text-white transition-colors">Kullanım Şartları</a>
        </p>
      </footer>
    </div>
  );
}
