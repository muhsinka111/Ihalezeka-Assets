import { useState } from "react";
import { cn } from "@/lib/utils";

const MOCK = [
  { id: 1, title: "Şehir İçi Yolcu Taşımacılığı Hizmet Alımı", agency: "İstanbul Büyükşehir Belediyesi", city: "İstanbul", type: "Hizmet Alımı", budget: 12_500_000, deadline: "2026-07-15", source: "EKAP", score: 91, accentColor: "border-blue-500", sector: "Ulaşım" },
  { id: 2, title: "Bilgisayar ve Çevre Birimleri Alımı", agency: "Sağlık Bakanlığı", city: "Ankara", type: "Mal Alımı", budget: 4_200_000, deadline: "2026-07-03", source: "EKAP", score: 78, accentColor: "border-purple-500", sector: "Teknoloji" },
  { id: 3, title: "Bina Onarım ve Tadilat İşleri", agency: "Milli Eğitim Bakanlığı", city: "İzmir", type: "Yapım İşi", budget: 8_800_000, deadline: "2026-07-22", source: "ilan.gov.tr", score: 65, accentColor: "border-orange-500", sector: "İnşaat" },
  { id: 4, title: "Yazılım Geliştirme ve Bakım Hizmetleri", agency: "Hazine ve Maliye Bakanlığı", city: "Ankara", type: "Hizmet Alımı", budget: 6_300_000, deadline: "2026-07-08", source: "EKAP", score: 88, accentColor: "border-blue-500", sector: "Teknoloji" },
  { id: 5, title: "Tıbbi Sarf Malzeme Alımı", agency: "Ankara Şehir Hastanesi", city: "Ankara", type: "Mal Alımı", budget: 2_950_000, deadline: "2026-07-28", source: "EKAP", score: 72, accentColor: "border-purple-500", sector: "Sağlık" },
  { id: 6, title: "Temizlik Hizmet Alımı", agency: "Enerji ve Tabii Kaynaklar Bakanlığı", city: "Ankara", type: "Hizmet Alımı", budget: 1_750_000, deadline: "2026-07-11", source: "EKAP", score: 55, accentColor: "border-blue-500", sector: "Hizmet" },
  { id: 7, title: "Yol Yapım ve Onarım İşi", agency: "Bursa Büyükşehir Belediyesi", city: "Bursa", type: "Yapım İşi", budget: 22_400_000, deadline: "2026-08-01", source: "ilan.gov.tr", score: 60, accentColor: "border-orange-500", sector: "İnşaat" },
  { id: 8, title: "Güvenlik Hizmet Alımı", agency: "Türkiye Kamu Hastaneleri Kurumu", city: "İstanbul", type: "Hizmet Alımı", budget: 3_100_000, deadline: "2026-07-19", source: "EKAP", score: 82, accentColor: "border-blue-500", sector: "Güvenlik" },
];

const SECTORS = ["Tümü", "Teknoloji", "İnşaat", "Sağlık", "Ulaşım", "Hizmet", "Güvenlik"];
const CITIES = ["Tüm İller", "Ankara", "İstanbul", "İzmir", "Bursa"];

function fmt(n: number) {
  if (n >= 1_000_000) return `₺${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₺${(n / 1_000).toFixed(0)}K`;
  return `₺${n}`;
}
function daysLeft(d: string) {
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000);
}

function ScoreRing({ score }: { score: number }) {
  const r = 18;
  const circ = 2 * Math.PI * r;
  const fill = circ * (1 - score / 100);
  const color = score >= 80 ? "#10B981" : score >= 60 ? "#F59E0B" : "#EF4444";
  return (
    <div className="relative h-12 w-12 shrink-0">
      <svg className="h-12 w-12 -rotate-90">
        <circle cx="24" cy="24" r={r} fill="none" stroke="#F3F4F6" strokeWidth="4" />
        <circle cx="24" cy="24" r={r} fill="none" stroke={color} strokeWidth="4" strokeDasharray={circ} strokeDashoffset={fill} strokeLinecap="round" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold" style={{ color }}>{score}</span>
    </div>
  );
}

