import { Router } from "express";
import { SITE_URL } from "../lib/site.js";
import { escHtml, pageShell } from "../lib/ssrShell.js";

const router = Router();

const UPDATED = "Haziran 2026";

function metaTags(opts: {
  title: string;
  description: string;
  path: string;
  index?: boolean;
}): string {
  const robots = opts.index === false ? "noindex, follow" : "index, follow";
  return `
      <meta name="description" content="${escHtml(opts.description)}"/>
      <meta name="robots" content="${robots}"/>
      <meta property="og:type" content="website"/>
      <meta property="og:site_name" content="İhaleZeka"/>
      <meta property="og:locale" content="tr_TR"/>
      <meta property="og:title" content="${escHtml(opts.title)}"/>
      <meta property="og:description" content="${escHtml(opts.description)}"/>
      <meta property="og:url" content="${SITE_URL}${opts.path}"/>
      <meta property="og:image" content="${SITE_URL}/opengraph.jpg"/>
      <meta name="twitter:card" content="summary_large_image"/>
      <meta name="twitter:title" content="${escHtml(opts.title)}"/>
      <meta name="twitter:image" content="${SITE_URL}/opengraph.jpg"/>
      <link rel="canonical" href="${SITE_URL}${opts.path}"/>`;
}

function articleJsonLd(opts: { title: string; description: string; path: string }): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: opts.title,
    description: opts.description,
    url: `${SITE_URL}${opts.path}`,
    inLanguage: "tr-TR",
    isPartOf: { "@type": "WebSite", name: "İhaleZeka", url: `${SITE_URL}/` },
    publisher: {
      "@type": "Organization",
      name: "İhaleZeka",
      logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.png` },
    },
  });
}

function send(
  res: import("express").Response,
  opts: { title: string; pageTitle: string; description: string; path: string; content: string; index?: boolean },
) {
  const meta = metaTags({ title: opts.title, description: opts.description, path: opts.path, index: opts.index });
  const jsonLd = articleJsonLd({ title: opts.title, description: opts.description, path: opts.path });
  const body = `
    <div class="container">
      <h1>${escHtml(opts.pageTitle)}</h1>
      <div class="meta"><span>Son güncelleme: ${UPDATED}</span></div>
      <div class="content">${opts.content}</div>
    </div>`;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(pageShell(opts.title, meta, body, jsonLd));
}

/* ---------------------------------------------------------------- Gizlilik */
router.get("/gizlilik", (_req, res) => {
  const content = `
    <p>İhaleZeka olarak gizliliğinize önem veriyoruz. Bu Gizlilik Politikası, İhaleZeka platformunu (bundan sonra "Platform") kullandığınızda hangi kişisel verilerinizi topladığımızı, bu verileri nasıl kullandığımızı, kimlerle paylaştığımızı ve haklarınızı açıklar.</p>

    <h2>1. Topladığımız Veriler</h2>
    <p>Platform'u kullanırken aşağıdaki kategorilerde veriler işlenebilir:</p>
    <ul>
      <li><strong>Hesap bilgileri:</strong> Ad, soyad, e-posta adresi ve oturum açma bilgileri.</li>
      <li><strong>Şirket profili:</strong> Faaliyet alanı, NACE/ürün kategorileri, hedef ihale türleri gibi eşleştirme için sağladığınız bilgiler.</li>
      <li><strong>Kullanım verileri:</strong> Platform içindeki aramalar, kaydedilen ihaleler, tercihler ve etkileşimler.</li>
      <li><strong>Teknik veriler:</strong> IP adresi, tarayıcı türü, cihaz bilgisi ve çerez verileri.</li>
      <li><strong>Ödeme verileri:</strong> Abonelik işlemleri ödeme hizmet sağlayıcımız (Stripe) üzerinden yürütülür; kart bilgileriniz İhaleZeka sunucularında saklanmaz.</li>
    </ul>

    <h2>2. Verileri Kullanma Amaçlarımız</h2>
    <ul>
      <li>Size uygun kamu ihalelerini yapay zeka destekli eşleştirme ile sunmak,</li>
      <li>Hesabınızı oluşturmak, yönetmek ve güvenliğini sağlamak,</li>
      <li>Bildirim, hatırlatma ve hizmetle ilgili e-postaları göndermek,</li>
      <li>Abonelik ve ödeme süreçlerini yürütmek,</li>
      <li>Platform'u geliştirmek ve performansı ölçmek,</li>
      <li>Yasal yükümlülüklerimizi yerine getirmek.</li>
    </ul>

    <h2>3. Veri Paylaşımı</h2>
    <p>Kişisel verileriniz yalnızca hizmetin sunulması için gerekli olduğu ölçüde, gizlilik yükümlülüğü altındaki hizmet sağlayıcılarımızla (örneğin barındırma, e-posta gönderimi ve ödeme altyapısı) paylaşılır. Verileriniz pazarlama amacıyla üçüncü taraflara satılmaz.</p>

    <h2 id="cerez">4. Çerez (Cookie) Politikası</h2>
    <p>Platform, oturumunuzu sürdürmek, tercihlerinizi hatırlamak ve kullanım istatistiklerini ölçmek için çerezler kullanır. Çerez türleri:</p>
    <ul>
      <li><strong>Zorunlu çerezler:</strong> Oturum açma ve güvenlik için gereklidir, devre dışı bırakılamaz.</li>
      <li><strong>İşlevsel çerezler:</strong> Dil ve görünüm gibi tercihlerinizi hatırlar.</li>
      <li><strong>Analitik çerezler:</strong> Platform'un nasıl kullanıldığını anlamamıza yardımcı olur.</li>
    </ul>
    <p>Tarayıcı ayarlarınızdan çerezleri yönetebilir veya silebilirsiniz; ancak zorunlu çerezlerin engellenmesi bazı özelliklerin çalışmamasına yol açabilir.</p>

    <h2>5. Veri Güvenliği ve Saklama</h2>
    <p>Verilerinizi yetkisiz erişime karşı korumak için makul teknik ve idari tedbirler uygularız. Kişisel verileriniz, işleme amaçlarının gerektirdiği süre boyunca ve ilgili mevzuatta öngörülen süreler kadar saklanır.</p>

    <h2>6. Haklarınız</h2>
    <p>6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamındaki haklarınızı kullanmak için <a href="${SITE_URL}/kvkk">KVKK Aydınlatma Metni</a> sayfamızı inceleyebilirsiniz.</p>

    <h2>7. İletişim</h2>
    <p>Gizlilikle ilgili sorularınız için bizimle <a href="mailto:info@ihalezeka.com">info@ihalezeka.com</a> adresinden iletişime geçebilirsiniz.</p>

    <p>Bu politika zaman zaman güncellenebilir. Önemli değişikliklerde Platform üzerinden bilgilendirme yapılır.</p>`;

  send(res, {
    title: "Gizlilik Politikası | İhaleZeka",
    pageTitle: "Gizlilik Politikası",
    description: "İhaleZeka gizlilik politikası: hangi kişisel verileri topladığımız, nasıl kullandığımız, çerez politikası ve haklarınız hakkında bilgi.",
    path: "/gizlilik",
    content,
  });
});

/* -------------------------------------------------------------------- KVKK */
router.get("/kvkk", (_req, res) => {
  const content = `
    <p>İşbu Aydınlatma Metni, 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") kapsamında, İhaleZeka tarafından veri sorumlusu sıfatıyla, kişisel verilerinizin işlenmesine ilişkin olarak sizleri bilgilendirmek amacıyla hazırlanmıştır.</p>

    <h2>1. Veri Sorumlusu</h2>
    <p>Kişisel verileriniz, veri sorumlusu olarak İhaleZeka tarafından aşağıda açıklanan kapsamda işlenmektedir. İletişim: <a href="mailto:info@ihalezeka.com">info@ihalezeka.com</a>.</p>

    <h2>2. İşlenen Kişisel Veriler</h2>
    <ul>
      <li><strong>Kimlik ve iletişim verileri:</strong> ad, soyad, e-posta.</li>
      <li><strong>Müşteri işlem verileri:</strong> şirket profili, ihale tercihleri, aramalar, kaydedilen ihaleler.</li>
      <li><strong>İşlem güvenliği verileri:</strong> IP adresi, oturum kayıtları, çerez verileri.</li>
      <li><strong>Finansal veriler:</strong> abonelik ve fatura bilgileri (kart bilgileri ödeme sağlayıcı nezdinde işlenir).</li>
    </ul>

    <h2>3. Kişisel Verilerin İşlenme Amaçları</h2>
    <ul>
      <li>Hizmetin sunulması ve yapay zeka destekli ihale eşleştirmesinin sağlanması,</li>
      <li>Üyelik ve sözleşme süreçlerinin yürütülmesi,</li>
      <li>İletişim ve bildirim faaliyetlerinin gerçekleştirilmesi,</li>
      <li>Bilgi güvenliği süreçlerinin yürütülmesi,</li>
      <li>Yasal yükümlülüklerin yerine getirilmesi.</li>
    </ul>

    <h2>4. Hukuki Sebepler (KVKK m.5)</h2>
    <p>Kişisel verileriniz; bir sözleşmenin kurulması veya ifası için gerekli olması, hukuki yükümlülüğün yerine getirilmesi, ilgili kişinin temel hak ve özgürlüklerine zarar vermemek kaydıyla meşru menfaat ve gerektiğinde açık rızanız hukuki sebeplerine dayanılarak işlenmektedir.</p>

    <h2>5. Kişisel Verilerin Aktarılması</h2>
    <p>Kişisel verileriniz, hizmetin sağlanması amacıyla barındırma, e-posta ve ödeme altyapısı sağlayıcıları gibi tedarikçilerimize ve yasal olarak yetkili kamu kurum ve kuruluşlarına KVKK m.8 ve m.9'a uygun şekilde aktarılabilir.</p>

    <h2>6. Veri Toplama Yöntemi</h2>
    <p>Kişisel verileriniz; Platform'a kayıt, profil oluşturma, Platform kullanımı ve çerezler gibi otomatik ve kısmen otomatik yöntemlerle elektronik ortamda toplanmaktadır.</p>

    <h2>7. İlgili Kişinin Hakları (KVKK m.11)</h2>
    <p>KVKK'nın 11. maddesi uyarınca şu haklara sahipsiniz:</p>
    <ul>
      <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme,</li>
      <li>İşlenmişse buna ilişkin bilgi talep etme,</li>
      <li>İşlenme amacını ve amaca uygun kullanılıp kullanılmadığını öğrenme,</li>
      <li>Yurt içinde/yurt dışında aktarıldığı üçüncü kişileri bilme,</li>
      <li>Eksik veya yanlış işlenmişse düzeltilmesini isteme,</li>
      <li>Şartları oluştuğunda silinmesini veya yok edilmesini isteme,</li>
      <li>Düzeltme/silme işlemlerinin aktarıldığı üçüncü kişilere bildirilmesini isteme,</li>
      <li>Münhasıran otomatik analiz sonucu aleyhinize bir sonucun ortaya çıkmasına itiraz etme,</li>
      <li>Kanuna aykırı işleme nedeniyle zarara uğramanız hâlinde zararın giderilmesini talep etme.</li>
    </ul>

    <h2>8. Başvuru</h2>
    <p>Haklarınıza ilişkin taleplerinizi <a href="mailto:info@ihalezeka.com">info@ihalezeka.com</a> adresine iletebilirsiniz. Talepleriniz, niteliğine göre en kısa sürede ve en geç otuz gün içinde sonuçlandırılır.</p>`;

  send(res, {
    title: "KVKK Aydınlatma Metni | İhaleZeka",
    pageTitle: "KVKK Aydınlatma Metni",
    description: "İhaleZeka KVKK aydınlatma metni: 6698 sayılı kanun kapsamında kişisel verilerinizin işlenmesi, aktarımı ve haklarınız.",
    path: "/kvkk",
    content,
  });
});

/* -------------------------------------------------------- Kullanım Şartları */
router.get("/kullanim-sartlari", (_req, res) => {
  const content = `
    <p>İhaleZeka platformunu ("Platform") kullanarak aşağıdaki Kullanım Şartları'nı kabul etmiş sayılırsınız. Lütfen Platform'u kullanmadan önce bu şartları dikkatlice okuyunuz.</p>

    <h2>1. Hizmetin Tanımı</h2>
    <p>İhaleZeka, Türkiye'deki kamu ihalelerini ve ilanlarını derleyen, kullanıcı profiline göre yapay zeka destekli eşleştirme sunan bir bilgi ve takip platformudur. Platform, resmi kaynaklardan (örneğin EKAP, ilan.gov.tr) elde edilen verileri işler.</p>

    <h2>2. Bilgilerin Doğruluğu ve Sorumluluk Reddi</h2>
    <p>Platform'da sunulan ihale bilgileri yalnızca bilgilendirme amaçlıdır. Resmi ve bağlayıcı bilgi her zaman ilgili idarenin resmi ilanı ve EKAP üzerindeki kayıtlardır. İhaleZeka, verilerin güncelliği ve eksiksizliği için makul çabayı gösterir; ancak üçüncü taraf kaynaklardan kaynaklanan hata, gecikme veya eksikliklerden sorumlu tutulamaz. İhaleye katılım kararları kullanıcının kendi sorumluluğundadır.</p>

    <h2>3. Kullanıcı Yükümlülükleri</h2>
    <ul>
      <li>Hesap bilgilerinizi doğru ve güncel tutmak,</li>
      <li>Hesap güvenliğinizden ve oturum bilgilerinizin gizliliğinden sorumlu olmak,</li>
      <li>Platform'u yasalara ve bu şartlara uygun kullanmak,</li>
      <li>Platform'a otomatik veri çekme (scraping), tersine mühendislik veya hizmeti aksatacak eylemlerde bulunmamak.</li>
    </ul>

    <h2>4. Abonelik ve Ödemeler</h2>
    <p>Ücretli planlar abonelik esasıyla sunulur ve ödemeler ödeme hizmet sağlayıcımız üzerinden tahsil edilir. Abonelik koşulları, ücretler ve yenileme bilgileri satın alma sırasında belirtilir. Aboneliğinizi dilediğiniz zaman iptal edebilirsiniz; iptal, mevcut dönemin sonunda geçerli olur.</p>

    <h2>5. Fikri Mülkiyet</h2>
    <p>Platform'un tasarımı, yazılımı, markası ve özgün içerikleri İhaleZeka'ya aittir. Önceden yazılı izin alınmadan kopyalanamaz, çoğaltılamaz veya ticari amaçla kullanılamaz.</p>

    <h2>6. Hizmette Değişiklik ve Askıya Alma</h2>
    <p>İhaleZeka, Platform'un özelliklerini geliştirmek, değiştirmek veya gerekli hallerde geçici olarak askıya almak hakkını saklı tutar.</p>

    <h2>7. Sorumluluğun Sınırlandırılması</h2>
    <p>Yürürlükteki mevzuatın izin verdiği azami ölçüde, İhaleZeka; Platform'un kullanımı veya kullanılamamasından doğan dolaylı zararlardan sorumlu değildir.</p>

    <h2>8. Değişiklikler ve İletişim</h2>
    <p>Bu şartlar zaman zaman güncellenebilir. Güncel sürüm bu sayfada yayımlanır. Sorularınız için <a href="mailto:info@ihalezeka.com">info@ihalezeka.com</a> adresinden bize ulaşabilirsiniz.</p>`;

  send(res, {
    title: "Kullanım Şartları | İhaleZeka",
    pageTitle: "Kullanım Şartları",
    description: "İhaleZeka kullanım şartları: hizmet tanımı, kullanıcı yükümlülükleri, abonelik koşulları ve sorumluluk sınırları.",
    path: "/kullanim-sartlari",
    content,
  });
});

/* ------------------------------------------------ Uluslararası İhaleler */
router.get("/uluslararasi-ihaleler", (_req, res) => {
  const content = `
    <p>Kamu ihaleleri yalnızca yurt içiyle sınırlı değildir. Uluslararası finans kuruluşları ve kalkınma bankaları, her yıl milyarlarca dolarlık mal, hizmet ve yapım işi ihalesi açar. İhaleZeka, Türk firmalarının bu küresel fırsatlara erişimini kolaylaştırmayı hedefler.</p>

    <blockquote>Kurumsal uluslararası ihale takibi <strong>yakında</strong> İhaleZeka Kurumsal ile sunulacaktır. Erken erişim için <a href="mailto:info@ihalezeka.com">info@ihalezeka.com</a> adresinden bizimle iletişime geçebilirsiniz.</blockquote>

    <h2>Takip Etmeyi Planladığımız Kaynaklar</h2>
    <p>Uluslararası ihale ekosisteminde öne çıkan başlıca kurumlar:</p>
    <ul>
      <li><strong>Dünya Bankası (World Bank):</strong> Kalkınma projeleri kapsamında danışmanlık, mal ve yapım işi ihaleleri.</li>
      <li><strong>Avrupa Birliği / TED (Tenders Electronic Daily):</strong> AB resmi gazetesinin ihale eki; Avrupa genelindeki kamu alımları.</li>
      <li><strong>EBRD (Avrupa İmar ve Kalkınma Bankası):</strong> Bölgesel altyapı ve özel sektör projeleri.</li>
      <li><strong>Birleşmiş Milletler / UNGM:</strong> BM kuruluşlarının küresel tedarik ihaleleri.</li>
      <li><strong>AIIB (Asya Altyapı Yatırım Bankası):</strong> Asya odaklı altyapı yatırımları.</li>
      <li><strong>İslam Kalkınma Bankası (IsDB):</strong> Üye ülkelerde kalkınma projeleri.</li>
      <li><strong>Asya Kalkınma Bankası (ADB):</strong> Asya-Pasifik bölgesinde projeler.</li>
    </ul>

    <h2>Türk Firmaları İçin Neden Önemli?</h2>
    <ul>
      <li><strong>Pazar çeşitlendirmesi:</strong> Tek bir pazara bağımlılığı azaltır.</li>
      <li><strong>Döviz geliri:</strong> İhracat niteliğinde, döviz bazlı sözleşmeler.</li>
      <li><strong>Referans ve prestij:</strong> Uluslararası kurumlarla çalışmak güçlü bir referanstır.</li>
      <li><strong>Büyük ölçek:</strong> Yurt içi ihalelere kıyasla daha yüksek bütçeli projeler.</li>
    </ul>

    <h2>Nasıl Hazırlanmalı?</h2>
    <p>Uluslararası ihalelere katılım, genellikle ön yeterlik (prequalification), uluslararası standartlara uygun teklif dosyaları ve çoğu zaman İngilizce dokümantasyon gerektirir. Sağlam bir iş deneyim portföyü, finansal yeterlik belgeleri ve referanslar başarının anahtarıdır.</p>

    <div class="cta">
      <h3>Önce yurt içinde güçlenin</h3>
      <p style="color:#e0e7ff">İhaleZeka ile Türkiye'deki kamu ihalelerini yapay zeka destekli eşleştirme ile takip edin, deneyim ve referans kazanın.</p>
      <a href="${SITE_URL}/">Ücretsiz Başlayın</a>
    </div>`;

  send(res, {
    title: "Uluslararası İhaleler | İhaleZeka",
    pageTitle: "Uluslararası İhaleler",
    description: "Dünya Bankası, AB/TED, EBRD, BM/UNGM ve kalkınma bankalarının uluslararası ihaleleri — Türk firmaları için fırsatlar ve hazırlık rehberi.",
    path: "/uluslararasi-ihaleler",
    content,
  });
});

export default router;
