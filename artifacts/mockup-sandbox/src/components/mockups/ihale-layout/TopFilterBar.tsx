import { useState } from "react";
import { cn } from "@/lib/utils";

const MOCK = [
  { id: 1, title: "Şehir İçi Yolcu Taşımacılığı Hizmet Alımı", agency: "İstanbul Büyükşehir Belediyesi", city: "İstanbul", type: "Hizmet Alımı", budget: 12_500_000, deadline: "2026-07-15", source: "EKAP", status: "active", score: 91 },
  { id: 2, title: "Bilgisayar ve Çevre Birimleri Alımı", agency: "Sağlık Bakanlığı", city: "Ankara", type: "Mal Alımı", budget: 4_200_000, deadline: "2026-07-03", source: "EKAP", status: "active", score: 78 },
  { id: 3, title: "Bina Onarım ve Tadilat İşleri", agency: "Milli Eğitim Bakanlığı", city: "İzmir", type: "Yapım İşi", budget: 8_800_000, deadline: "2026-07-22", source: "ilan.gov.tr", status: "active", score: 65 },
  { id: 4, title: "Yazılım Geliştirme ve Bakım Hizmetleri", agency: "Hazine ve Maliye Bakanlığı", city: "Ankara", type: "Hizmet Alımı", budget: 6_300_000, deadline: "2026-07-08", source: "EKAP", status: "active", score: 88 },
  { id: 5, title: "Tıbbi Sarf Malzeme Alımı", agency: "Ankara Şehir Hastanesi", city: "Ankara", type: "Mal Alımı", budget: 2_950_000, deadline: "2026-07-28", source: "EKAP", status: "active", score: 72 },
  { id: 6, title: "Temizlik Hizmet Alımı", agency: "Enerji ve Tabii Kaynaklar Bakanlığı", city: "Ankara", type: "Hizmet Alımı", budget: 1_750_000, deadline: "2026-07-11", source: "EKAP", status: "active", score: 55 },
  { id: 7, title: "Yol Yapım ve Onarım İşi", agency: "Bursa Büyükşehir Belediyesi", city: "Bursa", type: "Yapım İşi", budget: 22_400_000, deadline: "2026-08-01", source: "ilan.gov.tr", status: "active", score: 60 },
  { id: 8, title: "Güvenlik Hizmet Alımı", agency: "Türkiye Kamu Hastaneleri Kurumu", city: "İstanbul", type: "Hizmet Alımı", budget: 3_100_000, deadline: "2026-07-19", source: "EKAP", status: "active", score: 82 },
];

const TYPES = ["Tüm Türler", "Hizmet Alımı", "Mal Alımı", "Yapım İşi"];
const CITIES = ["Tüm İller", "Ankara", "İstanbul", "İzmir", "Bursa", "Antalya"];
const SOURCES = ["Tüm Kaynaklar", "EKAP", "ilan.gov.tr", "TÜBİTAK", "KOSGEB"];
const SORTS = ["En Yüksek Uyum", "Son Başvuru (Yakın)", "En Yüksek Bütçe"];

