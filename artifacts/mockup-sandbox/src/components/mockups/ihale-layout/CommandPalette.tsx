import { useState } from "react";
import { cn } from "@/lib/utils";

const MOCK = [
  { id: 1, title: "Şehir İçi Yolcu Taşımacılığı Hizmet Alımı", agency: "İstanbul Büyükşehir Belediyesi", city: "İstanbul", type: "Hizmet", budget: 12_500_000, deadline: "2026-07-15", source: "EKAP", score: 91, ikn: "2026/815599" },
  { id: 2, title: "Bilgisayar ve Çevre Birimleri Alımı", agency: "Sağlık Bakanlığı", city: "Ankara", type: "Mal", budget: 4_200_000, deadline: "2026-07-03", source: "EKAP", score: 78, ikn: "2026/892791" },
  { id: 3, title: "Bina Onarım ve Tadilat İşleri", agency: "Milli Eğitim Bakanlığı", city: "İzmir", type: "Yapım", budget: 8_800_000, deadline: "2026-07-22", source: "ilan.gov.tr", score: 65, ikn: "2026/918109" },
  { id: 4, title: "Yazılım Geliştirme ve Bakım Hizmetleri", agency: "Hazine ve Maliye Bakanlığı", city: "Ankara", type: "Hizmet", budget: 6_300_000, deadline: "2026-07-08", source: "EKAP", score: 88, ikn: "2026/863516" },
  { id: 5, title: "Tıbbi Sarf Malzeme Alımı", agency: "Ankara Şehir Hastanesi", city: "Ankara", type: "Mal", budget: 2_950_000, deadline: "2026-07-28", source: "EKAP", score: 72, ikn: "2026/741023" },
  { id: 6, title: "Temizlik Hizmet Alımı", agency: "Enerji ve Tabii Kaynaklar Bakanlığı", city: "Ankara", type: "Hizmet", budget: 1_750_000, deadline: "2026-07-11", source: "EKAP", score: 55, ikn: "2026/728441" },
  { id: 7, title: "Yol Yapım ve Onarım İşi", agency: "Bursa Büyükşehir Belediyesi", city: "Bursa", type: "Yapım", budget: 22_400_000, deadline: "2026-08-01", source: "ilan.gov.tr", score: 60, ikn: "2026/807234" },
  { id: 8, title: "Güvenlik Hizmet Alımı", agency: "Türkiye Kamu Hastaneleri Kurumu", city: "İstanbul", type: "Hizmet", budget: 3_100_000, deadline: "2026-07-19", source: "EKAP", score: 82, ikn: "2026/854901" },
  { id: 9, title: "Veri Merkezi Altyapı Yenileme", agency: "BTK - Bilgi Teknolojileri Kurumu", city: "Ankara", type: "Mal", budget: 15_200_000, deadline: "2026-07-25", source: "EKAP", score: 76, ikn: "2026/912007" },
  { id: 10, title: "Park ve Bahçe Bakım Hizmetleri", agency: "Ankara Büyükşehir Belediyesi", city: "Ankara", type: "Hizmet", budget: 890_000, deadline: "2026-07-04", source: "EKAP", score: 48, ikn: "2026/699123" },
];

const TYPE_COLORS: Record<string, string> = {
  Hizmet: "bg-blue-50 text-blue-700",
  Mal: "bg-purple-50 text-purple-700",
  Yapım: "bg-orange-50 text-orange-700",
};

function fmt(n: number) {
  if (n >= 1_000_000) return `₺${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₺${(n / 1_000).toFixed(0)}K`;
  return `₺${n}`;
}
function daysLeft(d: string) {
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000);
}

