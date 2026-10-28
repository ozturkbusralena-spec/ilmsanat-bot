# İlm Sanat – Instagram & TikTok Otomasyonu: Yol Haritası

> Kararlaştırılan ayarlar: `config/ayarlar.yaml` · Açık sorular: `EKSIKLER_VE_SORULAR.md`

## 1. Ne yapacak?

| Ne | Ne zaman (Viyana saati) | İçerik |
|---|---|---|
| Haber 1 | Her gün 09:00 | Orta Doğu ağırlıklı jeopolitik haber, İngilizce uzun akademik metin + klasik sanat havasında görsel |
| Analiz | Her gün 14:00 | Önce AA Analiz, yoksa SETA / MEE / MEMO; İngilizce kendi cümlelerimizle |
| Haber 2 | Her gün 18:00 | Aynı (haber) |
| Oryantalist tablo | Her Pazar 11:00 (ek, 4. paylaşım) | Gerçek, kamu malı tablo + eserin hikâyesi + ressamın kısa biyografisi |

Instagram'a doğrudan, TikTok'a **taslak** olarak gider (müzikli Magnific videosu; paylaşımı sen telefondan yaparsın). Hepsi önce **Telegram'dan senin onayına** gelir; cevap vermezsen saatinde otomatik gider.

## 2. Mimari

Telegram'dan anında komut alabilmek için sistemin 7/24 açık olması gerekiyor. Bu yüzden GitHub Actions yerine **küçük bir bulut sunucu** kullanıyoruz (Hetzner, ~4,5 €/ay, Almanya/Finlandiya). Tek bir Python programı hem zamanlayıcı hem Telegram botu olarak çalışır.

```
                    ┌──────────── Bulut sunucu (7/24) ────────────┐
[Haber kaynakları]──►  1. Haberleri/analizleri çek                │
                    │  2. Claude: konuya göre puanla, en iyisini  │
                    │     seç (MENA jeopolitiği > Afrika > Çin/   │
                    │     Rusya > siyasi tarih), tekrarı engelle  │
                    │  3. Claude: İngilizce uzun akademik metin   │
                    │     + görsel tarifi yaz                     │
[Görsel servisi]◄───┤  4. Görseli üret, logo/başlık bindir        │
                    │                                             │
[Telegram – sen]◄───┤  5. Taslağı gönder: [Onayla][Değiştir][Atla]│
       │            │                                             │
       └──"Değiştir: │  6. Talimata göre yeniden yaz/üret → tekrar │
          daha kısa" │     onaya gönder                            │
                    │  7. Onaylanınca paylaşım saatinde:          │
                    │     ├─► Instagram API                       │
                    │     └─► TikTok API                          │
                    │  8. Paylaşım linklerini Telegram'a gönder   │
                    └─────────────────────────────────────────────┘
```

Taslaklar paylaşım saatinden **2 saat önce** (11:00 ve 18:00) Telegram'a gelir, böylece okuyup düzeltmeye vaktin olur. **Cevap vermezsen taslak paylaşım saatinde otomatik paylaşılır**; paylaşım saatinden 15 dk önce son bir hatırlatma gelir. "Atla" dersen paylaşılmaz.

### Telegram komutları (planlanan)
| Komut | Ne yapar |
|---|---|
| Bir haber linki gönder | O linkten içerik hazırlar, onaya getirir |
| `/konu Sudan'daki iç savaşın Kızıldeniz'e etkisi` | Bu konu üzerine içerik hazırlar |
| `/sira` | Sıradaki planlı paylaşımları gösterir |
| `/durdur` – `/baslat` | Otomasyonu geçici durdurur / başlatır |
| Taslak altındaki **Değiştir** + serbest yazı | Örn. "başlığı değiştir", "görseli daha karanlık yap", "Balfour'a değin" |

Bot **sadece senin Telegram hesabından** gelen mesajları dinler; başkası komut veremez.

## 3. Adım adım kurulum

### Aşama 0 – Senden gelecekler
1. Haber/analiz kaynak linkleri → `config/kaynaklar.yaml`
2. Logo, renkler, yazı tipi → `marka/` klasörü
3. Sosyal medya linkleri, görsel üretim servisi linki

### Aşama 1 – Hesaplar (birlikte yapacağız, ekran ekran anlatacağım)
4. **Facebook Sayfası** ↔ Instagram (ilmsanat) bağlantısını yap (Sayfa ayarları → Bağlı hesaplar).
5. **Meta for Developers** hesabı → uygulama oluştur → Instagram API ekle. Uygulamayı yalnızca kendi hesabın için kullanacağımızdan uzun App Review sürecine büyük ihtimalle gerek kalmayacak.
6. **TikTok** hesabını tamamla → **TikTok for Developers** → uygulama → *Content Posting API* → alan adı doğrulama → **audit başvurusu**.
   - ⚠️ Audit onaylanana kadar TikTok'a giden paylaşımlar sadece "Yalnızca ben" görünür. Bu süre içinde Instagram tam çalışır, TikTok'u sonradan açarız.
