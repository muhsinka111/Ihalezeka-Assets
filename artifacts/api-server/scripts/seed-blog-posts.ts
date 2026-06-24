import { db, socialPostsTable } from "@workspace/db";
import { inArray } from "drizzle-orm";

/**
 * Idempotent seed of 10 SEO-optimised Turkish educational blog posts for the
 * public İhaleZeka blog (rendered by src/routes/blog.ts from the social_posts
 * table where status='published' AND blog_slug IS NOT NULL).
 *
 * Re-running is safe: rows are matched by blog_slug, deleted, then re-inserted.
 *
 * Usage: pnpm --filter @workspace/api-server exec tsx scripts/seed-blog-posts.ts
 */

type Seed = {
  slug: string;
  title: string;
  topic: string;
  metaDescription: string;
  body: string;
  blogBody: string;
};

const POSTS: Seed[] = [
  {
    slug: "ekap-nedir-nasil-kullanilir",
    title: "EKAP Nedir ve Nasıl Kullanılır? Kayıt ve E-İmza Rehberi",
    topic: "EKAP",
    metaDescription:
      "EKAP nedir, nasıl kullanılır? Elektronik Kamu Alımları Platformu’na kayıt, e-imza gereklilikleri ve protokol süreci adım adım anlatılıyor bu kapsamlı rehberde.",
    body: "EKAP, kamu ihalelerinin elektronik ortamda yürütüldüğü resmi platformdur. Bu yazıda kayıt, e-imza ve platformun temel kullanımını adım adım açıklıyoruz.",
    blogBody: `<p><strong>EKAP (Elektronik Kamu Alımları Platformu)</strong>, Kamu İhale Kurumu (KİK) tarafından işletilen ve Türkiye’deki kamu ihalelerinin elektronik ortamda yürütülmesini sağlayan resmi platformdur. İdareler ihale ilanlarını burada yayımlar, istekliler ise dokümanları indirir, teklif verir ve süreci buradan takip eder. Kamu alımlarına girmek isteyen her firmanın atması gereken ilk adım EKAP’a kayıt olmaktır.</p>

<h2>EKAP Ne İşe Yarar?</h2>
<p>Platform, ihale sürecinin neredeyse tamamını dijitalleştirir. EKAP üzerinden gerçekleştirilebilen başlıca işlemler şunlardır:</p>
<ul>
  <li><strong>İhale ilanlarının</strong> yayımlanması ve aranması</li>
  <li>İhale dokümanının (idari şartname, teknik şartname, sözleşme tasarısı) <strong>elektronik indirilmesi</strong></li>
  <li>Elektronik teklif (<strong>e-teklif</strong>) verilmesi</li>
  <li>İhale sonuçlarının ve kesinleşen ihale kararlarının takibi</li>
  <li>Şikâyet ve itirazen şikâyet süreçlerinin ilgili adımları</li>
</ul>

<h2>EKAP’a Kayıt Adımları</h2>
<p>EKAP kaydı, firmanızı sisteme tanıtan ve ihalelere katılımınızın önünü açan zorunlu bir işlemdir. Genel olarak süreç şu şekilde ilerler:</p>
<ol>
  <li><strong>Protokol oluşturma:</strong> ekap.kik.gov.tr adresinden “Kayıt İşlemleri” bölümüne girerek firma bilgilerinizi girersiniz ve sistemin oluşturduğu Platform Sorumlusu Taahhütnamesi/protokolünü hazırlarsınız.</li>
  <li><strong>Belgelerin idareye onaylatılması:</strong> Oluşturulan protokol, yetkili kişi tarafından imzalanır ve KİK’in belirlediği usule göre onay sürecinden geçirilir.</li>
  <li><strong>Platform sorumlusu tanımlama:</strong> Firmayı temsil edecek platform sorumlusu ve varsa ek kullanıcılar sisteme tanımlanır.</li>
  <li><strong>Kullanıcı adı ve parolanın aktifleştirilmesi:</strong> Onay tamamlandığında kullanıcı girişiniz aktif hale gelir.</li>
</ol>

<blockquote>Kayıt bilgilerinin (vergi numarası, ticaret sicil bilgileri, yetkili kişi) güncel ve doğru olması kritik önemdedir; hatalı bilgiler teklif aşamasında değerlendirme dışı kalmaya yol açabilir.</blockquote>

<h2>E-İmza Neden Gerekli?</h2>
<p>Elektronik teklif veren ve EKAP üzerinden ıslak imza yerine elektronik işlem yapan istekliler için <strong>nitelikli elektronik sertifika (e-imza)</strong> gereklidir. E-imza, attığınız teklifin ve beyanların hukuki olarak geçerli ve size ait olduğunu garanti eder. E-imza ile ilgili dikkat edilmesi gerekenler:</p>
<ul>
  <li>E-imza, BTK tarafından yetkilendirilmiş <strong>Elektronik Sertifika Hizmet Sağlayıcıları</strong>ndan temin edilir.</li>
  <li>İmza, teklifi verecek <strong>yetkili gerçek kişi</strong> adına olmalıdır.</li>
  <li>Sertifikanın geçerlilik süresinin teklif tarihinde dolmamış olması gerekir.</li>
  <li>İmza sürücülerinin ve kart okuyucunun bilgisayarınızda düzgün kurulu olması, son dakika teknik sorunlarını önler.</li>
</ul>

<h2>İlk Kullanımda Sık Yapılan Hatalar</h2>
<p>EKAP’ı ilk kez kullanan firmaların karşılaştığı tipik sorunlar ve çözümleri:</p>
<ul>
  <li><strong>Tarayıcı uyumsuzluğu:</strong> Platformun desteklediği güncel tarayıcı ve Java/imza bileşenlerini kullanın.</li>
  <li><strong>Süre yönetimi:</strong> Teklifleri son dakikaya bırakmayın; e-teklif yüklemesi internet hızına bağlı zaman alabilir.</li>
  <li><strong>Doküman güncellemeleri:</strong> İhale dokümanında yapılan zeyilname (değişiklik) bildirimlerini düzenli kontrol edin.</li>
</ul>

<h2>Sonuç</h2>
<p>EKAP, kamu ihale sürecinin merkezidir; doğru kurulmuş bir kayıt ve geçerli bir e-imza, kesintisiz katılımın temelidir. Bir kez doğru kurulduğunda, asıl zorluk size uygun ihaleleri zamanında fark etmek olur.</p>

<p><strong>İhaleZeka</strong>, yapay zekâ destekli ihale eşleştirme motoruyla EKAP ve diğer kaynaklardaki binlerce ilanı firmanızın faaliyet alanına, deneyimine ve kapasitesine göre tarar; size en uygun fırsatları öne çıkarır. Böylece kayıt ve e-imza hazırken, doğru ihaleyi kaçırma riskiniz ortadan kalkar.</p>`,
  },
  {
    slug: "kamu-ihalesine-nasil-girilir-adim-adim-rehber",
    title: "Kamu İhalesine Nasıl Girilir? Adım Adım Başvuru Rehberi",
    topic: "İhale Rehberi",
    metaDescription:
      "Kamu ihalesine nasıl girilir? EKAP kaydından teklif vermeye, gerekli belgelerden teminata kadar ihaleye katılımın tüm adımlarını bu pratik rehberde bulun.",
    body: "Kamu ihalesine ilk kez girecek firmalar için EKAP kaydından teklif sunmaya kadar tüm süreci adım adım anlatan pratik bir rehber.",
    blogBody: `<p>Kamu ihaleleri, firmalar için istikrarlı ve geniş bir pazar sunar. Ancak süreç ilk bakışta karmaşık görünebilir. Bu rehberde, <strong>kamu ihalesine katılımın</strong> baştan sona izlemeniz gereken adımlarını sade bir biçimde özetliyoruz. Türkiye’de kamu alımlarının çatısı <strong>4734 sayılı Kamu İhale Kanunu</strong> ile çizilir ve süreç büyük ölçüde EKAP üzerinden yürür.</p>

<h2>1. EKAP Kaydını Tamamlayın</h2>
<p>İhalelere katılmanın ön koşulu, Elektronik Kamu Alımları Platformu’na (EKAP) kayıtlı olmaktır. Firma bilgilerinizi tanımlayın, platform sorumlusunu belirleyin ve elektronik teklif vereceksiniz nitelikli <strong>e-imza</strong> tedarik edin.</p>

<h2>2. Size Uygun İhaleyi Bulun</h2>
<p>İlanlar EKAP ve ilan.gov.tr gibi kaynaklarda yayımlanır. Bir ihaleye girmeden önce şunları değerlendirin:</p>
<ul>
  <li>İşin konusu firmanızın <strong>faaliyet alanına</strong> uygun mu?</li>
  <li><strong>Yeterlik kriterlerini</strong> (iş deneyimi, ekonomik ve mali yeterlik) karşılıyor musunuz?</li>
  <li>Teklif ve teslim sürelerine yetişebilir misiniz?</li>
</ul>

<h2>3. İhale Dokümanını İnceleyin</h2>
<p>İhale dokümanı; idari şartname, teknik şartname, sözleşme tasarısı ve eklerden oluşur. Bu belgeler, ihalenin tüm kurallarını içerir. Özellikle şu noktalara dikkat edin:</p>
<ul>
  <li><strong>Yeterlik belgeleri</strong> listesi ve istenen format</li>
  <li>Teklifin hangi para birimi ve birim üzerinden verileceği</li>
  <li><strong>Geçici teminat</strong> oranı ve geçerlilik süresi</li>
  <li>Teslim/ifa süreleri ve cezai şartlar</li>
</ul>

<blockquote>Dokümanda anlamadığınız bir husus varsa, idareye süresi içinde yazılı olarak açıklama talebinde bulunabilirsiniz. Doğru sorular, sonradan yapılacak hatalardan korur.</blockquote>

<h2>4. Belgelerinizi Hazırlayın</h2>
<p>İhale türüne göre değişmekle birlikte sık istenen belgeler şunlardır:</p>
<ol>
  <li>Teklif mektubu</li>
  <li>Geçici teminat (teminat mektubu veya kabul edilen diğer değerler)</li>
  <li>Ticaret/esnaf sicil bilgileri ve imza beyannamesi/sirküleri</li>
  <li><strong>İş deneyim belgesi</strong> (istenmişse)</li>
  <li>Ekonomik ve mali yeterliğe ilişkin belgeler (bilanço, iş hacmi vb.)</li>
</ol>

<h2>5. Geçici Teminatı Sağlayın</h2>
<p>4734 sayılı Kanun uyarınca isteklilerden, teklif edilen bedelin <strong>%3’ünden az olmamak</strong> üzere geçici teminat alınır. Teminat; banka teminat mektubu, tedavüldeki Türk parası veya mevzuatta sayılan diğer değerlerle verilebilir.</p>

<h2>6. Teklifinizi Sunun</h2>
<p>Klasik ihalelerde teklif kapalı zarf usulüyle, elektronik ihalelerde ise EKAP üzerinden <strong>e-teklif</strong> olarak verilir. İki durumda da teklifin son teklif verme saatinden önce ulaştırılması zorunludur. Geç gelen teklifler değerlendirmeye alınmaz.</p>

<h2>7. Açık Oturum ve Değerlendirme</h2>
<p>Teklifler komisyon tarafından önce şekil yönünden, ardından yeterlik ve fiyat yönünden incelenir. Aşırı düşük tekliflerden yazılı açıklama istenebilir. Sonuçta ekonomik açıdan en avantajlı teklif belirlenir ve kesinleşen ihale kararı isteklilere bildirilir.</p>

<h2>8. Sözleşme ve Kesin Teminat</h2>
<p>İhale üzerinde kalan istekliden, sözleşme imzalanmadan önce <strong>sözleşme bedelinin %6’sı</strong> oranında kesin teminat alınır ve sözleşme imzalanır.</p>

<h2>Sonuç</h2>
<p>Kamu ihalesine girmek, disiplinli bir hazırlık ve doğru ihale seçimiyle yönetilebilir bir süreçtir. En kritik adım, kapasitenize uygun ihaleyi zamanında tespit etmektir.</p>

<p><strong>İhaleZeka</strong>’nın yapay zekâ destekli eşleştirme sistemi, firmanızın profilini binlerce güncel ilanla karşılaştırarak yalnızca kazanma şansınızın yüksek olduğu ihaleleri önünüze getirir. Böylece enerjinizi doğru tekliflere ayırırsınız.</p>`,
  },
  {
    slug: "gecici-ve-kesin-teminat-oranlar-iade-surecleri",
    title: "Geçici ve Kesin Teminat: Oranlar, Türler ve İade Süreçleri",
    topic: "Teminat",
    metaDescription:
      "Geçici teminat ve kesin teminat nedir, oranları nelerdir, nasıl iade edilir? Kamu ihalelerinde teminat türleri ve iade süreçleri bu rehberde net biçimde anlatılıyor.",
    body: "Kamu ihalelerinde geçici ve kesin teminatın oranları, kabul edilen türleri ve iade süreçlerini açıklayan kapsamlı bir rehber.",
    blogBody: `<p>Teminat, kamu ihalelerinde isteklinin ve yüklenicinin taahhüdüne sadık kalacağını güvence altına alan en önemli araçlardan biridir. <strong>4734 sayılı Kamu İhale Kanunu</strong>, ihale sürecinde iki temel teminat türü tanımlar: <strong>geçici teminat</strong> ve <strong>kesin teminat</strong>. Bu yazıda her ikisinin oranlarını, kabul edilen değerleri ve iade koşullarını ele alıyoruz.</p>

<h2>Geçici Teminat Nedir?</h2>
<p>Geçici teminat, teklif veren isteklinin teklifinin arkasında durduğunu ve ihale süreci tamamlanana kadar teklifinden cayamayacağını güvence altına alır. Kanuna göre geçici teminat, <strong>teklif edilen bedelin %3’ünden az olmamak</strong> üzere istekli tarafından belirlenen tutarda verilir.</p>

<h2>Kesin Teminat Nedir?</h2>
<p>Kesin teminat, ihale üzerinde kalan isteklinin işi sözleşme ve şartname hükümlerine uygun şekilde tamamlayacağını güvence altına alır. Kanuna göre, ihale üzerinde kalan istekliden <strong>sözleşme (ihale) bedeli üzerinden %6 oranında</strong> kesin teminat alınır ve bu teminat sözleşme imzalanmadan önce yatırılır.</p>

<h2>Teminat Olarak Kabul Edilen Değerler</h2>
<p>Kanunun ilgili maddeleri uyarınca teminat olarak kabul edilen başlıca değerler şunlardır:</p>
<ul>
  <li>Tedavüldeki <strong>Türk parası</strong></li>
  <li>Bankalar tarafından verilen <strong>teminat mektupları</strong> (süresiz olabilir)</li>
  <li><strong>Devlet İç Borçlanma Senetleri</strong> ve bu senetler yerine düzenlenen belgeler</li>
</ul>
<blockquote>Teklif kapsamında teminat mektubu verilecekse, mektubun ihale dokümanında belirtilen geçerlilik süresini karşıladığından emin olun; süresi yetersiz mektuplar teklifin değerlendirme dışı kalmasına yol açabilir.</blockquote>

<h2>Oranların Karşılaştırması</h2>
<table>
  <thead>
    <tr><th>Teminat Türü</th><th>Hesaplama Esası</th><th>Oran</th></tr>
  </thead>
  <tbody>
    <tr><td>Geçici teminat</td><td>Teklif edilen bedel</td><td>En az %3</td></tr>
    <tr><td>Kesin teminat</td><td>Sözleşme (ihale) bedeli</td><td>%6</td></tr>
  </tbody>
</table>

<h2>Geçici Teminatın İadesi</h2>
<p>Geçici teminat, ihale süreci sonuçlandıktan sonra iade edilir:</p>
<ul>
  <li><strong>İhaleyi kazanamayan</strong> isteklilerin geçici teminatı, ihale kararı kesinleştikten sonra iade edilir.</li>
  <li><strong>İhaleyi kazanan</strong> isteklinin geçici teminatı ise, sözleşme imzalanıp kesin teminat verildikten sonra çözülür.</li>
</ul>

<h2>Kesin Teminatın İadesi</h2>
<p>Kesin teminat, taahhüdün eksiksiz yerine getirildiği belgelenince iade edilir. Genel ilkeler şöyledir:</p>
<ol>
  <li>İşin sözleşme ve şartnameye uygun tamamlanıp <strong>kabul işleminin</strong> yapılması beklenir.</li>
  <li>Yüklenicinin <strong>SGK prim borcu</strong> bulunmadığına dair ilişiksizlik durumunun teyidi aranır.</li>
  <li>Yapım işlerinde, teminatın bir kısmı kesin kabul/garanti süresi sonuna kadar tutulabilir.</li>
</ol>

<h2>Teminatın Gelir Kaydedilmesi</h2>
<p>İstekli, ihale süresince teklifinden cayar veya sözleşme imzalama yükümlülüğünü yerine getirmezse geçici teminatı; yüklenici taahhüdünü ihlal ederse kesin teminatı <strong>gelir kaydedilebilir</strong>. Bu nedenle teminat, yalnızca bir formalite değil, ciddi bir taahhüt aracıdır.</p>

<h2>Sonuç</h2>
<p>Teminat oranlarını ve iade koşullarını doğru bilmek, nakit akışınızı planlamanız ve sürpriz kayıplardan kaçınmanız açısından kritiktir. Doğru ihaleyi seçmek ise bu planlamanın ilk adımıdır.</p>

<p><strong>İhaleZeka</strong>, yapay zekâ destekli ihale eşleştirmesiyle yalnızca firmanızın mali kapasitesine ve uzmanlığına uygun ihaleleri öne çıkarır; böylece teminat yükünüzü en verimli şekilde, kazanma şansı yüksek tekliflere ayırabilirsiniz.</p>`,
  },
  {
    slug: "yaklasik-maliyet-nedir-nasil-hesaplanir",
    title: "Yaklaşık Maliyet Nedir, Nasıl Hesaplanır? Kapsamlı Rehber",
    topic: "Maliyet",
    metaDescription:
      "Yaklaşık maliyet nedir, nasıl hesaplanır ve neden gizlidir? Kamu ihalelerinde yaklaşık maliyetin hesaplama yöntemleri ve önemi bu rehberde detaylıca açıklanıyor.",
    body: "Kamu ihalelerinde yaklaşık maliyetin tanımı, hesaplama yöntemleri, gizliliği ve teklif stratejisindeki rolünü açıklayan rehber.",
    blogBody: `<p><strong>Yaklaşık maliyet</strong>, kamu ihalelerinde idarenin, ihaleye çıkmadan önce işin tahmini bedelini belirlemek amacıyla yaptığı hesaplamadır. Hem ihalenin doğru usulle yapılmasında hem de tekliflerin değerlendirilmesinde belirleyici bir referanstır. <strong>4734 sayılı Kamu İhale Kanunu</strong>, ihale konusu işin yaklaşık maliyetinin ihale öncesinde idare tarafından hesaplanmasını öngörür.</p>

<h2>Yaklaşık Maliyet Neden Önemlidir?</h2>
<p>Yaklaşık maliyet, sürecin pek çok aşamasını etkiler:</p>
<ul>
  <li><strong>İhale usulünün</strong> belirlenmesinde eşik ve limitlere göre yön gösterir.</li>
  <li>Bütçenin yeterliği ve ödenek planlaması için temel oluşturur.</li>
  <li><strong>Aşırı düşük teklif</strong> değerlendirmesinde referans noktalarından biridir.</li>
  <li>İlan sürelerinin ve duyuru kapsamının belirlenmesinde rol oynar.</li>
</ul>

<h2>Yaklaşık Maliyet Nasıl Hesaplanır?</h2>
<p>İdare, yaklaşık maliyeti gerçekçi ve güncel verilere dayandırmak zorundadır. Hesaplamada başvurulan başlıca yöntem ve kaynaklar şunlardır:</p>
<ol>
  <li><strong>Kamu kurumlarının yayımladığı birim fiyatlar:</strong> İlgili bakanlık ve kurumların güncel birim fiyat cetvelleri kullanılır.</li>
  <li><strong>Piyasa fiyat araştırması:</strong> İşin niteliğine uygun firmalardan fiyat teklifleri/proforma toplanır.</li>
  <li><strong>Önceki ihale verileri:</strong> Benzer işlere ait geçmiş sözleşme bedelleri referans alınabilir.</li>
  <li><strong>Maliyet bileşenlerinin ayrıştırılması:</strong> Malzeme, işçilik, nakliye, genel gider ve kâr gibi kalemler ayrı ayrı değerlendirilir.</li>
</ol>

<blockquote>Yaklaşık maliyet kural olarak <strong>KDV hariç</strong> hesaplanır. Teklif stratejinizde bu ayrımı göz önünde bulundurmanız önemlidir.</blockquote>

<h2>Yaklaşık Maliyetin Gizliliği</h2>
<p>Yaklaşık maliyet, ihale sürecinin sağlıklı yürümesi için <strong>gizli</strong> tutulur. Açık ihale usulünde yaklaşık maliyet, ihale komisyonu tarafından genellikle teklifler alındıktan sonra, oturumda açıklanır. Bu gizlilik; rekabetin korunması ve tekliflerin yapay biçimde yaklaşık maliyete göre şekillendirilmesinin önlenmesi amacını taşır.</p>

<h2>İstekli Açısından Yaklaşık Maliyet</h2>
<p>İstekliler yaklaşık maliyeti önceden bilemese de, kendi <strong>maliyet analizlerini</strong> sağlam yapmalıdır. Sağlıklı bir teklif için:</p>
<ul>
  <li>Malzeme ve işçilik maliyetlerinizi güncel piyasa koşullarına göre hesaplayın.</li>
  <li>Genel giderlerinizi ve makul kâr oranınızı net biçimde belirleyin.</li>
  <li>Aşırı düşük teklif riskine karşı maliyet kalemlerinizi <strong>belgelendirebilecek</strong> şekilde hazırlayın.</li>
</ul>

<h2>Aşırı Düşük Teklifle İlişkisi</h2>
<p>Teklif fiyatları, yaklaşık maliyete ve diğer tekliflere göre değerlendirilir. Aşırı düşük görünen tekliflerden idare yazılı açıklama isteyebilir. Bu nedenle teklifinizi yaklaşık maliyetin çok altına çekerken, maliyet bileşenlerinizi savunabileceğinizden emin olmalısınız.</p>

<h2>Sık Yapılan Hatalar</h2>
<ul>
  <li>Genel giderleri ve dolaylı maliyetleri hesaba katmadan teklif vermek</li>
  <li>Güncel olmayan birim fiyatlarla çalışmak</li>
  <li>Kur ve enflasyon etkisini göz ardı etmek</li>
  <li>Aşırı düşük açıklamasına dayanak oluşturacak belgeleri hazırlamamak</li>
</ul>

<h2>Sonuç</h2>
<p>Yaklaşık maliyet, idarenin referansı; sizin referansınız ise sağlam bir maliyet analizidir. İkisini doğru anlamak, hem rekabetçi hem de sürdürülebilir teklifler vermenin anahtarıdır.</p>

<p><strong>İhaleZeka</strong>, yapay zekâ destekli eşleştirme ve analiz araçlarıyla ihaleleri firmanızın maliyet yapısına ve uzmanlığına göre değerlendirir; size en uygun ve en kârlı potansiyele sahip ihaleleri öne çıkararak teklif stratejinizi güçlendirir.</p>`,
  },
  {
    slug: "asiri-dusuk-teklif-sorgulamasi-ve-aciklama",
    title: "Aşırı Düşük Teklif Sorgulaması ve Açıklama Nasıl Yapılır?",
    topic: "Teklif Değerlendirme",
    metaDescription:
      "Aşırı düşük teklif sorgulaması nedir, açıklama nasıl hazırlanır? Kamu ihalelerinde aşırı düşük teklif açıklamasının kuralları ve püf noktaları bu rehberde anlatılıyor.",
    body: "Aşırı düşük teklif sorgulamasının ne olduğunu, açıklamanın nasıl hazırlanacağını ve sık yapılan hataları anlatan pratik rehber.",
    blogBody: `<p>Kamu ihalelerinde rekabet bazen tekliflerin beklenenden çok daha düşük seviyelere inmesine yol açar. Bu durumda idare, işin gerçekten o bedelle yapılıp yapılamayacağını anlamak için <strong>aşırı düşük teklif sorgulaması</strong> yapar. <strong>4734 sayılı Kamu İhale Kanunu</strong>, teklif değerlendirmesinde aşırı düşük görünen tekliflerin sahiplerinden yazılı açıklama istenmesine olanak tanır.</p>

<h2>Aşırı Düşük Teklif Nedir?</h2>
<p>Bir teklif; yaklaşık maliyete ve diğer geçerli tekliflere kıyasla anormal derecede düşükse, idare bu teklifin gerçekçi olup olmadığını sorgular. Amaç, işin <strong>sözleşmeye ve şartnameye uygun</strong> şekilde tamamlanamayacağı bir bedelle ihalenin sonuçlanmasını önlemektir.</p>

<h2>Sorgulama Süreci Nasıl İşler?</h2>
<ol>
  <li><strong>Tespit:</strong> Komisyon, aşırı düşük olarak değerlendirilebilecek teklifleri belirler.</li>
  <li><strong>Yazılı açıklama talebi:</strong> İlgili isteklilerden, tekliflerinin bileşenlerini belgeleyen <strong>yazılı açıklama</strong> istenir.</li>
  <li><strong>Açıklamanın sunulması:</strong> İstekli, verilen süre içinde açıklamasını ve dayanak belgelerini sunar.</li>
  <li><strong>Değerlendirme:</strong> Komisyon açıklamayı inceler; yeterli bulursa teklif geçerli sayılır, bulmazsa teklif reddedilir.</li>
</ol>

<blockquote>Açıklama talebine süresi içinde ve yeterli belgeyle cevap vermemek, teklifin doğrudan değerlendirme dışı kalması anlamına gelir. Bu yüzden açıklama dosyanızı önceden hazırlamak büyük avantaj sağlar.</blockquote>

<h2>Açıklamada Nelere Dayanabilirsiniz?</h2>
<p>İstekli, teklif fiyatının gerçekçi olduğunu ortaya koymak için çeşitli unsurlara dayanabilir:</p>
<ul>
  <li><strong>İmalat sürecinin</strong> ve seçilen teknik çözümlerin getirdiği maliyet avantajları</li>
  <li>İşin yürütüleceği <strong>özgün koşullar</strong> (mevcut ekipman, lojistik üstünlük vb.)</li>
  <li>Tedarikçilerden alınan <strong>fiyat teklifleri/proformalar</strong></li>
  <li>Kamu kurumlarının yayımladığı veya resmi <strong>birim fiyatlar</strong></li>
  <li>İşçilik maliyetlerine ilişkin yasal asgari tutarlar ve hesaplamalar</li>
</ul>

<h2>İyi Bir Açıklama Dosyasının Özellikleri</h2>
<p>Kabul edilebilir bir açıklama; tutarlı, belgeli ve denetlenebilir olmalıdır. Dikkat edilmesi gerekenler:</p>
<ul>
  <li>Maliyet kalemlerinin <strong>tamamını</strong> kapsayın; eksik kalem şüphe yaratır.</li>
  <li>Her tutarı <strong>belgeyle</strong> destekleyin; soyut iddialardan kaçının.</li>
  <li>Belgelerin <strong>güncel ve tutarlı</strong> olmasına özen gösterin.</li>
  <li>İşçilik gibi yasal alt sınırı olan kalemlerde mevzuata uygun hesap yapın.</li>
</ul>

<h2>Sık Yapılan Hatalar</h2>
<ul>
  <li>Açıklamayı son güne bırakıp belge toplamaya yetişememek</li>
  <li>Önemli maliyet kalemlerini açıklama dışında bırakmak</li>
  <li>Gerçeği yansıtmayan, sonradan teyit edilemeyen proformalar sunmak</li>
  <li>İşçilik maliyetini yasal sınırların altında göstermek</li>
</ul>

<h2>Stratejik Bakış</h2>
<p>Aşırı düşük teklif sorgulaması bir engel değil, hazırlıklı firmalar için bir <strong>fırsattır</strong>. İyi belgelenmiş bir maliyet yapısıyla, rekabetçi fiyatınızı savunabilir ve ihaleyi sağlam bir zeminde kazanabilirsiniz. Önemli olan, teklifinizi verirken maliyet kayıtlarınızı baştan düzenli tutmaktır.</p>

<p><strong>İhaleZeka</strong>, yapay zekâ destekli ihale eşleştirme ve analiz yetenekleriyle firmanızın gerçekçi maliyet yapısına uyan ihaleleri belirler; sürdürülebilir ve savunulabilir teklifler vermenize yardımcı olarak aşırı düşük teklif riskini yönetmenizi kolaylaştırır.</p>`,
  },
  {
    slug: "e-ihale-elektronik-ihale-sureci",
    title: "e-İhale (Elektronik İhale) Süreci: e-Teklif Adım Adım",
    topic: "e-İhale",
    metaDescription:
      "e-İhale nedir, elektronik ihale süreci nasıl işler? EKAP üzerinden e-teklif hazırlama, e-teminat ve e-imza adımları bu kapsamlı elektronik ihale rehberinde.",
    body: "EKAP üzerinden yürütülen elektronik ihale (e-İhale) sürecini, e-teklif hazırlamayı ve dikkat edilmesi gereken noktaları anlatan rehber.",
    blogBody: `<p><strong>e-İhale (elektronik ihale)</strong>, kamu ihalelerinin tekliflerin de dahil olduğu önemli bir bölümünün EKAP üzerinden tamamen elektronik ortamda yürütüldüğü modeldir. Kâğıt belge ve fiziksel zarf yerine, istekliler tekliflerini dijital olarak hazırlar ve <strong>e-teklif</strong> şeklinde sunar. Bu yöntem süreci hızlandırır, şeffaflığı artırır ve hataları azaltır.</p>

<h2>e-İhalenin Klasik İhaleden Farkı</h2>
<ul>
  <li>Teklifler <strong>fiziksel zarfla</strong> değil, EKAP üzerinden elektronik olarak verilir.</li>
  <li>Belgelerin önemli bir kısmı <strong>beyan</strong> esasına dayanır; teyit, ihale üzerinde kalan istekliden istenir.</li>
  <li>Geçici teminat, <strong>e-teminat mektubu</strong> olarak elektronik biçimde sunulabilir.</li>
  <li>İşlemler nitelikli <strong>e-imza</strong> ile imzalanır.</li>
</ul>

<h2>e-İhaleye Hazırlık</h2>
<p>Sürece girmeden önce teknik altyapınızın hazır olması gerekir:</p>
<ol>
  <li><strong>EKAP kaydı:</strong> Firmanız ve platform sorumlunuz tanımlı olmalı.</li>
  <li><strong>Nitelikli e-imza:</strong> Teklifi verecek yetkili adına geçerli bir sertifika bulunmalı.</li>
  <li><strong>Tarayıcı ve imza bileşenleri:</strong> Platformun desteklediği güncel sürümler kurulu olmalı.</li>
</ol>

<h2>e-Teklif Hazırlama Adımları</h2>
<ol>
  <li><strong>İhaleyi seçin:</strong> EKAP’ta katılmak istediğiniz e-ihaleyi açın ve dokümanı indirin.</li>
  <li><strong>Yeterlik bilgilerini girin:</strong> İstenen beyanları ve bilgileri elektronik formlara işleyin.</li>
  <li><strong>Teklif bedelini ve cetvelleri doldurun:</strong> Birim fiyat veya götürü bedel yapısına göre teklifinizi oluşturun.</li>
  <li><strong>Geçici teminatı ekleyin:</strong> e-teminat mektubu veya kabul edilen diğer teminat bilgisini sisteme tanımlayın.</li>
  <li><strong>e-imza ile imzalayın ve gönderin:</strong> Teklifinizi son teklif verme saatinden önce elektronik imzayla sunun.</li>
</ol>

<blockquote>e-teklif gönderimini son dakikaya bırakmayın. İmza, dosya yükleme ve onay adımları internet hızınıza bağlı olarak zaman alabilir; saat dolduğunda sistem yeni teklif kabul etmez.</blockquote>

<h2>Beyan Usulü ve Belge Teyidi</h2>
<p>e-ihalede istekliler, yeterlik kriterlerine ilişkin birçok bilgiyi başlangıçta <strong>beyan</strong> eder. İhale ekonomik açıdan en avantajlı teklif sahibi belirlendikten sonra, beyan edilen hususları kanıtlayan belgeler bu istekliden istenir. Beyan ile belge arasında tutarsızlık çıkması, ciddi sonuçlar doğurabilir; bu yüzden beyanlarınızın gerçeği yansıttığından emin olun.</p>

<h2>Zeyilname ve Açıklama Talepleri</h2>
<p>İhale dokümanında yapılan değişiklikler (<strong>zeyilname</strong>) ve idarenin açıklamaları EKAP üzerinden duyurulur. Teklifinizi etkileyebilecek bu güncellemeleri düzenli takip etmek, sürpriz hatalardan korur.</p>

<h2>e-İhalenin Avantajları</h2>
<ul>
  <li>Daha <strong>hızlı</strong> ve kâğıtsız süreç</li>
  <li>Şekil hatalarının azalması</li>
  <li>İşlemlerin <strong>izlenebilir ve şeffaf</strong> olması</li>
  <li>Coğrafi engel olmadan, dijital ortamdan katılım</li>
</ul>

<h2>Sık Yapılan Hatalar</h2>
<ul>
  <li>e-imza sertifikasının süresinin dolmuş olması</li>
  <li>Teklif cetvellerinin eksik veya hatalı doldurulması</li>
  <li>Son saatte yükleme yaparak süreyi kaçırmak</li>
  <li>Beyan ile sonradan sunulan belge arasında çelişki</li>
</ul>

<h2>Sonuç</h2>
<p>e-İhale, doğru kurulduğunda klasik ihaleden çok daha verimli bir katılım yöntemidir. Teknik hazırlığınızı önceden tamamlamak ve doğru ihaleyi seçmek, başarının temelidir.</p>

<p><strong>İhaleZeka</strong>, yapay zekâ destekli eşleştirme motoruyla EKAP’taki güncel e-ihaleleri firmanızın profiline göre tarar ve size en uygun fırsatları bildirir; böylece teknik hazırlığınız hazırken doğru e-ihaleyi zamanında yakalarsınız.</p>`,
  },
  {
    slug: "4734-kamu-ihale-kanunu-temel-ilkeleri-ve-usuller",
    title: "4734 Sayılı Kamu İhale Kanunu: Temel İlkeler ve İhale Usulleri",
    topic: "Mevzuat",
    metaDescription:
      "4734 sayılı Kamu İhale Kanunu’nun temel ilkeleri ve ihale usulleri nelerdir? Açık ihale, belli istekliler ve pazarlık usulü bu kapsamlı mevzuat rehberinde açıklanıyor.",
    body: "4734 sayılı Kamu İhale Kanunu’nun temel ilkelerini ve açık ihale, belli istekliler arası, pazarlık usullerini açıklayan rehber.",
    blogBody: `<p><strong>4734 sayılı Kamu İhale Kanunu</strong>, Türkiye’de kamu kurum ve kuruluşlarının mal, hizmet alımları ve yapım işlerinde uygulanacak esasları düzenleyen temel mevzuattır. Kamu kaynaklarının doğru kullanılması ve rekabetin korunması bu kanunun özünü oluşturur. Bu yazıda kanunun <strong>temel ilkelerini</strong> ve <strong>ihale usullerini</strong> ele alıyoruz.</p>

<h2>Kanunun Amacı</h2>
<p>Kanun; kamu alımlarında saydamlığı, rekabeti, eşit muameleyi ve kaynakların verimli kullanılmasını sağlamayı amaçlar. İdarelerin keyfi davranışlarını sınırlar ve isteklilere öngörülebilir, adil bir ortam sunar.</p>

<h2>Temel İlkeler</h2>
<p>Kanunun temel ilkeleri, tüm ihale sürecine yön veren çerçeveyi belirler:</p>
<ul>
  <li><strong>Saydamlık:</strong> Süreç açık, ilan edilebilir ve denetlenebilir olmalıdır.</li>
  <li><strong>Rekabet:</strong> Mümkün olan en geniş katılım sağlanmalı, rekabeti engelleyici düzenlemelerden kaçınılmalıdır.</li>
  <li><strong>Eşit muamele:</strong> Tüm istekliler aynı kurallara tabi tutulmalıdır.</li>
  <li><strong>Güvenirlik:</strong> Süreç güven veren, tutarlı kurallarla yürütülmelidir.</li>
  <li><strong>Gizlilik:</strong> Tekliflerin ve belirli bilgilerin gizliliği korunmalıdır.</li>
  <li><strong>Kamuoyu denetimi:</strong> Süreç kamuoyunun denetimine açık olmalıdır.</li>
  <li><strong>İhtiyaçların uygun şartlarla ve zamanında karşılanması</strong> ve <strong>kaynakların verimli kullanılması</strong> esastır.</li>
</ul>

<blockquote>Kanun, ihtiyaçların karşılanmasında temel usulün <strong>açık ihale usulü</strong> ve <strong>belli istekliler arasında ihale usulü</strong> olduğunu vurgular; diğer usuller ise koşulların gerektirdiği özel hâllerde uygulanır.</blockquote>

<h2>İhale Usulleri</h2>
<p>Kanun, mal ve hizmet alımları ile yapım işleri için üç temel ihale usulü tanımlar:</p>

<h3>1. Açık İhale Usulü</h3>
<p>Bütün isteklilerin teklif verebildiği, en yaygın ve temel usuldür. Geniş katılım ve güçlü rekabet sağladığı için idarelerin tercih ettiği esas yöntemdir.</p>

<h3>2. Belli İstekliler Arasında İhale Usulü</h3>
<p>İşin özelliği nedeniyle ön yeterlik değerlendirmesi sonucunda davet edilen, yeterliği belirlenmiş istekliler arasında yapılan ihaledir. Genellikle uzmanlık veya nitelik gerektiren işlerde kullanılır.</p>

<h3>3. Pazarlık Usulü</h3>
<p>Kanunda sayılan özel durumların varlığı hâlinde başvurulan, daha esnek bir usuldür. Belirli koşullar gerçekleştiğinde, idarenin isteklilerle teklif ve şartları görüşebildiği bir yöntem olarak uygulanır.</p>

<h2>Doğrudan Temin</h2>
<p>Doğrudan temin, bir ihale usulü değil; kanunda belirtilen hâllerde ihale yapılmaksızın ihtiyaçların karşılanabildiği bir <strong>alım yöntemidir</strong>. Genellikle düşük tutarlı veya belirli özel durumlardaki ihtiyaçlar için kullanılır. Doğrudan teminde teminat alınması gibi bazı ihale şartları aranmayabilir.</p>

<h2>İstekliler İçin Pratik Çıkarımlar</h2>
<ul>
  <li>Çoğu fırsat <strong>açık ihale usulüyle</strong> duyurulur; takip stratejinizi buna göre kurun.</li>
  <li>Belli istekliler usulünde <strong>ön yeterliğe</strong> hazırlıklı olun.</li>
  <li>Temel ilkeler, hak ihlali durumunda <strong>itiraz</strong> gerekçeleriniz için dayanak oluşturur.</li>
</ul>

<h2>Sonuç</h2>
<p>4734 sayılı Kanun, kamu ihalelerinin anayasası gibidir; temel ilkeleri ve usulleri bilmek, hem hukukunuzu korumanın hem de doğru stratejiyle teklif vermenin önkoşuludur.</p>

<p><strong>İhaleZeka</strong>, yapay zekâ destekli eşleştirme sistemiyle açık ihale, belli istekliler ve pazarlık usulüyle çıkan ilanları firmanızın profiline göre sınıflandırır; size uygun usuldeki fırsatları öne çıkararak doğru ihaleye odaklanmanızı sağlar.</p>`,
  },
  {
    slug: "is-deneyim-belgesi-nedir-nasil-alinir",
    title: "İş Deneyim Belgesi Nedir, Nasıl Alınır ve Nasıl Kullanılır?",
    topic: "Belgeler",
    metaDescription:
      "İş deneyim belgesi nedir, nasıl alınır ve ihalelerde nasıl kullanılır? İş bitirme belgesi türleri ve başvuru süreci bu kapsamlı iş deneyim belgesi rehberinde.",
    body: "İş deneyim belgesinin ne olduğunu, türlerini, nasıl alınacağını ve ihalelerde nasıl kullanılacağını açıklayan kapsamlı rehber.",
    blogBody: `<p><strong>İş deneyim belgesi</strong>, bir firmanın veya kişinin daha önce gerçekleştirdiği işleri kanıtlayan resmi belgedir. Kamu ihalelerinde <strong>mesleki ve teknik yeterliğin</strong> en önemli kanıtlarından biridir. Birçok ihalede, belirli bir tutar veya nitelikteki işi daha önce yaptığınızı bu belgeyle göstermeniz beklenir.</p>

<h2>İş Deneyim Belgesi Neden Önemlidir?</h2>
<p>İdareler, işi güvenle teslim edebilecekleri yeterlikte istekliler ararlar. İş deneyim belgesi:</p>
<ul>
  <li>İşi tamamlayacak <strong>teknik kapasiteye</strong> sahip olduğunuzu gösterir.</li>
  <li>İhalenin yeterlik kriterlerini karşılamanızı sağlar.</li>
  <li>Rakipleriniz karşısında <strong>güvenilirlik</strong> avantajı sunar.</li>
</ul>

<h2>İş Deneyim Belgesi Türleri</h2>
<p>İş deneyimi, işteki rolünüze göre farklı belgelerle kanıtlanır:</p>
<ul>
  <li><strong>İş Bitirme Belgesi:</strong> Tamamlanmış bir işi yüklenici olarak bitirdiğinizi gösterir.</li>
  <li><strong>İş Durum Belgesi:</strong> Hâlen devam eden bir işte belirli bir kısmı gerçekleştirdiğinizi gösterir.</li>
  <li><strong>İş Yönetme Belgesi:</strong> İşin yönetiminden sorumlu olarak görev aldığınızı kanıtlar.</li>
  <li><strong>İş Denetleme Belgesi:</strong> İşin denetiminde görev alan teknik personel için düzenlenir.</li>
</ul>

<blockquote>Belge türleri ve değerlendirme kuralları; yapım işleri, hizmet alımları ve mal alımları için ilgili <strong>uygulama yönetmeliklerinde</strong> ayrı ayrı düzenlenir. İhale dokümanında hangi tür belgenin istendiğini mutlaka kontrol edin.</blockquote>

<h2>İş Deneyim Belgesi Nasıl Alınır?</h2>
<ol>
  <li><strong>İşi veren idareye başvuru:</strong> İşi gerçekleştirdiğiniz idareye, işe ilişkin belgelerle birlikte başvurursunuz.</li>
  <li><strong>İşin belgelendirilmesi:</strong> Sözleşme, hakediş, kabul tutanağı gibi belgeler incelenir.</li>
  <li><strong>Belgenin düzenlenmesi:</strong> İdare, mevzuata uygun şekilde iş deneyim belgesini düzenler.</li>
  <li><strong>EKAP’a kaydı:</strong> Düzenlenen belge, sahteciliği önlemek ve doğrulanabilirliği sağlamak amacıyla EKAP’a kaydedilir.</li>
</ol>

<h2>Benzer İş Kavramı</h2>
<p>İhalelerde çoğu zaman doğrudan aynı iş değil, ihale konusuna <strong>benzer iş</strong> deneyimi aranır. İdare, ihale dokümanında hangi işlerin benzer iş sayılacağını tanımlar. Elinizdeki belgenin, ilanın benzer iş tanımına uyup uymadığını teklif öncesi dikkatle değerlendirin.</p>

<h2>Belgenin Kullanımına İlişkin Kurallar</h2>
<ul>
  <li>İş deneyim belgeleri, mevzuatta belirlenen <strong>parasal ve oransal</strong> kriterler çerçevesinde değerlendirilir.</li>
  <li>Tüzel kişilerde belgenin kullanımı, ortaklık ve ortaklık süresine ilişkin koşullara tabidir.</li>
  <li>Belgenin geçerliliği ve kullanılabileceği süre/limitler için ilgili yönetmelik hükümleri esas alınır.</li>
</ul>

<h2>Sık Yapılan Hatalar</h2>
<ul>
  <li>İhalenin benzer iş tanımına uymayan belgeyle başvurmak</li>
  <li>Belge tutarının istenen yeterlik düzeyini karşılamaması</li>
  <li>EKAP’a kayıtlı olmayan veya doğrulanamayan belge sunmak</li>
  <li>Ortaklık koşullarına dikkat etmeden tüzel kişi belgesini kullanmak</li>
</ul>

<h2>Sonuç</h2>
<p>İş deneyim belgesi, ihale yeterliğinizin temel taşıdır. Hangi belgeye sahip olduğunuzu ve bunun hangi ihalelerde geçerli olacağını bilmek, başvuru stratejinizi doğrudan belirler.</p>

<p><strong>İhaleZeka</strong>, yapay zekâ destekli eşleştirme sistemiyle firmanızın iş deneyimi ve yeterlik profiline uyan ihaleleri tespit eder; benzer iş tanımına ve deneyim düzeyinize uygun fırsatları öne çıkararak boşa giden başvuruların önüne geçer.</p>`,
  },
  {
    slug: "ihalelerde-itiraz-ve-sikayet-sureci-kik-basvurusu",
    title: "İhalelerde İtiraz ve Şikayet Süreci: KİK Başvurusu Rehberi",
    topic: "İtiraz ve Şikayet",
    metaDescription:
      "İhalelerde itiraz ve şikayet süreci nasıl işler? İdareye şikayet ve Kamu İhale Kurumu’na (KİK) itirazen şikayet başvurusunun adımları bu rehberde açıklanıyor.",
    body: "Kamu ihalelerinde hak ihlali durumunda izlenecek şikayet ve itirazen şikayet (KİK başvurusu) sürecini anlatan rehber.",
    blogBody: `<p>Kamu ihalelerinde, sürecin hukuka aykırı yürütüldüğünü düşünen istekliler haklarını koruyacak yasal yollara sahiptir. <strong>4734 sayılı Kamu İhale Kanunu</strong>, hak ihlali iddialarının önce idareye, ardından <strong>Kamu İhale Kurumu’na (KİK)</strong> taşınabileceği iki kademeli bir başvuru sistemi öngörür. Bu yazıda şikayet ve itirazen şikayet sürecini adım adım ele alıyoruz.</p>

<h2>İki Kademeli Başvuru Sistemi</h2>
<p>İhale sürecindeki işlem ve eylemlere karşı başvuru yolu kademeli işler:</p>
<ol>
  <li><strong>İdareye şikayet:</strong> İlk olarak, işlemi yapan idareye yazılı şikayet başvurusu yapılır.</li>
  <li><strong>KİK’e itirazen şikayet:</strong> İdarenin kararı tatmin edici değilse veya süresinde karar verilmezse, Kamu İhale Kurumu’na itirazen şikayet başvurusu yapılır.</li>
</ol>

<h2>İdareye Şikayet Başvurusu</h2>
<p>Şikayet, ihale sürecindeki bir işlem veya eylemin hukuka aykırı olduğu iddiasıyla, doğrudan ihaleyi yapan idareye yapılır. Önemli noktalar:</p>
<ul>
  <li>Başvuru <strong>yazılı</strong> olmalı ve hukuka aykırılık iddiası ile talep açıkça belirtilmelidir.</li>
  <li>Başvuru, mevzuatta öngörülen <strong>süre içinde</strong> yapılmalıdır; süre kaçırılırsa hak düşer.</li>
  <li>İdare, başvuruyu inceleyerek karar verir ve bu kararı başvurana bildirir.</li>
</ul>

<blockquote>Süreler bu süreçte hayati önemdedir. Şikayet ve itirazen şikayet başvuruları, kanunda belirtilen kesin süreler içinde yapılmazsa esasa girilmeden reddedilir. Karar ve bildirim tarihlerini titizlikle takip edin.</blockquote>

<h2>KİK’e İtirazen Şikayet</h2>
<p>İdareye yapılan şikayet sonucunda alınan karara karşı veya idarenin süresinde karar vermemesi hâlinde, <strong>Kamu İhale Kurumu’na itirazen şikayet</strong> başvurusu yapılır. Bu aşamada dikkat edilecekler:</p>
<ul>
  <li>Başvuru, kanunda öngörülen <strong>süre içinde</strong> ve usulüne uygun yapılmalıdır.</li>
  <li>Başvuru için belirlenen <strong>başvuru bedelinin</strong> yatırılması gerekir; bu bedel her yıl güncellenir ve genellikle yaklaşık maliyete/işin niteliğine göre kademelidir.</li>
  <li>İddialarınızı, dayanaklarıyla birlikte açık ve belgeli biçimde sunmanız gerekir.</li>
</ul>

<h2>Kurumun İnceleme ve Kararı</h2>
<p>Kamu İhale Kurumu, başvuruyu inceledikten sonra çeşitli kararlar verebilir. Bunlar arasında şunlar yer alabilir:</p>
<ul>
  <li>İhale sürecindeki <strong>düzeltici işlemin</strong> belirlenmesi</li>
  <li><strong>İhalenin iptaline</strong> karar verilmesi</li>
  <li>Başvurunun <strong>reddedilmesi</strong> (esastan veya usulden)</li>
</ul>

<h2>İdari Yargı Yolu</h2>
<p>İtirazen şikayet üzerine Kurum tarafından verilen kararlara karşı, ilgililerin <strong>idari yargıya</strong> başvurma hakkı saklıdır. Yani süreç, KİK kararıyla mutlaka son bulmaz; hukuki denetim devam edebilir.</p>

<h2>Başvuruda Sık Yapılan Hatalar</h2>
<ul>
  <li>Yasal başvuru sürelerini kaçırmak</li>
  <li>Önce idareye başvurmadan doğrudan KİK’e gitmeye çalışmak</li>
  <li>İddiaları somut belge ve gerekçeyle desteklememek</li>
  <li>İtirazen şikayet başvuru bedelini eksik veya hatalı yatırmak</li>
</ul>

<h2>Sonuç</h2>
<p>İtiraz ve şikayet hakkı, ihale sürecinde hukukunuzu koruyan güçlü bir araçtır. Doğru zamanda, doğru kademede ve sağlam gerekçelerle yapılan başvurular, haksız işlemleri düzeltme şansı tanır.</p>

<p><strong>İhaleZeka</strong>, yapay zekâ destekli ihale takip ve analiz araçlarıyla süreçleri ve süreleri yakından izlemenize yardımcı olur; size uygun ihaleleri öne çıkarırken kritik tarihleri kaçırmamanız için bütünsel bir takip imkânı sunar.</p>`,
  },
  {
    slug: "uluslararasi-ihaleler-dunya-bankasi-ab-ted-firsatlar",
    title: "Uluslararası İhaleler: Dünya Bankası ve AB/TED Fırsatları",
    topic: "Uluslararası İhaleler",
    metaDescription:
      "Uluslararası ihaleler nasıl takip edilir? Dünya Bankası ve AB/TED ihalelerinde Türk firmaları için fırsatlar, kurallar ve başvuru süreci bu rehberde anlatılıyor.",
    body: "Dünya Bankası ve AB/TED gibi uluslararası ihale platformlarını ve Türk firmaları için sundukları fırsatları tanıtan rehber.",
    blogBody: `<p>Kamu alımları yalnızca yurt içiyle sınırlı değildir. <strong>Dünya Bankası</strong>, kalkınma bankaları ve <strong>Avrupa Birliği</strong> gibi aktörlerin finanse ettiği projeler, Türk firmaları için geniş bir uluslararası pazar sunar. Bu ihaleler 4734 sayılı Kanun’un değil, ilgili kuruluşların <strong>kendi satın alma kurallarının</strong> kapsamındadır. Doğru anlaşıldığında, ölçek ve itibar açısından önemli fırsatlar barındırır.</p>

<h2>Neden Uluslararası İhaleler?</h2>
<ul>
  <li>Yurt içi pazarın ötesinde <strong>büyüme</strong> imkânı</li>
  <li>Genellikle büyük ölçekli ve <strong>uzun vadeli</strong> projeler</li>
  <li>Uluslararası referans kazanarak <strong>kurumsal itibar</strong> artışı</li>
  <li>Döviz cinsinden gelir ve pazar çeşitlendirmesi</li>
</ul>

<h2>Dünya Bankası İhaleleri</h2>
<p>Dünya Bankası, finanse ettiği projelerde satın almaları kendi <strong>satın alma çerçevesi (Procurement Framework)</strong> ve düzenlemelerine göre yürütür. Türk firmaları açısından bilinmesi gerekenler:</p>
<ul>
  <li>İlanlar ve sözleşme bildirimleri Dünya Bankası’nın resmi <strong>satın alma portallarında</strong> yayımlanır.</li>
  <li>Süreçler, projelerin elektronik takibini sağlayan sistemler üzerinden yürütülür.</li>
  <li>Mal, yapım ve danışmanlık hizmetleri için <strong>farklı yöntemler</strong> ve standart ihale dokümanları uygulanır.</li>
  <li>Değerlendirmede <strong>uygunluk, deneyim ve mali yeterlik</strong> kriterleri belirleyicidir.</li>
</ul>

<blockquote>Uluslararası ihalelerde dokümanlar çoğunlukla İngilizce hazırlanır ve katı format kurallarına sahiptir. Belgelerin eksiksiz, doğru çevrilmiş ve istenen standartlara uygun olması başarı için kritiktir.</blockquote>

<h2>AB ve TED (Tenders Electronic Daily)</h2>
<p><strong>TED (Tenders Electronic Daily)</strong>, Avrupa Birliği’nin kamu ihale ilanlarının yayımlandığı resmi çevrimiçi platformudur; AB Resmi Gazetesi’nin kamu alımları ekine karşılık gelir. Belirli eşik değerlerin üzerindeki AB kamu ihaleleri burada duyurulur. Türk firmaları açısından önemli noktalar:</p>
<ul>
  <li>TED, AB genelindeki ihale fırsatlarını <strong>tek bir noktadan</strong> takip etme imkânı sunar.</li>
  <li>İlanlar standart formatta ve çok dilli yayımlanır.</li>
  <li>Katılım koşulları, ilgili AB mevzuatı ve ülke uygulamalarına tabidir.</li>
</ul>

<h2>Diğer Uluslararası Kaynaklar</h2>
<p>Dünya Bankası ve TED dışında, çeşitli kalkınma bankaları ve uluslararası kuruluşlar da düzenli ihaleler açar. Örnek olarak <strong>EBRD</strong> (Avrupa İmar ve Kalkınma Bankası), bölgesel kalkınma bankaları ve <strong>UNGM</strong> gibi Birleşmiş Milletler tedarik platformları sayılabilir. Her birinin kendi kayıt, ilan ve değerlendirme kuralları vardır.</p>

<h2>Türk Firmaları İçin Hazırlık Önerileri</h2>
<ol>
  <li><strong>Belgelerinizi uluslararası standartlara</strong> uygun ve İngilizce hazır tutun.</li>
  <li>İlgili portallara <strong>kayıt ve profil</strong> oluşturarak ilanları erken yakalayın.</li>
  <li>Deneyim ve referanslarınızı <strong>uluslararası formatta</strong> belgeleyin.</li>
  <li>Gerektiğinde yerel ortaklarla <strong>konsorsiyum/iş ortaklığı</strong> kurmayı değerlendirin.</li>
  <li>Her kuruluşun kendine özgü <strong>satın alma kurallarını</strong> önceden inceleyin.</li>
</ol>

<h2>Dikkat Edilmesi Gereken Riskler</h2>
<ul>
  <li>Farklı hukuk sistemleri ve sözleşme şartları</li>
  <li>Kur ve ödeme koşullarından kaynaklanan finansal riskler</li>
  <li>Dil ve dokümantasyon kaynaklı şekil hataları</li>
  <li>Uzun ve rekabeti yoğun değerlendirme süreçleri</li>
</ul>

<h2>Sonuç</h2>
<p>Uluslararası ihaleler, hazırlıklı Türk firmaları için ciddi bir büyüme kapısıdır. Ancak farklı kuralları ve yüksek standartları nedeniyle, doğru fırsatı seçmek ve titiz hazırlık yapmak şarttır.</p>

<p><strong>İhaleZeka</strong>, yapay zekâ destekli eşleştirme sistemiyle yurt içi ve uluslararası kaynaklardaki ihaleleri firmanızın kapasitesine ve hedeflerine göre tarar; Dünya Bankası ve AB/TED gibi platformlardaki uygun fırsatları öne çıkararak küresel pazarda doğru ihaleye odaklanmanızı sağlar.</p>`,
  },
];

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(9, 0, 0, 0);
  return d;
}