export function CommandPalette() {
  const [q, setQ] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [sortCol, setSortCol] = useState<"score" | "budget" | "deadline">("score");
  const [sortAsc, setSortAsc] = useState(false);

  const filtered = MOCK
    .filter(t =>
      (!q || t.title.toLowerCase().includes(q.toLowerCase()) || t.agency.toLowerCase().includes(q.toLowerCase()) || t.ikn.includes(q)) &&
      (!typeFilter || t.type === typeFilter)
    )
    .sort((a, b) => {
      const mul = sortAsc ? 1 : -1;
      if (sortCol === "score") return (a.score - b.score) * mul;
      if (sortCol === "budget") return (a.budget - b.budget) * mul;
      return (new Date(a.deadline).getTime() - new Date(b.deadline).getTime()) * mul;
    });

  const selItem = MOCK.find(t => t.id === selected);

  function ColHeader({ col, label }: { col: typeof sortCol; label: string }) {
    const active = sortCol === col;
    return (
      <button onClick={() => { if (active) setSortAsc(v => !v); else { setSortCol(col); setSortAsc(false); } }}
        className={cn("flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide transition-colors",
          active ? "text-[#2C46D8]" : "text-gray-400 hover:text-gray-600")}
      >
        {label}
        <span className="text-[10px]">{active ? (sortAsc ? "↑" : "↓") : ""}</span>
      </button>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FC] font-sans flex flex-col">
      {/* Top nav */}
      <div className="h-12 bg-[#111827] flex items-center px-6 gap-4 shrink-0">
        <span className="text-white font-bold text-sm">İhale<span className="text-[#6B8EFF]">Zeka</span></span>
        <div className="h-4 w-px bg-white/20 mx-1" />
        <nav className="flex gap-4">
          {["İhale Arama", "Pipeline", "Rakip Analizi", "AI Asistan"].map((n, i) => (
            <button key={n} className={cn("text-xs transition-colors", i === 0 ? "text-white font-medium" : "text-gray-400 hover:text-white")}>{n}</button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-[11px] text-gray-500">8.493 ihale</span>
          <div className="h-7 w-7 rounded-full bg-[#2C46D8] flex items-center justify-center text-white text-xs font-bold">A</div>
        </div>
      </div>

      {/* Search command bar */}
      <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-3 shrink-0">
        <div className="flex-1 relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            autoFocus
            className="w-full pl-10 pr-4 h-10 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2C46D8]/20 focus:border-[#2C46D8] focus:bg-white transition-all"
            placeholder="İhale ara… (başlık, IKN, idare adı)"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
          {q && (
            <button onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>

        {/* Type tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {[null, "Hizmet", "Mal", "Yapım"].map(t => (
            <button key={t ?? "all"} onClick={() => setTypeFilter(t)}
              className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                typeFilter === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700")}
            >
              {t ?? "Tümü"}
            </button>
          ))}
        </div>

        <div className="relative">
          <button onClick={() => setFiltersOpen(v => !v)}
            className={cn("flex items-center gap-2 h-10 px-3 rounded-lg border text-xs font-medium transition-colors",
              filtersOpen ? "bg-[#2C46D8] text-white border-[#2C46D8]" : "bg-white text-gray-700 border-gray-200 hover:border-gray-400")}
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" /></svg>
            Filtreler
          </button>
          {filtersOpen && (
            <div className="absolute right-0 top-12 z-50 w-72 bg-white border border-gray-200 rounded-xl shadow-xl p-4">
              <p className="text-xs font-semibold text-gray-700 mb-3">Gelişmiş Filtreler</p>
              {[["İl", ["Tüm İller", "Ankara", "İstanbul", "İzmir"]], ["Kaynak", ["Tümü", "EKAP", "ilan.gov.tr"]], ["Bütçe", ["Tümü", "0-1M TL", "1-10M TL", "10M+ TL"]]].map(([label, opts]) => (
                <div key={label as string} className="mb-3">
                  <label className="text-[11px] text-gray-500 mb-1 block">{label as string}</label>
                  <select className="w-full h-8 text-xs border border-gray-200 rounded-md px-2 bg-gray-50 focus:outline-none focus:border-[#2C46D8]">
                    {(opts as string[]).map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
              ))}
              <button className="w-full h-8 bg-[#2C46D8] text-white text-xs font-medium rounded-md hover:bg-[#2336C0] transition-colors">Uygula</button>
            </div>
          )}
        </div>

        <span className="text-xs text-gray-400 shrink-0">{filtered.length} sonuç</span>
      </div>

      {/* Table + detail pane */}
      <div className="flex flex-1 overflow-hidden">
        {/* Dense table */}
        <div className={cn("overflow-auto", selItem ? "w-[55%]" : "flex-1")}>
          {/* Column headers */}
          <div className="sticky top-0 bg-gray-50 border-b border-gray-100 px-4 py-2 grid items-center gap-3" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr" }}>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">İhale</span>
            <ColHeader col="score" label="Uyum" />
            <ColHeader col="budget" label="Bütçe" />
            <ColHeader col="deadline" label="Son Tarih" />
          </div>

          {filtered.map(t => {
            const dl = daysLeft(t.deadline);
            const urgent = dl <= 7;
            const isSel = t.id === selected;
            return (
              <div key={t.id} onClick={() => setSelected(isSel ? null : t.id)}
                className={cn("px-4 py-3 grid gap-3 items-center cursor-pointer border-b border-gray-50 transition-all text-sm",
                  isSel ? "bg-[#2C46D8]/5 border-l-2 border-l-[#2C46D8]" : "hover:bg-gray-50")}
                style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr" }}
              >
                <div className="min-w-0">
                  <p className={cn("text-xs font-medium truncate", isSel ? "text-[#2C46D8]" : "text-gray-900")}>{t.title}</p>
                  <p className="text-[11px] text-gray-400 truncate mt-0.5">{t.agency}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className={cn("h-full rounded-full", t.score >= 80 ? "bg-emerald-500" : t.score >= 60 ? "bg-amber-500" : "bg-rose-400")} style={{ width: `${t.score}%` }} />
                  </div>
                  <span className="text-[11px] font-medium text-gray-600">{t.score}%</span>
                </div>
                <span className="text-xs font-semibold text-gray-700 tabular-nums">{fmt(t.budget)}</span>
                <span className={cn("text-xs tabular-nums", urgent ? "text-rose-600 font-medium" : "text-gray-500")}>{urgent ? `⚡ ${dl}g` : `${dl} gün`}</span>
              </div>
            );
          })}
        </div>

        {/* Detail pane */}
        {selItem && (
          <div className="w-[45%] border-l border-gray-100 bg-white overflow-auto">
            <div className="p-5">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <span className={cn("text-[11px] px-2 py-0.5 rounded-md font-medium", TYPE_COLORS[selItem.type] ?? "bg-gray-100 text-gray-600")}>{selItem.type} Alımı</span>
                  <h2 className="text-sm font-semibold text-gray-900 mt-2 leading-snug">{selItem.title}</h2>
                  <p className="text-xs text-gray-500 mt-1">{selItem.agency}</p>
                </div>
                <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 shrink-0">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  ["Uyum Skoru", `${selItem.score}%`],
                  ["Tahmini Bütçe", fmt(selItem.budget)],
                  ["Son Başvuru", selItem.deadline],
                  ["İl", selItem.city],
                  ["IKN", selItem.ikn],
                  ["Kaynak", selItem.source],
                ].map(([k, v]) => (
                  <div key={k} className="bg-gray-50 rounded-lg p-3">
                    <p className="text-[11px] text-gray-400">{k}</p>
                    <p className="text-xs font-semibold text-gray-800 mt-0.5">{v}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <button className="w-full h-9 bg-[#2C46D8] text-white text-xs font-medium rounded-lg hover:bg-[#2336C0] transition-colors">Pipeline'a Ekle</button>
                <button className="w-full h-9 border border-gray-200 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors">EKAP'ta Aç</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CommandPalette;
