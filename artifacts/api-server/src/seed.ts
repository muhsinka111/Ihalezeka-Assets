import { db } from "@workspace/db";
import {
  tendersTable,
  matchesTable,
  pipelineItemsTable,
  companyProfilesTable,
  documentsTable,
  competitorsTable,
} from "@workspace/db";

const BIZ = "demo-business";

async function seed() {
  console.log("Seeding database…");

  // Tenders
  const tenderData = [
    {
      ikn: "2025/123456",
      title: "Ankara İl Milli Eğitim Müdürlüğü Bina Onarım ve Bakım Hizmetleri",
      agencyName: "Ankara İl Milli Eğitim Müdürlüğü",
      agencyLogoUrl: null,
      type: "Hizmet Alımı",
      method: "Açık İhale",
      estimatedValue: 4_850_000,
      deadline: new Date(Date.now() + 14 * 86400_000),
      cpvCodes: ["45000000-7", "50000000-5"],
      il: "Ankara",
      status: "active",
      description: "Okul binalarının periyodik bakım, boyama ve onarım işleri. 3 yıllık sözleşme.",
      qualificationCriteria: [
        "Son 5 yılda en az 2.000.000 TL benzer iş deneyimi",
        "ISO 9001:2015 kalite yönetim sertifikası",
        "En az 15 teknik personel istihdamı",
        "Mesleki sorumluluk sigortası",
      ],
      documentsRequired: ["İş Deneyim Belgesi", "Kapasite Raporu", "Sigorta Poliçesi", "Banka Referans Mektubu"],
      rawDocsUrls: [],
      sourceSystem: "ekap",
    },
    {
      ikn: "2025/234567",
      title: "Sağlık Bakanlığı Bilgi Yönetim Sistemi Yazılım Geliştirme ve Destek Hizmetleri",
      agencyName: "T.C. Sağlık Bakanlığı",
      agencyLogoUrl: null,
      type: "Hizmet Alımı",
      method: "Belli İstekliler Arasında İhale",
      estimatedValue: 12_500_000,
      deadline: new Date(Date.now() + 21 * 86400_000),
      cpvCodes: ["72000000-5", "72200000-7"],
      il: "Ankara",
      status: "active",
      description: "Hastane bilgi yönetim sistemi bakım, güncelleme ve yeni modül geliştirme.",
      qualificationCriteria: [
        "Yazılım geliştirmede 5 yıllık iş deneyimi",
        "ISO 27001 bilgi güvenliği sertifikası",
        "En az 20 yazılım mühendisi",
        "Referans projeler: en az 3 kamu kurumu",
      ],
      documentsRequired: ["Yazılım Referans Listesi", "Personel Listesi", "ISO Sertifikaları"],
      rawDocsUrls: [],
      sourceSystem: "ekap",
    },
    {
      ikn: "2025/345678",
      title: "İstanbul Büyükşehir Belediyesi Temizlik Hizmetleri Alımı",
      agencyName: "İstanbul Büyükşehir Belediyesi",
      agencyLogoUrl: null,
      type: "Hizmet Alımı",
      method: "Açık İhale",
      estimatedValue: 8_200_000,
      deadline: new Date(Date.now() + 7 * 86400_000),
      cpvCodes: ["90600000-3", "90910000-9"],
      il: "İstanbul",
      status: "active",
      description: "Park, bahçe ve kamusal alan temizlik hizmetleri. 12 aylık sözleşme.",
      qualificationCriteria: [
        "Temizlik sektöründe 3 yıllık deneyim",
        "En az 50 çalışan kapasitesi",
        "Çevre yönetim belgesi (ISO 14001)",
      ],
      documentsRequired: ["Kapasite Raporu", "Personel Taahhütnamesi", "Araç Listesi"],
      rawDocsUrls: [],
      sourceSystem: "ekap",
    },
    {
      ikn: "2025/456789",
      title: "Karayolları Genel Müdürlüğü Yol Bakım ve Onarım İşleri",
      agencyName: "Karayolları Genel Müdürlüğü",
      agencyLogoUrl: null,
      type: "Yapım İşleri",
      method: "Açık İhale",
      estimatedValue: 22_400_000,
      deadline: new Date(Date.now() + 30 * 86400_000),
      cpvCodes: ["45233141-9", "45233140-2"],
      il: "Ankara",
      status: "active",
      description: "Devlet karayollarında asfalt yenileme ve köprü bakım işleri.",
      qualificationCriteria: [
        "Yol yapım işinde 10 yıllık deneyim",
        "En az 50.000.000 TL iş deneyim belgesi",
        "Ağır inşaat ekipmanları mülkiyeti",
        "Mühendislik kadrosu",
      ],
      documentsRequired: ["İş Deneyim Belgesi", "Makine Ekipman Listesi", "Teknik Şartname Uyum Beyanı"],
      rawDocsUrls: [],
      sourceSystem: "ekap",
    },
    {
      ikn: "2025/567890",
      title: "Çevre ve Şehircilik Bakanlığı Veri Merkezi Altyapı Modernizasyonu",
      agencyName: "Çevre ve Şehircilik Bakanlığı",
      agencyLogoUrl: null,
      type: "Mal Alımı",
      method: "Açık İhale",
      estimatedValue: 6_750_000,
      deadline: new Date(Date.now() + 18 * 86400_000),
      cpvCodes: ["48820000-2", "32420000-3"],
      il: "Ankara",
      status: "active",
      description: "Sunucu, ağ ekipmanları ve depolama sistemleri alımı.",
      qualificationCriteria: [
        "Teknoloji ürünleri yetkili satıcısı",
        "Teknik servis kapasitesi (7/24)",
        "ISO 20000 hizmet yönetimi sertifikası",
      ],
      documentsRequired: ["Yetkili Satıcı Sertifikası", "Servis Protokolü", "Teknik Şartname"],
      rawDocsUrls: [],
      sourceSystem: "ekap",
    },
    {
      ikn: "2025/678901",
      title: "Hazine ve Maliye Bakanlığı Danışmanlık ve Eğitim Hizmetleri",
      agencyName: "Hazine ve Maliye Bakanlığı",
      agencyLogoUrl: null,
      type: "Hizmet Alımı",
      method: "Pazarlık Usulü",
      estimatedValue: 3_100_000,
      deadline: new Date(Date.now() + 10 * 86400_000),
      cpvCodes: ["73200000-4", "80000000-4"],
      il: "Ankara",
      status: "active",
      description: "Finansal risk yönetimi ve iç denetim eğitim programı.",
      qualificationCriteria: [
        "Mali danışmanlık alanında 7 yıllık deneyim",
        "En az 5 kıdemli uzman istihdam belgesi",
        "Referans: en az 2 bakanlık projesi",
      ],
      documentsRequired: ["Uzman CV'leri", "Referans Mektupları", "Eğitim Programı"],
      rawDocsUrls: [],
      sourceSystem: "ekap",
    },
    {
      ikn: "2025/789012",
      title: "İzmir Büyükşehir Belediyesi Akıllı Ulaşım Sistemi Kurulum ve Entegrasyon",
      agencyName: "İzmir Büyükşehir Belediyesi",
      agencyLogoUrl: null,
      type: "Hizmet Alımı",
      method: "Açık İhale",
      estimatedValue: 18_900_000,
      deadline: new Date(Date.now() + 45 * 86400_000),
      cpvCodes: ["72000000-5", "34970000-7"],
      il: "İzmir",
      status: "active",
      description: "Trafik yönetim sistemi, SCATS entegrasyonu ve gerçek zamanlı izleme platformu.",
      qualificationCriteria: [
        "Akıllı ulaşım sistemleri deneyimi (5+ yıl)",
        "SCATS/SCOOT sistem yetkinliği",
        "Yazılım geliştirme ve sistem entegrasyon kapasitesi",
      ],
      documentsRequired: ["Teknik Yeterlilik Belgesi", "Referans Projeler", "Sistem Tasarım Dokümanı"],
      rawDocsUrls: [],
      sourceSystem: "ekap",
    },
    {
      ikn: "2025/890123",
      title: "MEB Genel Müdürlüğü E-Öğrenme Platformu Geliştirme ve İşletme",
      agencyName: "Milli Eğitim Bakanlığı Genel Müdürlüğü",
      agencyLogoUrl: null,
      type: "Hizmet Alımı",
      method: "Açık İhale",
      estimatedValue: 9_600_000,
      deadline: new Date(Date.now() + 25 * 86400_000),
      cpvCodes: ["72000000-5", "80000000-4"],
      il: "Ankara",
      status: "active",
      description: "Okul öncesi ve ilkokul düzeyinde dijital eğitim platformu geliştirme, içerik üretimi ve teknik destek.",
      qualificationCriteria: [
        "E-öğrenme platform geliştirmede kanıtlanmış deneyim",
        "SCORM/xAPI uyumlu içerik üretimi",
        "Güvenli çocuk veri koruma protokolleri (KVKK uyumu)",
      ],
      documentsRequired: ["Platform Demo", "Güvenlik Denetim Raporu", "KVKK Uyum Belgesi"],
      rawDocsUrls: [],
      sourceSystem: "ekap",
    },
  ];

  const inserted = await db.insert(tendersTable).values(tenderData).onConflictDoNothing().returning();
  console.log(`Inserted ${inserted.length} tenders`);

  const tenders = inserted.length > 0 ? inserted : await db.select().from(tendersTable).limit(8);

  // Matches
  const fitScores = [88, 92, 72, 45, 81, 67, 53, 76];
  const statuses = ["new", "new", "pipeline", "new", "pipeline", "watching", "new", "new"];
  const matchData = tenders.slice(0, 8).map((t, i) => ({
    businessId: BIZ,
    tenderId: t.id,
    fitScore: fitScores[i] ?? 70,
    reasoning: `Şirket profiliniz bu ihale için ${fitScores[i] ?? 70}/100 uyum skoru aldı. CPV kodları örtüşmekte ve il tercihlerinizle uyumlu.`,
    pros: ["CPV kod eşleşmesi güçlü", "İl tercihinizle uyumlu", "Tahmini değer bütçenize uygun"],
    risks: ["Rekabetçi ihale — birden fazla güçlü rakip bekleniyor", "Kısa teklif hazırlık süresi"],
    status: statuses[i] ?? "new",
  }));

  const insertedMatches = await db.insert(matchesTable).values(matchData).onConflictDoNothing().returning();
  console.log(`Inserted ${insertedMatches.length} matches`);

  // Pipeline
  const stages = ["preparation", "applied", "evaluation", "discovery", "won"];
  const pipelineData = tenders.slice(0, 5).map((t, i) => ({
    businessId: BIZ,
    tenderId: t.id,
    stage: stages[i] ?? "discovery",
    notes: null,
  }));

  const insertedPipeline = await db.insert(pipelineItemsTable).values(pipelineData).onConflictDoNothing().returning();
  console.log(`Inserted ${insertedPipeline.length} pipeline items`);

  // Company Profile
  const existing = await db.select().from(companyProfilesTable).limit(1);
  if (existing.length === 0) {
    await db.insert(companyProfilesTable).values({
      businessId: BIZ,
      companyName: "Teknova Bilişim A.Ş.",
      taxNumber: "1234567890",
      mersisNumber: "0123456789000001",
      ekapNumber: "TR-2019-00123456",
      naceCodes: ["62.01", "62.02", "62.09"],
      cpvCodes: ["72000000-5", "72200000-7", "72300000-8"],
      experienceCeiling: 25_000_000,
      certifications: ["ISO 9001:2015", "ISO 27001:2013", "ISO 20000-1:2018"],
      personnelCount: 42,
      annualRevenue: 18_500_000,
      preferredProvinces: ["Ankara", "İstanbul", "İzmir"],
      excludedProvinces: [],
      discountStrategy: "Standart kırım: %8-12 arası. Mali yeterlilik sınırında %5'e kadar esneklik.",
      automationEnabled: false,
      completionStep: 4,
    });
    console.log("Inserted company profile");
  }

  // Documents
  const docsCount = await db.select().from(documentsTable).limit(1);
  if (docsCount.length === 0) {
    await db.insert(documentsTable).values([
      { businessId: BIZ, name: "Vergi Levhası 2025", folder: "Mali Belgeler", fileUrl: null, validUntil: "2026-01-01", status: "valid" },
      { businessId: BIZ, name: "Ticaret Sicil Gazetesi", folder: "Yasal Belgeler", fileUrl: null, validUntil: "2026-12-31", status: "valid" },
      { businessId: BIZ, name: "İmza Sirküleri", folder: "Yasal Belgeler", fileUrl: null, validUntil: "2025-12-31", status: "expiring_soon" },
      { businessId: BIZ, name: "SGK Borcu Yoktur Yazısı", folder: "Mali Belgeler", fileUrl: null, validUntil: "2025-07-15", status: "expiring_soon" },
      { businessId: BIZ, name: "ISO 9001:2015 Sertifikası", folder: "Sertifikalar", fileUrl: null, validUntil: "2026-06-30", status: "valid" },
      { businessId: BIZ, name: "ISO 27001:2013 Sertifikası", folder: "Sertifikalar", fileUrl: null, validUntil: "2025-09-15", status: "expiring_soon" },
      { businessId: BIZ, name: "Kapasite Raporu 2025", folder: "Kapasite Belgeleri", fileUrl: null, validUntil: "2026-03-31", status: "valid" },
      { businessId: BIZ, name: "Banka Referans Mektubu", folder: "Mali Belgeler", fileUrl: null, validUntil: "2025-06-30", status: "expired" },
      { businessId: BIZ, name: "İş Deneyim Belgesi (Sağlık Bakanlığı)", folder: "İş Deneyim Belgeleri", fileUrl: null, validUntil: null, status: "valid" },
      { businessId: BIZ, name: "Yazılım Referans Listesi 2024", folder: "İş Deneyim Belgeleri", fileUrl: null, validUntil: null, status: "valid" },
    ]);
    console.log("Inserted documents");
  }

  // Competitors
  const compCount = await db.select().from(competitorsTable).limit(1);
  if (compCount.length === 0) {
    await db.insert(competitorsTable).values([
      { businessId: BIZ, name: "Teknik Yazılım A.Ş.", wonTenders: 28, avgDiscountRate: 11.4, encounters: 42 },
      { businessId: BIZ, name: "Bilge Teknoloji Ltd.", wonTenders: 19, avgDiscountRate: 8.7, encounters: 31 },
      { businessId: BIZ, name: "Sistem Çözümleri A.Ş.", wonTenders: 35, avgDiscountRate: 14.2, encounters: 58 },
      { businessId: BIZ, name: "InfoTech Danışmanlık", wonTenders: 12, avgDiscountRate: 6.3, encounters: 18 },
      { businessId: BIZ, name: "Dijital Yol A.Ş.", wonTenders: 22, avgDiscountRate: 9.8, encounters: 29 },
      { businessId: BIZ, name: "Proje Merkezi Ltd.", wonTenders: 8, avgDiscountRate: 5.1, encounters: 14 },
    ]);
    console.log("Inserted competitors");
  }

  console.log("Seeding complete.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
