// İlm Sanat botu: takvime göre taslak üretir, Telegram'dan onay alır, paylaşır.
//
// Takvim (Viyana): 09:00 haber · 14:00 analiz · 18:00 haber · Pazar ayrıca 11:00 oryantalist tablo.
// Taslak paylaşım saatinden 2 saat önce Telegram'a gelir. Onaylanırsa saatinde paylaşılır; cevap yoksa
// 15 dk önce hatırlatılır ve saatinde otomatik paylaşılır. Atla denirse paylaşılmaz.
// Telegram komutları: bir haber linki · /konu <konu> · /durum · /durdur · /baslat · /yardim
//
// Çalıştırma: node otomasyon/bot.mjs            (sürekli çalışır: Mac'te terminal/launchd)
//             node otomasyon/bot.mjs --tek-tur  (bir tur çalışıp kapanır: GitHub Actions her 10 dakikada)
// Tek tur modunda videolar Drive'da, durum data/*.json dosyalarında turlar arasında saklanır.

import fs from "node:fs";
import path from "node:path";
import { VERI, envOku, log, jsonOku, jsonYaz, viyana, tg, tgMesaj, tgVideo, tgHata, bekle } from "./ortak.mjs";
import { adaylariTopla } from "./haberler.mjs";
import { haberSec, haberPlani, tabloSec, tabloPlani } from "./icerik.mjs";
import { uret, isTemizle } from "./uret.mjs";
import { herIkisinePaylas } from "./paylas.mjs";
import { driveYukle } from "./drive.mjs";

const TEK_TUR = process.argv.includes("--tek-tur");

const TAKVIM = [
  { saat: "09:00", tur: "haber" },
  { saat: "14:00", tur: "analiz" },
  { saat: "18:00", tur: "haber" },
  { saat: "11:00", tur: "tablo", sadecePazar: true },
];
const ONCEDEN_DK = 120;
const HATIRLAT_DK = 15;
// tek tur modunda: paylaşım saati turun başından en fazla bu kadar sonraysa tur kapanmadan bekler (bot.yml zaman aşımı 75 dk)
const BEKLE_DK = 50;
const BASLANGIC = Date.now();
const TUR_ADI = { haber: "HABER", analiz: "ANALİZ", tablo: "PAZAR TABLOSU", ozel: "ÖZEL İSTEK" };

// ---------- tek kopya kilidi ----------

// (tek tur modunda gerekmez: GitHub Actions "concurrency" ile aynı anda tek çalışma)
const KILIT = path.join(VERI, "bot.pid");
if (!TEK_TUR) {
  try {
    const eski = Number(fs.readFileSync(KILIT, "utf8"));
    if (eski && eski !== process.pid) {
      process.kill(eski, 0);
      console.error(`Bot zaten çalışıyor (pid ${eski}).`);
      process.exit(0);
    }
  } catch {}
  fs.writeFileSync(KILIT, String(process.pid));
}

// ---------- durum ----------

const taslaklar = () => jsonOku("taslaklar.json", {});
const taslakYaz = (id, degisiklik) => {
  const t = taslaklar();
  t[id] = { ...(t[id] ?? {}), ...degisiklik, guncelleme: new Date().toISOString() };
  jsonYaz("taslaklar.json", t);
  return t[id];
};
const ayar = () => jsonOku("bot_ayar.json", { durdu: false });

// Viyana saatindeki "YYYY-MM-DD HH:MM" → Date (yaz/kış saatine uyumlu)
const viyanaZamani = (tarih, saat) => {
  const tahmin = new Date(`${tarih}T${saat}:00Z`);
  for (const fark of [-1, -2, 0, -3, 1]) {
    const d = new Date(tahmin.getTime() + fark * 3600000);
    const v = viyana(d);
    if (v.tarih === tarih && v.saat === saat) return d;
  }
  return tahmin;
};

// ---------- üretim (aynı anda tek iş) ----------

let kuyruk = Promise.resolve();
const sirayaKoy = (is) => (kuyruk = kuyruk.then(is).catch(() => {}));
// paylaşım, süren bir video üretimini beklemesin diye ayrı sırada
let paylasimKuyrugu = Promise.resolve();
const paylasimSirasi = (is) => (paylasimKuyrugu = paylasimKuyrugu.then(is).catch((e) => tgHata("Paylaşım", e)));

