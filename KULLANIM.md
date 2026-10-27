# İlm Sanat Otomasyonu – Kullanım

## Günlük akış (Viyana saati)
| Paylaşım | Taslak Telegram'a gelir | İçerik |
|---|---|---|
| 09:00 | 07:00 | Haber |
| 11:00 (Pazar) | 09:00 | Oryantalist tablo (Met Müzesi, kamu malı) |
| 14:00 | 12:00 | Analiz (önce AA Analiz) |
| 20:00 | 18:00 | Haber |

Taslağın altında: **✅ Paylaş** (saatinde paylaşılır) · **✏️ Değiştir** (ne istediğini yaz, yeniden üretilir) · **⏭ Atla**.
Cevap vermezsen 15 dk önce hatırlatılır, saatinde otomatik paylaşılır.
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
- **Google Drive izni 7 günde bir biter** (Google uygulaması test modunda). Telegram'a uyarı gelince:
  `cd ~/Desktop/ILMSANAT && ~/.local/node/bin/node otomasyon/drive_baglan.mjs` → ozturkbusralena@gmail.com ile izin ver.
- **Claude API kredisi**: platform.claude.com → Billing. Bitince Telegram'a uyarı gelir.
- **Magnific kredisi**: magnific.com → API Keys sayfasında "Credit usage".
- Günlük kayıt: `data/gunluk.log` · taslaklar: `data/taslaklar.json` · paylaşılanlar: `data/paylasilanlar.json`

## Dosyalar
- `otomasyon/bot.mjs` takvim + Telegram · `haberler.mjs` kaynaklar · `icerik.mjs` Claude planı · `uret.mjs` Magnific + Remotion · `paylas.mjs` Instagram/TikTok · `drive.mjs` Drive
- `video/src/HaberVideo.tsx` video şablonu · `STIL_REHBERI.md` stil kuralları · `config/` ayarlar ve kaynaklar
