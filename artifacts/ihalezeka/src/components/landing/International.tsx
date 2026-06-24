const ORGS = [
  "Dünya Bankası",
  "AB / TED",
  "EBRD",
  "BM / UNGM",
  "AIIB",
  "İslam Kalkınma Bankası",
];

export function International() {
  return (
    <section id="uluslararasi" className="py-24 bg-card border-t border-border">
      <div className="container mx-auto px-6 md:px-12">
        <div className="max-w-3xl mx-auto text-center">
          <span className="inline-block text-xs font-semibold tracking-wider uppercase text-primary bg-primary/10 px-3 py-1 rounded-full mb-5">
            Yakında · Kurumsal
          </span>
          <h2 className="text-3xl md:text-4xl font-bold font-heading text-foreground mb-5">
            Sınırların ötesindeki ihaleler
          </h2>
          <p className="text-muted-foreground text-lg leading-relaxed mb-10">
            Dünya Bankası, Avrupa Birliği (TED), EBRD ve Birleşmiş Milletler gibi
            kurumların milyarlarca dolarlık uluslararası ihalelerini Türk firmalarının
            radarına alıyoruz. Uluslararası ihale takibi İhaleZeka Kurumsal ile yakında.
          </p>

          <div className="flex flex-wrap justify-center gap-3 mb-10">
            {ORGS.map((org) => (
              <span
                key={org}
                className="text-sm font-medium text-foreground bg-background border border-border rounded-lg px-4 py-2"
              >
                {org}
              </span>
            ))}
          </div>

          <a
            href="/uluslararasi-ihaleler"
            className="inline-flex items-center gap-2 text-primary font-semibold hover:underline"
          >
            Uluslararası ihaleler hakkında daha fazlası
            <span aria-hidden="true">→</span>
          </a>
        </div>
      </div>
    </section>
  );
}