const planHazirla = async (tur, { konu, link, talimat, eskiPlan } = {}) => {
  if (tur === "tablo") return tabloPlani(eskiPlan?.eser ?? (await tabloSec()), talimat);
  if (link) {
    const html = await (await fetch(link, { headers: { "User-Agent": "Mozilla/5.0" } })).text().catch(() => "");
    const baslik = html.match(/<meta property="og:title" content="([^"]+)"/)?.[1] ?? html.match(/<title>([^<]+)<\/title>/)?.[1] ?? link;
    const ana = { kaynak: new URL(link).hostname.replace(/^www\./, ""), tur: "haber", baslik, link, ozet: "" };
    return haberPlani({ tur: "haber", ana, talimat });
  }
  if (eskiPlan) {
    const [ana, ...ayni] = eskiPlan.kaynaklar.map((k) => ({ kaynak: k.ad, baslik: k.baslik, link: k.link, ozet: "" }));
    return haberPlani({ tur: eskiPlan.tur, ana, ayni, talimat });
  }
  const { adaylar } = await adaylariTopla({ saat: tur === "analiz" ? 168 : 30 });
  const secim = await haberSec(adaylar, tur === "ozel" ? "haber" : tur, konu);
  return haberPlani({ tur: tur === "ozel" ? "haber" : tur, ana: secim.ana, ayni: secim.ayni });
};

const taslakUret = (id, tur, secenekler = {}) =>
  sirayaKoy(async () => {
    const t = taslakYaz(id, { durum: "uretiliyor", tur });
    try {
      log(`[${id}] üretim başladı (${tur})`);
      const plan = await planHazirla(tur, secenekler);
      const sonuc = await uret(plan, id);
      // video Drive'a hemen konur: tek tur modunda paylaşım ayrı bir çalışmada yapılır ve yerel dosya orada yoktur
      const drive = await driveYukle(sonuc.video);
      taslakYaz(id, {
        durum: "onay_bekliyor",
        video: sonuc.video,
        driveUrl: drive.url,
        kapak: sonuc.kapak,
        aciklama: sonuc.aciklama,
        baslik: plan.baslik.replace(/\*\*/g, ""),
        plan,
      });
      await taslakGonder(id);
    } catch (e) {
      taslakYaz(id, { durum: "hata", hata: e.message });
      await tgHata(`${TUR_ADI[tur] ?? tur} taslağı hazırlanamadı${t.zaman ? ` (${viyana(new Date(t.zaman)).saat})` : ""}`, e);
    }
  });

const taslakGonder = async (id) => {
  const t = taslaklar()[id];
  const saat = t.zaman ? viyana(new Date(t.zaman)).saat : null;
  await tgVideo(t.video, `📝 TASLAK · ${TUR_ADI[t.tur]}${saat ? ` · ${saat}` : ""} · ${t.baslik}`, t.kapak);
  const kaynak = (t.plan?.kaynaklar ?? []).map((k) => `• ${k.ad}: ${k.link}`).join("\n");
  const not = saat
    ? `\n\n⏰ Cevap vermezsen ${saat}'da otomatik paylaşılacak. Onaylarsan da ${saat}'da paylaşılır.`
    : "\n\nBu özel istek; sadece Paylaş'a basarsan paylaşılır.";
  const mesaj = await tgMesaj(`Paylaşım metni:\n\n${t.aciklama}\n\nKaynaklar:\n${kaynak}${not}`, {
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Paylaş", callback_data: `paylas:${id}` },
          { text: "✏️ Değiştir", callback_data: `degistir:${id}` },
          { text: "⏭ Atla", callback_data: `atla:${id}` },
        ],
      ],
    },
  });
  taslakYaz(id, { mesajId: mesaj.message_id });
};

const butonlariKaldir = (t) =>
  t?.mesajId ? tg("editMessageReplyMarkup", { chat_id: envOku().TG_CHAT_ID, message_id: t.mesajId, reply_markup: { inline_keyboard: [] } }).catch(() => {}) : null;

