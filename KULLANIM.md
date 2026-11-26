# İlm Sanat Otomasyonu – Kullanım

## Günlük akış (Viyana saati)
| Paylaşım | Taslak Telegram'a gelir | İçerik |
|---|---|---|
| 09:00 | ~06:30 | Haber |
| 11:00 (Cumartesi ve Pazar) | ~08:30 | Oryantalist tablo (Met Müzesi, kamu malı; sadece Orta Doğu, Kuzey Afrika, İslam coğrafyası) |
| 14:00 | ~11:30 | Analiz (önce AA Analiz) |
| 18:00 | ~15:30 | Haber |

**Onay yok** (26 Kasım 2026): video bilgi için Telegram'a gelir ve saatinde kendiliğinden paylaşılır. Paylaşılmasın istersen Telegram'a **/atla** yaz (sıradaki hazır video iptal edilir). Link ya da /konu ile istenen özel video hazır olunca hemen paylaşılır.
**İçerik**: Türkiye merkezli haber/analiz seçilmez (Türkiye'nin kendi siyaseti); Türk kaynaklarından Arap dünyası, İran, Kuzey Afrika, İslam coğrafyası haberleri seçilir. /konu ile açıkça istenirse Türkiye konusu da olur.
**Kendi kendine toparlanma** (26 Kasım 2026): üretim hata verirse 2 ve 4 dk sonra yeniden denenir (biten Magnific dosyaları tekrar üretilmez); Instagram paylaşımı olmazsa 10 dk arayla 2 kez daha denenir. GitHub turu geç gelirse taslak geç de olsa (en fazla 3 saat) paylaşılır.
**Uyarılar**: her sabah ~06:00 "☀️ Günaydın" mesajı (Drive, Instagram, TikTok, Claude kontrolü + dünün özeti). Çözülemeyen sorun 🚨 ile Telegram'a gelir **ve** GitHub ozturkbusralena@gmail.com adresine "Run failed" e-postası gönderir (her sorun için günde bir kez). E-posta gelirse Telegram'daki 🚨 mesajına bak.
Instagram'a Reel olarak gider; TikTok'a taslak gider (TikTok → Gelen Kutusu → sistem bildirimleri → paylaş).

## Telegram komutları (@ilmsanat_bot)
- Bir haber **linki** gönder → o haberden video hazırlanır (sadece Paylaş'a basarsan paylaşılır)
- `/konu Sudan'da iç savaş` → o konuda haber seçilip video hazırlanır
- `/durum` → bugünün taslakları
- `/durdur` · `/baslat` → takvimi durdur / başlat
- `/kling 2` → video başına kaç çekim Kling ile hareketlensin (0–5; kredi tasarrufu)

## Bot nerede çalışıyor
- **GitHub Actions** (2026-10-28'den beri): https://github.com/ozturkbusralena-spec/ilmsanat-bot — her 10 dakikada bir tur
  çalışır, Mac'ten bağımsız. Telegram düğmelerine en geç ~10–15 dk içinde tepki verir.
  Çalışmaları görmek: depo → **Actions** sekmesi. Elle bir tur başlatmak: Actions → ilmsanat-bot → **Run workflow**.
- Gizli bilgiler GitHub → Settings → Secrets'ta (`ENV_DOSYASI` = .env'in tamamı, `GH_PAT`).
- Kodda değişiklik yaptıktan sonra GitHub'a göndermek (botun durum dosyalarına dokunmaz):
  `cd ~/Desktop/ILMSANAT && ~/.local/node/bin/node scripts/github_yukle.mjs ozturkbusralena-spec/ilmsanat-bot`
- ⚠️ Mac'te botu **çalıştırma** (`bot.mjs`, `bot_kur.sh`): GitHub'daki bot ile aynı anda çalışırsa her şey iki kez olur.

## Bakım
- **Google Drive izni**: Google uygulaması 26 Kasım 2026'dan beri "In Produktion", izin artık kendiliğinden bitmez. Yine de Telegram'a Drive uyarısı gelirse (ör. izin elle kaldırıldıysa):
  `cd ~/Desktop/ILMSANAT && ~/.local/node/bin/node otomasyon/drive_baglan.mjs` → ozturkbusralena@gmail.com ile izin ver,
  sonra `~/.local/node/bin/node scripts/github_yukle.mjs ozturkbusralena-spec/ilmsanat-bot --sadece-secret`.
  Bot izin yokken video üretmez (Magnific kredisi boşa gitmez).
- Google Cloud Console iki adımlı doğrulama ister (10 Kasım 2026'dan beri). Uygulamanın ana sayfası ve gizlilik politikası GitHub Pages'te: https://ozturkbusralena-spec.github.io/ilmsanat-bot/ (kaynak `docs/`).
- **Claude API kredisi**: platform.claude.com → Billing. Bitince Telegram'a uyarı gelir.
- **Magnific kredisi**: magnific.com → API Keys sayfasında "Credit usage".
- Günlük kayıt: `data/gunluk.log` · taslaklar: `data/taslaklar.json` · paylaşılanlar: `data/paylasilanlar.json`

## Dosyalar
- `otomasyon/bot.mjs` takvim + Telegram · `haberler.mjs` kaynaklar · `icerik.mjs` Claude planı · `uret.mjs` Magnific + Remotion · `paylas.mjs` Instagram/TikTok · `drive.mjs` Drive
- `video/src/HaberVideo.tsx` video şablonu · `STIL_REHBERI.md` stil kuralları · `config/` ayarlar ve kaynaklar
