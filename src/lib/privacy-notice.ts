/**
 * @fileoverview Provides the complete Turkish and English privacy/KVKK notice used by the public privacy route.
 */
import type { Locale } from "@/lib/i18n";

interface PrivacyNoticeContent {
  pageTitle: string;
  pageIntro: string;
  lastUpdated: string;
  backHome: string;
  languageLabel: string;
  collectedTitle: string;
  localDataTitle: string;
  localDataBody: string;
  technicalDataTitle: string;
  technicalDataBody: string;
  purposesTitle: string;
  purposesBody: string;
  legalBasisTitle: string;
  legalBasisBody: string;
  sharingTitle: string;
  sharingBody: string;
  vercelLabel: string;
  cartoLabel: string;
  sismikLabel: string;
  appInsightsLabel: string;
  transfersTitle: string;
  transfersBody: string;
  retentionTitle: string;
  retentionBody: string;
  cookiesTitle: string;
  cookiesBody: string;
  rightsTitle: string;
  rightsBody: string;
  securityTitle: string;
  securityBody: string;
  childrenTitle: string;
  childrenBody: string;
  aiTitle: string;
  aiBody: string;
  changesTitle: string;
  changesBody: string;
  forecastTitle: string;
  forecastBody: string;
}

/**
 * Maps every privacy-notice sentence to both supported locales so the legal disclosure follows the dashboard language without losing content.
 */