const paylas = (id, neden) =>
  paylasimSirasi(async () => {
    const t = taslaklar()[id];
    if (!t || t.durum === "paylasildi" || t.durum === "paylasiliyor") return;
    taslakYaz(id, { durum: "paylasiliyor" });
    await butonlariKaldir(t);
    await tgMesaj(`⏳ ${neden}: "${t.baslik}" paylaşılıyor…`);
    // yerel video yoksa (başka bir çalışmada üretildi) Drive'dan indirilir
    let video = t.video;
    if (!video || !fs.existsSync(video)) {
      if (!t.driveUrl) throw new Error("Videonun ne yerel kopyası ne Drive linki var");
      video = path.join(VERI, "isler", id, "video.mp4");
      fs.mkdirSync(path.dirname(video), { recursive: true });
      fs.writeFileSync(video, Buffer.from(await (await fetch(t.driveUrl)).arrayBuffer()));
    }
    const sonuc = await herIkisinePaylas(video, t.aciklama, { videoUrl: t.driveUrl });
    const basarili = sonuc.includes("📸 Instagram:");
    taslakYaz(id, { durum: basarili ? "paylasildi" : "hata", sonuc });
    if (basarili) {
      const p = jsonOku("paylasilanlar.json", []);
      for (const k of t.plan?.kaynaklar ?? []) p.push({ tarih: new Date().toISOString(), tur: t.tur, baslik: t.baslik, link: k.link });
      if (!t.plan?.kaynaklar?.length) p.push({ tarih: new Date().toISOString(), tur: t.tur, baslik: t.baslik, link: id });
      jsonYaz("paylasilanlar.json", p.slice(-500));
      isTemizle(id);
    }
    await tgMesaj(sonuc);
  });

// ---------- takvim döngüsü ----------

const takvimKontrol = async () => {
  if (ayar().durdu) return;
  const simdi = new Date();
  const v = viyana(simdi);
  for (const s of TAKVIM) {
    if (s.sadecePazar && v.gun !== "Sun") continue;
    const id = `${v.tarih}_${s.saat.replace(":", "")}_${s.tur}`;
    const zaman = viyanaZamani(v.tarih, s.saat);
    const t = taslaklar()[id];
    const dkKaldi = (zaman - simdi) / 60000;
    if (!t && dkKaldi <= ONCEDEN_DK && dkKaldi > 5) {
      taslakYaz(id, { zaman: zaman.toISOString(), tur: s.tur, durum: "sirada" });
      taslakUret(id, s.tur);
    }
  }
  for (const [id, t] of Object.entries(taslaklar())) {
    if (!t.zaman || !["onay_bekliyor", "onaylandi"].includes(t.durum)) continue;
    const dkKaldi = (new Date(t.zaman) - simdi) / 60000;
    if (t.durum === "onay_bekliyor" && dkKaldi <= HATIRLAT_DK && dkKaldi > 0 && !t.hatirlatildi) {
      taslakYaz(id, { hatirlatildi: true });
      await tgMesaj(`⏰ "${t.baslik}" ${HATIRLAT_DK} dk içinde otomatik paylaşılacak. Durdurmak için taslağın altındaki ⏭ Atla'ya bas.`).catch(() => {});
    }
    if (dkKaldi <= 0 && dkKaldi > -60) paylas(id, t.durum === "onaylandi" ? "Paylaşım saati geldi" : "Cevap gelmedi, plana göre");
    else if (dkKaldi <= -60) taslakYaz(id, { durum: "suresi_gecti" });
  }
};

// ---------- Telegram ----------

const YARDIM = `İlm Sanat botu komutları:
• Bir haber linki gönder → o haberden taslak hazırlanır
• /konu <konu> → o konuda bir haber seçilip taslak hazırlanır
• /durum → bugünün taslakları
• /durdur → takvimi durdurur (yeni taslak üretilmez)
• /baslat → takvimi yeniden başlatır
• /kling <0-5> → video başına kaç çekim Kling ile hareketlensin (varsayılan 2; kredi tasarrufu)
Taslakların altındaki düğmelerle Paylaş / Değiştir / Atla.`;

// "Değiştir"e basılan taslak, turlar arasında kaybolmasın diye dosyada tutulur
const degisiklikBekleyen = () => ayar().degisiklikBekleyen ?? null;
const degisiklikBekle = (id) => jsonYaz("bot_ayar.json", { ...ayar(), degisiklikBekleyen: id });

