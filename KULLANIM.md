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

## Botu çalıştırmak
- Kalıcı kurulum (Mac açılınca kendiliğinden başlar, uykuya geçmesini engeller):
  `cd ~/Desktop/ILMSANAT && ./scripts/bot_kur.sh` · kaldırmak: `./scripts/bot_kur.sh kaldir`
- Geçici: `cd ~/Desktop/ILMSANAT && ~/.local/node/bin/node otomasyon/bot.mjs`
- Mac kapalıyken / uyurken bot çalışmaz → ileride bulut sunucuya taşınacak.

## Bakım
- **Google Drive izni 7 günde bir biter** (Google uygulaması test modunda). Telegram'a uyarı gelince:
  `cd ~/Desktop/ILMSANAT && ~/.local/node/bin/node otomasyon/drive_baglan.mjs` → ozturkbusralena@gmail.com ile izin ver.
- **Claude API kredisi**: platform.claude.com → Billing. Bitince Telegram'a uyarı gelir.
- **Magnific kredisi**: magnific.com → API Keys sayfasında "Credit usage".
- Günlük kayıt: `data/gunluk.log` · taslaklar: `data/taslaklar.json` · paylaşılanlar: `data/paylasilanlar.json`

## Dosyalar
- `otomasyon/bot.mjs` takvim + Telegram · `haberler.mjs` kaynaklar · `icerik.mjs` Claude planı · `uret.mjs` Magnific + Remotion · `paylas.mjs` Instagram/TikTok · `drive.mjs` Drive
- `video/src/HaberVideo.tsx` video şablonu · `STIL_REHBERI.md` stil kuralları · `config/` ayarlar ve kaynaklar