export function GridCards() {
  const [q, setQ] = useState("");
  const [sector, setSector] = useState("Tümü");
  const [city, setCity] = useState("Tüm İller");
  const [view, setView] = useState<"grid" | "list">("grid");

  const filtered = MOCK.filter(t =>
    (!q || t.title.toLowerCase().includes(q.toLowerCase()) || t.agency.toLowerCase().includes(q.toLowerCase())) &&
    (sector === "Tümü" || t.sector === sector) &&
    (city === "Tüm İller" || t.city === city)
  );

  return (
    <div className="min-h-screen bg-gray-50 font-sans flex">
      {/* Narrow sidebar */}
      <aside className="w-52 shrink-0 bg-white border-r border-gray-100 flex flex-col">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-1 mb-4">
            <span className="font-bold text-gray-900 text-sm">İhale</span>
            <span className="font-bold text-[#2C46D8] text-sm">Zeka</span>
          </div>
          <nav className="space-y-1">
            {[
              ["İhale Arama", "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z", true],
              ["Pipeline", "M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2", false],
              ["Rakip Analizi", "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0", false],
              ["AI Asistan", "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z", false],
            ].map(([label, path, active]) => (
              <button key={label as string}
                className={cn("w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                  active ? "bg-[#2C46D8]/10 text-[#2C46D8]" : "text-gray-500 hover:bg-gray-50 hover:text-gray-700")}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={path as string} /></svg>
                {label as string}
              </button>
            ))}
          </nav>
        </div>

        {/* Sector filter */}
        <div className="p-4 flex-1 overflow-auto">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Sektör</p>
          <div className="space-y-0.5">
            {SECTORS.map(s => (
              <button key={s} onClick={() => setSector(s)}
                className={cn("w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors font-medium",
                  sector === s ? "bg-[#2C46D8] text-white" : "text-gray-600 hover:bg-gray-50")}
              >
                {s}
              </button>
            ))}
          </div>

          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2 mt-5">İl</p>
          <div className="space-y-0.5">
            {CITIES.map(c => (
              <button key={c} onClick={() => setCity(c)}
                className={cn("w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors",
                  city === c ? "bg-[#2C46D8] text-white font-medium" : "text-gray-600 hover:bg-gray-50")}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="mt-5 p-3 bg-[#2C46D8]/5 rounded-xl border border-[#2C46D8]/10">
            <p className="text-[11px] text-[#2C46D8] font-semibold mb-1">Kaynak durumu</p>
            <div className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /><span className="text-[11px] text-gray-600">EKAP — Çalışıyor</span></div>
            <div className="flex items-center gap-1.5 mt-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /><span className="text-[11px] text-gray-600">ilan.gov.tr — Çalışıyor</span></div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <div className="bg-white border-b border-gray-100 px-5 py-3 flex items-center gap-3 shrink-0">
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input className="w-full pl-9 pr-4 h-9 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#2C46D8] focus:bg-white"
              placeholder="Ara…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <div className="flex border border-gray-200 rounded-lg overflow-hidden">
            <button onClick={() => setView("grid")} className={cn("h-9 w-9 flex items-center justify-center transition-colors", view === "grid" ? "bg-[#2C46D8] text-white" : "bg-white text-gray-400 hover:text-gray-600")}>
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 16 16"><rect x="1" y="1" width="6" height="6" rx="1" /><rect x="9" y="1" width="6" height="6" rx="1" /><rect x="1" y="9" width="6" height="6" rx="1" /><rect x="9" y="9" width="6" height="6" rx="1" /></svg>
            </button>
            <button onClick={() => setView("list")} className={cn("h-9 w-9 flex items-center justify-center transition-colors border-l border-gray-200", view === "list" ? "bg-[#2C46D8] text-white" : "bg-white text-gray-400 hover:text-gray-600")}>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
            </button>
          </div>
          <span className="text-xs text-gray-400">{filtered.length} ihale</span>
        </div>

        {/* Grid / List */}
        <div className="flex-1 overflow-auto p-5">
          {view === "grid" ? (
            <div className="grid grid-cols-2 gap-3">
              {filtered.map(t => {
                const dl = daysLeft(t.deadline);
                const urgent = dl <= 7;
                return (
                  <div key={t.id} className={cn("bg-white rounded-xl border-l-4 border border-gray-100 hover:shadow-md transition-all cursor-pointer p-4 flex flex-col gap-3", t.accentColor)}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-900 leading-snug line-clamp-2">{t.title}</p>
                        <p className="text-[11px] text-gray-400 mt-1 truncate">{t.agency}</p>
                      </div>
                      <ScoreRing score={t.score} />
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{t.city}</span>
                      <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{t.type}</span>
                      <span className="text-[10px] bg-gray-50 text-gray-500 px-2 py-0.5 rounded-full border border-gray-200">{t.source}</span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                      <span className="text-sm font-bold text-gray-900">{fmt(t.budget)}</span>
                      <span className={cn("text-[11px] font-medium", urgent ? "text-rose-600" : "text-gray-400")}>
                        {urgent ? `⚡ ${dl} gün kaldı` : `${dl} gün`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(t => {
                const dl = daysLeft(t.deadline);
                return (
                  <div key={t.id} className={cn("bg-white rounded-xl border-l-4 border border-gray-100 hover:shadow-sm transition-all cursor-pointer flex items-center gap-4 px-4 py-3", t.accentColor)}>
                    <ScoreRing score={t.score} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-900 truncate">{t.title}</p>
                      <p className="text-[11px] text-gray-400 truncate">{t.agency} • {t.city}</p>
                    </div>
                    <span className="text-sm font-bold text-gray-800 shrink-0">{fmt(t.budget)}</span>
                    <span className="text-[11px] text-gray-400 shrink-0">{dl}g</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default GridCards;