const mesajIsle = async (m) => {
  const metin = (m.text ?? "").trim();
  if (degisiklikBekleyen() && metin && !metin.startsWith("/")) {
    const id = degisiklikBekleyen();
    degisiklikBekle(null);
    const t = taslaklar()[id];
    await tgMesaj("✏️ Talimatın alındı, yeni sürüm hazırlanıyor (birkaç dakika sürer).");
    taslakYaz(id, { hatirlatildi: false });
    return taslakUret(id, t.tur, { talimat: metin, eskiPlan: t.plan });
  }
  if (metin === "/start" || metin === "/yardim" || metin === "/help") return tgMesaj(YARDIM);
  if (metin === "/durdur") {
    jsonYaz("bot_ayar.json", { ...ayar(), durdu: true });
    return tgMesaj("⏸ Takvim durduruldu. Yeni taslak üretilmeyecek. Tekrar başlatmak için /baslat");
  }
  const kling = metin.match(/^\/kling\s+(\d)$/);
  if (kling) {
    jsonYaz("bot_ayar.json", { ...ayar(), klingSayisi: Number(kling[1]) });
    return tgMesaj(`🎞 Video başına Kling hareket klibi: ${kling[1]} (diğer çekimler yakınlaşma/kaydırma ile hareket eder).`);
  }
  if (metin === "/baslat") {
    jsonYaz("bot_ayar.json", { ...ayar(), durdu: false });
    return tgMesaj("▶️ Takvim yeniden başladı.");
  }
  if (metin === "/durum") {
    const bugun = viyana().tarih;
    const satir = Object.entries(taslaklar())
      .filter(([id]) => id.startsWith(bugun) || id.startsWith("ozel_" + bugun.replace(/-/g, "")))
      .map(([, t]) => `• ${t.zaman ? viyana(new Date(t.zaman)).saat : "özel"} ${TUR_ADI[t.tur] ?? t.tur}: ${t.durum}${t.baslik ? ` — ${t.baslik}` : ""}`);
    return tgMesaj(`${ayar().durdu ? "⏸ Takvim durdurulmuş.\n" : ""}Bugün:\n${satir.join("\n") || "henüz taslak yok"}`);
  }
  const link = metin.match(/https?:\/\/\S+/)?.[0];
  const konu = metin.startsWith("/konu") ? metin.replace(/^\/konu\s*/, "") : null;
  if (link || konu) {
    const id = `ozel_${viyana().tarih.replace(/-/g, "")}_${Date.now().toString(36)}`;
    await tgMesaj(`🛠 Hazırlanıyor: ${link ?? konu}\nVideo birkaç dakika içinde gelir.`);
    taslakYaz(id, { tur: "ozel", durum: "sirada" });
    return taslakUret(id, "ozel", { link, konu });
  }
  return tgMesaj(YARDIM);
};

const tiklamaIsle = async (q) => {
  await tg("answerCallbackQuery", { callback_query_id: q.id }).catch(() => {});
  const [islem, id] = (q.data ?? "").split(":");
  const t = taslaklar()[id];
  if (!t || !["onay_bekliyor", "onaylandi"].includes(t.durum)) return tgMesaj("Bu taslak artık geçerli değil.");
  if (islem === "atla") {
    taslakYaz(id, { durum: "atlandi" });
    await butonlariKaldir(t);
    isTemizle(id);
    return tgMesaj(`⏭ Atlandı: "${t.baslik}" paylaşılmayacak.`);
  }
  if (islem === "degistir") {
    degisiklikBekle(id);
    return tgMesaj(`✏️ "${t.baslik}" için neyi değiştireyim? Yaz, yeni sürümü hazırlayayım.`);
  }
  if (islem === "paylas") {
    // telafi taslakları onaylanınca beklemeden paylaşılır
    if (t.zaman && new Date(t.zaman) > new Date() && !id.endsWith("_telafi")) {
      taslakYaz(id, { durum: "onaylandi" });
      await butonlariKaldir(t);
      return tgMesaj(`✅ Onaylandı. "${t.baslik}" ${viyana(new Date(t.zaman)).saat}'da paylaşılacak.`);
    }
    return paylas(id, "Onaylandı");
  }
};