export const privacyNotice: Record<Locale, PrivacyNoticeContent> = {
  en: {
    pageTitle: "Privacy Notice & KVKK Disclosure",
    pageIntro: "This notice explains how visitor information is handled when you use the Türkiye Earthquake Forecast website.",
    lastUpdated: "Last updated: 27 August 2026",
    backHome: "← Back to dashboard",
    languageLabel: "Türkçe",
    collectedTitle: "1. Information handled",
    localDataTitle: "Device preferences",
    localDataBody: "Language (`locale`), theme (`theme`), dismissed-warning status (`disclaimer-dismissed`), and the last map center/zoom (`map-view`) are stored only in your browser's localStorage. An anonymous visit identifier (`telemetry-installation-id`) is also stored in localStorage to count visits as described in section 7 and is only sent for that purpose. The application does not transmit the four preferences to the operator. You can delete them through your browser's site-data controls.",
    technicalDataTitle: "Technical connection data",
    technicalDataBody: "When the website and map tiles are requested, hosting and map infrastructure may automatically process IP address, request time, requested URL, referrer, browser/device information, and security or error records. The operator does not use this information to build advertising profiles.",
    purposesTitle: "2. Purposes",
    purposesBody: "Information is processed only to deliver and secure the website, diagnose failures, maintain service continuity, count anonymous visits (section 7), remember requested interface preferences, and comply with legal obligations.",
    legalBasisTitle: "3. Collection method and legal basis",
    legalBasisBody: "Technical data is collected automatically through electronic requests. The anonymous visit event (section 7) is sent automatically when you open the site. Processing is based, as applicable, on KVKK Article 5/2(ç) (legal obligation), 5/2(e) (establishment, exercise, or protection of a right), and 5/2(f) (legitimate interests, without harming fundamental rights and freedoms). Device-only preferences are stored to provide functionality you request and are not received by the site operator.",
    sharingTitle: "4. Service providers and disclosure",
    sharingBody: "The earthquake catalogue is obtained server-side from the Sismik Harita API; visitors' browsers do not request catalogue data directly from Sismik Harita. The website is hosted on Vercel. Map images are requested directly from CARTO and use OpenStreetMap data. An anonymous `app.startup` visit event is sent directly from your browser to Microsoft Application Insights (see section 7) to count visits. Vercel, CARTO, and Microsoft may receive technical connection data to deliver, secure, and operate their services. Information may also be disclosed to authorized public bodies when legally required. Visitor personal data is not sold. Sources and provider notices:",
    vercelLabel: "Vercel Privacy Notice",
    cartoLabel: "CARTO Privacy Notice",
    sismikLabel: "Data source: Sismik Harita API",
    appInsightsLabel: "Microsoft Application Insights Privacy",
    transfersTitle: "5. International processing",
    transfersBody: "Vercel, CARTO, and Microsoft Application Insights operate infrastructure outside Türkiye; requests to them may therefore involve processing or transfer abroad. Such transfers must be handled under the applicable safeguards and procedures in KVKK Article 9. Avoid using the site if you do not want your browser to request resources from these providers.",
    retentionTitle: "6. Retention",
    retentionBody: "Browser preferences remain until you clear them; the anonymous visit identifier persists until cleared and is replaced with a new random value if deleted. Infrastructure and analytics records are retained for the shortest period needed for security, troubleshooting, service delivery, and legal requirements, subject to provider settings and policies, then deleted or anonymized where applicable.",
    cookiesTitle: "7. Cookies and analytics",
    cookiesBody: "The website does not set advertising cookies. It uses localStorage for the preferences listed above and sends one anonymous `app.startup` event to Microsoft Application Insights per page load to count visits (same mechanism as the SessionLens desktop app). The event contains only the application name, version, browser language, platform, and a random anonymous identifier (`telemetry-installation-id` stored in localStorage); it does not contain your name, page content, or catalogue data. Microsoft may log the connection IP as part of delivering its service. No advertising profile is built from this event.",
    rightsTitle: "8. Your KVKK rights",
    rightsBody: "Under KVKK Article 11, you may ask whether your personal data is processed; request information, correction, or deletion; learn the purpose, recipients, and relevant automated results; object where permitted; and request compensation where the statutory conditions are met.",
    securityTitle: "9. Security",
    securityBody: "Reasonable technical and organizational measures are used to limit unauthorized access and misuse. No internet transmission or storage method can be guaranteed to be completely secure.",
    childrenTitle: "10. Children",
    childrenBody: "The website is a general-information research interface, is not directed to children, and does not knowingly request personal information from children.",
    aiTitle: "11. Use of AI tools during development",
    aiBody: "AI tools were used to assist with application development: Claude Fable 5, GPT 5.6 Sol, and DeepSeek Pro. These tools supported the development process; the published website does not send visitor information to them.",
    changesTitle: "12. Changes",
    changesBody: "Material changes will be published on this page with a new update date. Review this notice periodically, especially if new site features are introduced.",
    forecastTitle: "Important seismic-information notice",
    forecastBody: "Privacy terms do not change the site's scientific disclaimer: displayed scores are experimental relative regional rankings, not earthquake occurrence probabilities, official forecasts, or emergency warnings. Follow competent authorities for safety decisions.",
  },
  tr: {
    pageTitle: "Gizlilik Bildirimi ve KVKK Aydınlatma Metni",
    pageIntro: "Bu metin, Türkiye Deprem Tahmini internet sitesini kullandığınızda ziyaretçi bilgilerinin nasıl ele alındığını açıklar.",
    lastUpdated: "Son güncelleme: 27 Ağustos 2026",
    backHome: "← Panele dön",
    languageLabel: "English",
    collectedTitle: "1. Ele alınan bilgiler",
    localDataTitle: "Cihaz tercihleri",
    localDataBody: "Dil (`locale`), tema (`theme`), kapatılan uyarı durumu (`disclaimer-dismissed`) ve son harita merkezi/yakınlaştırma değeri (`map-view`) yalnızca tarayıcınızın localStorage alanında saklanır. Anonim ziyaret tanımlayıcısı (`telemetry-installation-id`) da ziyaret sayımı için (bkz. bölüm 7) localStorage'da saklanır ve yalnızca bu amaçla gönderilir. Uygulama bu dört tercihi site sahibine iletmez. Bunları tarayıcınızın site verileri ayarlarından silebilirsiniz.",
    technicalDataTitle: "Teknik bağlantı verileri",
    technicalDataBody: "Site ve harita döşemeleri istendiğinde barındırma ve harita altyapısı; IP adresi, istek zamanı, istenen adres, yönlendiren sayfa, tarayıcı/cihaz bilgisi ile güvenlik veya hata kayıtlarını otomatik olarak işleyebilir. Site sahibi bu bilgileri reklam profili oluşturmak için kullanmaz.",
    purposesTitle: "2. İşleme amaçları",
    purposesBody: "Bilgiler yalnızca siteyi sunmak ve güvenliğini sağlamak, hataları gidermek, hizmet sürekliliğini korumak, anonim ziyaretleri saymak (bölüm 7), talep ettiğiniz arayüz tercihlerini hatırlamak ve yasal yükümlülüklere uymak amacıyla işlenir.",
    legalBasisTitle: "3. Toplama yöntemi ve hukuki sebep",
    legalBasisBody: "Teknik veriler elektronik istekler aracılığıyla otomatik olarak elde edilir. Anonim ziyaret olayı (bölüm 7) site açıldığında otomatik olarak gönderilir. İşleme faaliyeti, uygulanabildiği ölçüde KVKK'nın 5/2(ç) (hukuki yükümlülük), 5/2(e) (bir hakkın tesisi, kullanılması veya korunması) ve temel hak ve özgürlüklerinize zarar vermemek kaydıyla 5/2(f) (meşru menfaat) hükümlerine dayanır. Yalnızca cihazda tutulan tercihler talep ettiğiniz işlevi sağlamak için kaydedilir ve site işletmecisi tarafından alınmaz.",
    sharingTitle: "4. Hizmet sağlayıcılar ve aktarım",
    sharingBody: "Deprem kataloğu sunucu tarafında Sismik Harita API'sinden alınır; ziyaretçilerin tarayıcıları katalog verisi için Sismik Harita'ya doğrudan istek göndermez. Site Vercel üzerinde barındırılır. Harita görselleri doğrudan CARTO'dan istenir ve OpenStreetMap verisini kullanır. Ziyaret sayımı için tarayıcınızdan doğrudan Microsoft Application Insights'a anonim bir `app.startup` olayı gönderilir (bkz. bölüm 7). Vercel, CARTO ve Microsoft hizmetlerini sunmak, güvenliğini sağlamak ve işletmek için teknik bağlantı verilerini alabilir. Bilgiler ayrıca hukuken zorunlu olduğunda yetkili kamu kurumlarıyla paylaşılabilir. Ziyaretçilere ait kişisel veriler satılmaz. Kaynak ve sağlayıcı metinleri:",
    vercelLabel: "Vercel Gizlilik Bildirimi",
    cartoLabel: "CARTO Gizlilik Bildirimi",
    sismikLabel: "Veri kaynağı: Sismik Harita API",
    appInsightsLabel: "Microsoft Application Insights Gizliliği",
    transfersTitle: "5. Yurt dışında işleme",
    transfersBody: "Vercel, CARTO ve Microsoft Application Insights Türkiye dışında altyapı işletir; bu hizmetlere gönderilen istekler yurt dışında işleme veya aktarım doğurabilir. Bu aktarımların KVKK'nın 9. maddesindeki uygulanabilir güvence ve usullere uygun yürütülmesi gerekir. Tarayıcınızın bu sağlayıcılardan kaynak istemesini istemiyorsanız siteyi kullanmayın.",
    retentionTitle: "6. Saklama süreleri",
    retentionBody: "Tarayıcı tercihleri siz silene kadar cihazınızda kalır; anonim ziyaret tanımlayıcısı silinene kadar kalır ve silinirse yeni rastgele bir değer oluşturulur. Altyapı ve analiz kayıtları; güvenlik, hata giderme, hizmet sunumu ve hukuki gereklilikler için gereken en kısa süre boyunca, sağlayıcı ayarları ve politikalarına tabi olarak tutulur; ardından uygun olduğu ölçüde silinir veya anonimleştirilir.",
    cookiesTitle: "7. Çerezler ve analiz",
    cookiesBody: "Site reklam çerezi yerleştirmez. Yukarıdaki tercihler için localStorage kullanır ve ziyaretleri saymak için her sayfa yüklemesinde Microsoft Application Insights'a tek bir anonim `app.startup` olayı gönderir (SessionLens masaüstü uygulamasıyla aynı mekanizma). Olay yalnızca uygulama adı, sürüm, tarayıcı dili, platform ve localStorage'da saklanan rastgele bir anonim tanımlayıcıyı (`telemetry-installation-id`) içerir; adınız, sayfa içeriği veya katalog verisi içermez. Microsoft hizmeti sunarken bağlantı IP'sini kaydedebilir. Bu olaydan reklam profili oluşturulmaz.",
    rightsTitle: "8. KVKK kapsamındaki haklarınız",
    rightsBody: "KVKK'nın 11. maddesi uyarınca kişisel verilerinizin işlenip işlenmediğini öğrenme; bilgi, düzeltme veya silme talep etme; işleme amacını, alıcıları ve ilgili otomatik sonuçları öğrenme; izin verilen hâllerde itiraz etme ve kanuni şartlar oluşmuşsa zararın giderilmesini isteme haklarına sahipsiniz.",
    securityTitle: "9. Güvenlik",
    securityBody: "Yetkisiz erişimi ve kötüye kullanımı sınırlamak için makul teknik ve idari önlemler uygulanır. Hiçbir internet iletimi veya saklama yöntemi için mutlak güvenlik garanti edilemez.",
    childrenTitle: "10. Çocuklar",
    childrenBody: "Site genel bilgi sunan bir araştırma arayüzüdür, çocuklara yönelik değildir ve çocuklardan bilerek kişisel bilgi talep etmez.",
    aiTitle: "11. Geliştirme sırasında AI araçlarının kullanımı",
    aiBody: "Uygulama geliştirilirken AI araçlarından yardım alınmıştır: Claude Fable 5, GPT 5.6 Sol ve DeepSeek Pro. Bu araçlar geliştirme sürecini desteklemiştir; yayımlanan site ziyaretçi bilgilerini bu araçlara göndermez.",
    changesTitle: "12. Değişiklikler",
    changesBody: "Önemli değişiklikler yeni güncelleme tarihiyle bu sayfada yayımlanır. Özellikle yeni site özellikleri eklendiğinde bu metni dönemsel olarak inceleyin.",
    forecastTitle: "Önemli sismik bilgi notu",
    forecastBody: "Gizlilik hükümleri sitenin bilimsel uyarısını değiştirmez: gösterilen skorlar deneysel göreli bölgesel sıralamalardır; deprem gerçekleşme olasılığı, resmî tahmin veya acil durum uyarısı değildir. Güvenlik kararlarında yetkili kurumları izleyin.",
  },
};
