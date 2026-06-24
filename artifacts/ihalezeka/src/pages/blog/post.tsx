import { useEffect, useState } from "react";
import { useParams } from "wouter";

interface BlogPost {
  id: number;
  title: string;
  blogSlug: string;
  imageUrl: string | null;
  metaDescription: string | null;
  blogBody: string | null;
  createdAt: string;
  topic: string | null;
}

export default function BlogPostPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/blog/posts/${encodeURIComponent(slug)}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); setLoading(false); return null; }
        return r.json();
      })
      .then((d) => { if (d) { setPost(d); setLoading(false); } })
      .catch(() => { setNotFound(true); setLoading(false); });
  }, [slug]);

  return (
    <div className="min-h-screen bg-[#f8faff]">
      <header className="bg-[#14213D] text-white px-6 py-4">
        <a href="/" className="font-bold text-xl" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          İhaleZeka
        </a>
        <div className="text-sm opacity-70 mt-0.5">Akıllı İhale Takip Platformu</div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <a href="/blog" className="inline-flex items-center gap-1 text-[#2D5BFF] text-sm font-medium mb-8 hover:underline">
          ← Blog'a Dön
        </a>

        {loading && (
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-3/4" />
            <div className="h-4 bg-gray-100 rounded w-1/3" />
            <div className="h-52 bg-gray-200 rounded-xl w-full mt-4" />
            <div className="space-y-3 mt-6">
              {[1,2,3,4].map((i) => <div key={i} className="h-4 bg-gray-100 rounded" />)}
            </div>
          </div>
        )}

        {notFound && (
          <div className="text-center py-16">
            <h1 className="text-2xl font-bold text-gray-900 mb-3">Yazı bulunamadı</h1>
            <p className="text-gray-500 mb-6">Bu blog yazısı mevcut değil veya kaldırılmış olabilir.</p>
            <a href="/blog" className="text-[#2D5BFF] font-semibold hover:underline">← Blog'a Dön</a>
          </div>
        )}

        {!loading && !notFound && post && (
          <>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3 leading-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {post.title}
            </h1>
            <div className="flex items-center gap-4 text-sm text-gray-400 mb-6">
              <span>{new Date(post.createdAt).toLocaleDateString("tr-TR", { year: "numeric", month: "long", day: "numeric" })}</span>
              {post.topic && <span className="bg-blue-50 text-[#2D5BFF] px-2 py-0.5 rounded-full text-xs font-medium">{post.topic}</span>}
            </div>

            {post.imageUrl && (
              <img
                src={post.imageUrl}
                alt={post.title}
                className="w-full max-h-80 object-cover rounded-xl mb-8"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
            )}

            {post.blogBody ? (
              <div
                className="prose prose-lg max-w-none text-gray-700"
                style={{
                  lineHeight: 1.75,
                  fontFamily: "Inter, system-ui, sans-serif",
                }}
                dangerouslySetInnerHTML={{ __html: post.blogBody }}
              />
            ) : (
              <p className="text-gray-500">{post.metaDescription}</p>
            )}

            <div className="mt-12 bg-[#2D5BFF] text-white p-8 rounded-2xl text-center">
              <h3 className="text-xl font-bold mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                İhaleleri Kaçırmayın
              </h3>
              <p className="text-blue-100 text-sm mb-4">
                İhaleZeka ile şirketinize uygun kamu ihalelerini AI destekli eşleştirme ile otomatik takip edin.
              </p>
              <a
                href="/sign-up"
                className="inline-block bg-white text-[#2D5BFF] font-bold px-6 py-3 rounded-lg hover:bg-blue-50 transition-colors"
              >
                Ücretsiz Başla
              </a>
            </div>
          </>
        )}
      </div>

      <footer className="bg-[#1a2030] text-gray-400 px-6 py-8 text-center text-sm mt-16">
        <p>© {new Date().getFullYear()} İhaleZeka — Akıllı İhale Takip Platformu</p>
        <p className="mt-2 space-x-4">
          <a href="/" className="hover:text-white transition-colors">Ana Sayfa</a>
          <a href="/blog" className="hover:text-white transition-colors">Blog</a>
          <a href="/gizlilik" className="hover:text-white transition-colors">Gizlilik</a>
          <a href="/kvkk" className="hover:text-white transition-colors">KVKK</a>
        </p>
      </footer>
    </div>
  );
}