function fmt(n: number) {
  if (n >= 1_000_000) return `₺${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₺${(n / 1_000).toFixed(0)}K`;
  return `₺${n}`;
}
function daysLeft(d: string) {
  const ms = new Date(d).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

function ScoreBadge({ s }: { s: number }) {
  const color = s >= 80 ? "bg-emerald-100 text-emerald-700" : s >= 60 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700";
  return <span className={cn("text-[11px] font-semibold px-1.5 py-0.5 rounded-full shrink-0", color)}>{s}%</span>;
}

function FilterPill({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const active = value !== options[0];
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          "flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium border transition-all",
          active ? "bg-[#2C46D8] text-white border-[#2C46D8]" : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
        )}
      >
        {active ? value : label}
        <svg className="h-3.5 w-3.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && (
        <div className="absolute top-10 left-0 z-50 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
          {options.map(o => (
            <button key={o} onClick={() => { onChange(o); setOpen(false); }}
              className={cn("w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition-colors",
                value === o && "font-medium text-[#2C46D8]")}
            >{o}</button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TopFilterBar() {
  const [q, setQ] = useState("");
  const [type, setType] = useState(TYPES[0]);
  const [city, setCity] = useState(CITIES[0]);
  const [source, setSource] = useState(SOURCES[0]);
  const [sort, setSort] = useState(SORTS[0]);

  const filtered = MOCK.filter(t =>
    (!q || t.title.toLowerCase().includes(q.toLowerCase()) || t.agency.toLowerCase().includes(q.toLowerCase())) &&
    (type === TYPES[0] || t.type === type) &&
    (city === CITIES[0] || t.city === city) &&
    (source === SOURCES[0] || t.source === source)
  );

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 py-3">
          {/* Logo + Search row */}
          <div className="flex items-center gap-4 mb-3">
            <div className="flex items-center gap-1 shrink-0">
              <span className="font-bold text-gray-900">İhale</span>
              <span className="font-bold text-[#2C46D8]">Zeka</span>
            </div>
            <div className="flex-1 relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input
                className="w-full pl-10 pr-4 h-10 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#2C46D8] focus:bg-white transition-all"
                placeholder="İhale başlığı, idare adı veya anahtar kelime…"
                value={q}
                onChange={e => setQ(e.target.value)}
              />
            </div>
            <button className="shrink-0 h-10 px-4 bg-[#2C46D8] text-white text-sm font-medium rounded-xl hover:bg-[#2336C0] transition-colors">
              Ara
            </button>
          </div>

          {/* Horizontal filter pills row */}
          <div className="flex items-center gap-2 flex-wrap">
            <FilterPill label="İhale Türü" options={TYPES} value={type} onChange={setType} />
            <FilterPill label="İl" options={CITIES} value={city} onChange={setCity} />
            <FilterPill label="Kaynak" options={SOURCES} value={source} onChange={setSource} />
            <div className="h-5 w-px bg-gray-200 mx-1" />
            <FilterPill label="Sıralama" options={SORTS} value={sort} onChange={setSort} />
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-gray-400">• Kaynak durumu: Normal</span>
              <span className="text-xs font-medium text-gray-500">{filtered.length.toLocaleString("tr-TR")} ihale</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-5">
        <div className="space-y-2">
          {filtered.map(t => {
            const dl = daysLeft(t.deadline);
            const urgent = dl <= 7;
            return (
              <div key={t.id} className="bg-white rounded-xl border border-gray-100 hover:border-[#2C46D8]/30 hover:shadow-sm transition-all p-4 flex items-center gap-4 cursor-pointer group">
                {/* Score */}
                <div className="flex flex-col items-center gap-1 shrink-0 w-12">
                  <ScoreBadge s={t.score} />
                  <span className="text-[10px] text-gray-400">uyum</span>
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-[#2C46D8] transition-colors">{t.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{t.agency}</p>
                </div>

                {/* Meta pills */}
                <div className="hidden md:flex items-center gap-2 shrink-0">
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-gray-100 text-gray-600">{t.city}</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-blue-50 text-blue-700">{t.type}</span>
                </div>

                {/* Budget */}
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-gray-900">{fmt(t.budget)}</p>
                  <p className={cn("text-[11px] mt-0.5", urgent ? "text-rose-600 font-medium" : "text-gray-400")}>
                    {urgent ? `⚡ ${dl}g kaldı` : `${dl} gün`}
                  </p>
                </div>

                {/* Source */}
                <div className="shrink-0 flex items-center gap-2">
                  <span className="text-[11px] px-2 py-1 rounded-md border border-gray-200 text-gray-500">{t.source}</span>
                  <button className="h-8 w-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:text-[#2C46D8] hover:border-[#2C46D8] transition-colors opacity-0 group-hover:opacity-100">
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="py-20 text-center text-gray-400 text-sm">
            Arama kriterlerinize uygun ihale bulunamadı.
          </div>
        )}
      </div>
    </div>
  );
}

export default TopFilterBar;