// Telegram güncellemelerini işler; okunan son güncelleme numarası dosyada tutulur (tek tur modunda turlar arası)
const guncellemeleriIsle = async (bekleSn) => {
  const offset = jsonOku("tg_offset.json", { offset: 0 }).offset;
  const guncellemeler = await tg("getUpdates", { offset, timeout: bekleSn, allowed_updates: ["message", "callback_query"] });
  for (const g of guncellemeler) {
    jsonYaz("tg_offset.json", { offset: g.update_id + 1 });
    const kimden = String(g.callback_query?.from?.id ?? g.message?.chat?.id ?? "");
    if (kimden !== String(envOku().TG_CHAT_ID)) continue; // sadece hesabın sahibi
    if (g.callback_query) await tiklamaIsle(g.callback_query);
    else if (g.message) await mesajIsle(g.message);
  }
};

const telegramDongusu = async () => {
  for (;;) {
    try {
      await guncellemeleriIsle(50);
    } catch (e) {
      log("Telegram döngü hatası:", e.message);
      await bekle(10000);
    }
  }
};

// ---------- başlat ----------

if (TEK_TUR) {
  // önceki tur yarıda kesildiyse (zaman aşımı) kalan üretimleri hata olarak işaretle
  for (const [id, t] of Object.entries(taslaklar()))
    if (["uretiliyor", "paylasiliyor"].includes(t.durum) && Date.now() - new Date(t.guncelleme ?? 0) > 50 * 60000)
      taslakYaz(id, { durum: "hata", hata: "önceki çalışma yarıda kesildi" });
  log("Tek tur başladı");
  await guncellemeleriIsle(0).catch((e) => log("Telegram:", e.message));
  await takvimKontrol().catch((e) => tgHata("Takvim kontrolü", e));
  await kuyruk;
  await paylasimKuyrugu;
  // GitHub zamanlanmış turları 40–60 dk gecikebiliyor: paylaşım saati yakınsa kapanmadan bekle, saatinde paylaş.
  // Beklerken Telegram dinlenir (Paylaş / Değiştir / Atla tıklamaları işlenir).
  const siradakiPaylasim = () =>
    Object.values(taslaklar())
      .filter((t) => t.zaman && ["onay_bekliyor", "onaylandi"].includes(t.durum))
      .map((t) => new Date(t.zaman).getTime())
      .filter((z) => z > Date.now() - 60000 && z - BASLANGIC <= BEKLE_DK * 60000)
      .sort((a, b) => a - b)[0];
  let z = siradakiPaylasim();
  if (z) log(`Paylaşım saati bekleniyor (${viyana(new Date(z)).saat})`);
  while (z) {
    const kalanSn = Math.ceil((z - Date.now()) / 1000);
    if (kalanSn > 0)
      await guncellemeleriIsle(Math.min(30, kalanSn)).catch(async (e) => {
        log("Telegram:", e.message);
        await bekle(Math.min(10000, kalanSn * 1000));
      });
    else await bekle(5000);
    await takvimKontrol().catch((e) => tgHata("Takvim kontrolü", e));
    await paylasimKuyrugu;
    z = siradakiPaylasim();
  }
  await kuyruk;
  // üretim sırasında gelen tıklamaları da kaçırmamak için son bir kez bak
  await guncellemeleriIsle(0).catch((e) => log("Telegram:", e.message));
  await paylasimKuyrugu;
  await kuyruk;
  log("Tek tur bitti");
  process.exit(0);
}

// Yeniden başlatmada yarım kalan üretimleri hata olarak işaretle
for (const [id, t] of Object.entries(taslaklar())) if (["uretiliyor", "sirada", "paylasiliyor"].includes(t.durum)) taslakYaz(id, { durum: "hata", hata: "bot yeniden başladı" });

log("Bot başladı");
await tgMesaj(`🤖 İlm Sanat botu çalışıyor. Takvim: 09:00 haber · 14:00 analiz · 18:00 haber · Pazar 11:00 tablo (Viyana). /yardim`).catch((e) => log("Telegram'a ulaşılamadı:", e.message));
telegramDongusu();
for (;;) {
  await takvimKontrol().catch((e) => tgHata("Takvim kontrolü", e));
  await bekle(30000);
}