7. **Alan adı** satın al (örn. `ilmsanat.com`, ~10–12 $/yıl). TikTok görselleri doğrulanmış bir alan adından istiyor; görseller buradan sunulacak. İleride basit bir web sitesi de olur.
8. **Telegram botu**: Telegram'da @BotFather → `/newbot` → "İlm Sanat Bot" → verdiği token'ı bana ilet (güvenli şekilde, `.env` dosyasına).
9. **Hetzner** hesabı → en küçük sunucu (CX22). Ödeme bilgisini sen girersin, kurulumu ben yaparım.

### Aşama 2 – API anahtarları
10. **Anthropic (Claude) API** anahtarı (console.anthropic.com) → metin yazımı ve haber seçimi.
11. **Görsel servisi** anahtarı (senin göndereceğin servis).

### Aşama 3 – Kod (ben yazacağım)
12. Proje iskeleti (Python), ayarların `config/` dosyalarından okunması.
13. Haber çekme + Claude ile konu puanlama + tekrar engelleme.
14. Metin üretimi: İngilizce, akademik, uzun; kaynak adı (sadece açıklamada) + hashtag seti. Yapay zekâ notu yazılmaz.
15. Görsel üretimi: klasik sanat stili için hazır prompt şablonu ve "yapay görünüm" önleyici negatif talimatlar; logo/başlık bindirme; IG ve TikTok boyutları.
16. Telegram botu: onay akışı, "Değiştir" ile yeniden üretme, link/konu komutları, hata bildirimi.
17. Instagram + TikTok paylaşım modülleri, Meta token'ının otomatik yenilenmesi.
18. Pazar oryantalist tablo modülü: Met Museum / Art Institute of Chicago / Wikimedia'dan kamu malı eser, çıplaklık filtresi, daha önce paylaşılanı tekrar etmeme.

### Aşama 4 – Test
19. Kuru çalıştırma: 3–4 gün boyunca taslaklar sadece Telegram'a gelir, hiçbir yere paylaşılmaz. Stil ve metni birlikte oturturuz.
20. Instagram'da gerçek test paylaşımı, TikTok'ta gizli test.

### Aşama 5 – Canlı
21. Zamanlayıcıyı aç. İlk ay sonunda Instagram istatistiklerine bakıp paylaşım saatlerini ayarla.

## 4. Dikkat edilmesi gerekenler

- **Analizler ve telif**: Kaynaklardaki analizler kullanılacak, ama metin **kopyalanmaz**; kendi cümlelerimizle yeniden yazılır ve sonunda "Source: …" ile kaynak belirtilir.
- **"Yapay zeka gibi görünmesin"**: Görseller 19. yy yağlı boya, gravür, eski harita, arşiv fotoğrafı dokusunda olacak. Yakın plan yüz, parlak plastik ışık ve görsel içine yazı üretilmeyecek (başlık sonradan bizim yazı tipimizle bindirilir), bu da AI izlenimini en çok azaltan şey.
- **Gerçek kişiler**: Liderler ve politikacılar görselde çizilmez; mekân, harita, sembol ve temsili sahne kullanılır.
- **Yapay zekâ notu**: Kullanıcı kararı (2026-10-26): hiçbir paylaşımda yazılmaz, TikTok'ta AI bayrağı işaretlenmez. Görseller gerçekçi fotoğraf değil, resim/gravür tarzında üretilir.
- **Hassas içerik**: Savaş/çatışma haberlerinde kan, ceset gibi grafik görüntü üretilmez (platformlar erişimi kısıtlar).
- **Hesap güvenliği**: Tüm anahtarlar sunucuda gizli `.env` dosyasında durur, hiçbir zaman Telegram'a ya da koda yazılmaz.

## 5. Tahmini aylık maliyet (bütçe: en fazla 15 $)

| Kalem | Tahmin |
|---|---|
| Hetzner sunucu | ~5 $ |
| Alan adı | ~1 $ (yıllık ~12 $) |
| Claude API (seçim + uzun metin + düzeltmeler) | ~2–4 $ |
| Görsel üretimi (~70 görsel + düzeltmeler) | servise göre; 15 $ sınırını aşmayacak model seçilecek |
| Telegram, Meta, TikTok API | 0 $ |

Bütçeyi aşmamak için kod aylık harcamayı sayacak; sınıra yaklaşınca Telegram'dan uyarı gelecek.