async function main() {
  const slugs = POSTS.map((p) => p.slug);

  // Idempotent: remove any existing rows for these slugs first.
  const deleted = await db
    .delete(socialPostsTable)
    .where(inArray(socialPostsTable.blogSlug, slugs))
    .returning({ id: socialPostsTable.id });
  console.log(`Removed ${deleted.length} existing row(s) for these slugs.`);

  // Spread publish dates across roughly the last 8 weeks, descending.
  const now = new Date();
  const rows = POSTS.map((p, i) => {
    const published = daysAgo(i * 6); // 0,6,12,... days ago (≈ last 8 weeks)
    return {
      userId: "system-seed",
      title: p.title,
      body: p.body,
      blogBody: p.blogBody,
      metaDescription: p.metaDescription,
      topic: p.topic,
      blogSlug: p.slug,
      status: "published" as const,
      platforms: [] as string[],
      imageUrl: null,
      publishedAt: published,
      // The public blog SSR sorts/displays by created_at, so align it with the
      // intended publish date for a correct, spread-out listing.
      createdAt: published,
      updatedAt: now,
    };
  });

  const inserted = await db
    .insert(socialPostsTable)
    .values(rows)
    .returning({ id: socialPostsTable.id, slug: socialPostsTable.blogSlug });

  console.log(`Inserted ${inserted.length} blog post(s):`);
  for (const r of inserted) console.log(`  #${r.id}  ${r.slug}`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
