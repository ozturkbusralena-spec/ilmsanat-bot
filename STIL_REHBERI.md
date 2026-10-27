# İlm Sanat – Video Stil Rehberi

Örnek alınan format: @insidegeopolitics Reels (koyu harita arka planı, renkli etiket, kalın başlık, vurgulu anahtar kelimeler, seslendirme).
Bizim farkımız: İlm Sanat renkleri (lacivert, yeşil, altın) ve klasik sanat havası — harita gravürü, yağlı boya sahne, eski atlas dokusu.

## Format
| | |
|---|---|
| Boyut | 1080×1920 (9:16), 30 fps |
| Süre | 30–45 sn (haber), 45–60 sn (analiz / Pazar tablosu) |
| Seslendirme | İngilizce, ~2,5 kelime/sn → haber 80–110 kelime |
| Ses | ElevenLabs "Daniel" (sakin, İngiliz aksanlı haber sunucusu) – Magnific voiceover |
| Müzik | Google Lyria, sinematik gerilimli ambient (ney / ud / yaylılar), seslendirmenin altında kısık |
| Kapanış | 2 sn logo + "Follow @ilmsanat" |

## Ekran düzeni
```
┌────────────────────────────┐
│                  [LOGO]    │  sağ üst, şeffaf logo
│                            │
│     arka plan görseli      │  yavaş yakınlaşma / kayma
│   (harita, gravür, sahne)  │  + bir sahnede Kling hareketi
│                            │
│ [KEY DEVELOPMENT]          │  etiket: altın kutu, lacivert yazı
│ Başlık beyaz, anahtar      │  Open Sans 800
│ kelimeler ALTIN            │
│ WHAT HAPPENED: kısa özet   │  altın küçük başlık + beyaz metin
│                            │
│   ── altyazı (ses ile) ──  │  orta, 2–4 kelimelik gruplar
│                            │  (videoda kaynak satırı yok)
└────────────────────────────┘
```

## Renkler
| Ad | Kod | Kullanım |
|---|---|---|
| Gece laciverti | `#0b1424` | Arka plan karartması, gölgeler |
| Grauorange (marka) | `#907640` | Vurgulu kelimeler, etiket kutusu, çizgiler |
| Fildişi | `#f3ecdc` | Başlık ve metin |
| Dunkelblau (marka) | `#142d54` | Ülke vurgusu, kapanış zemini |
| Dunkelgrün (marka) | `#183c25` | "ANALYSIS" etiketi |

Marka renkleri kullanıcı tarafından verildi (2026-10-26): `#183c25` Dunkelgrün, `#142d54` Dunkelblau, `#907640` Grauorange.
| Kırmızı | `#b3261e` | Sadece "ESCALATION / BREAKING" |

## Etiketler
`KEY DEVELOPMENT` · `ESCALATION` · `ANALYSIS` · `MAP EXPLAINER` · `HISTORY` · `ORIENTALIST ART` (Pazar)

## Görsel üretim kuralları (Magnific Seedream 4.5)
- Stil: "dark desaturated 19th-century engraved map / oil painting, muted navy and gold tones, dramatic chiaroscuro, film grain"
- Yasak: tanınabilir gerçek kişi yüzü, kan/ceset, görsel içine yazı, parlak plastik "AI" görünüm
- Her video: 2–3 arka plan görseli + 1 tanesi Kling ile 5 sn hareket

## Instagram / TikTok metni
- Instagram açıklaması: başlık + 2–3 paragraf akademik İngilizce + "Source: …" + hashtag'ler.
- TikTok: video taslak olarak gider; kısa açıklama + hashtag'ler kullanıcı telefondan ekler.
- ⛔ Hiçbir paylaşımda (video, açıklama, etiket) görsellerin yapay zekâ ile üretildiği yazılmaz. Kaynak sadece açıklama metninde yazılır, videoda yazılmaz.

## v3 kurgu kuralları (2026-10-26, kullanıcı geri bildirimi sonrası)
- **Hook:** ilk 3–4 sn büyük, kelime kelime gelen yazı + darbe efekti + beyaz flaş; harita hızla hedefe yakınlaşır.
- **Tempo:** seslendirme ElevenLabs hız 1.2 + ffmpeg `atempo=1.1`; metin ~75 kelime → ~29 sn. Kısa, vurucu cümleler.
- **Kesmeler:** her 4–5 sn'de yeni çekim; her çekim Kling ile hareketli (5 sn klip); kesmede punch-in + whoosh.
- **Grafikler:** ülke kartları (sesle senkron), antlaşma damgası, büyük ifade yazıları, harita çizgileri. Tırnak işareti sadece birebir alıntıda.
- **Müzik:** Magnific Lyria 3 `pro`; modern dünya haberleri tarzı (synth bas, tik-tak hi-hat, trailer perküsyon, 120+ bpm). Oryantal enstrüman YOK. Parçanın en yüksek enerjili bölümü kullanılır (10 sn'lik pencerelerde LUFS ölçülerek).
- **Altyazı:** alt-orta (y≈1440), 3 kelimelik gruplar, okunan kelime marka renginde kutu içinde.
- **Doku:** hafif film greni, üstte ilerleme çubuğu (marka rengi).
- **Ses seviyesi:** toplam ≈ -16 LUFS, tepe < 0 dBTP.
