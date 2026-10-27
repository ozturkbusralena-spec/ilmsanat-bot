// Videoyu Telegram'a taslak olarak gönderir, kullanıcının onayını bekler.
// ✅ Paylaş → Instagram Reel (doğrudan) + TikTok (taslak/inbox) · ✏️ Değiştir → talimatı kaydeder · ⏭ Atla → hiçbir şey paylaşmaz
// Kullanım: node otomasyon/onay_paylas.mjs <video.mp4> <aciklama.txt> [--video-url <adres>] [--onayli-instagram]
//   Instagram videoyu yalnızca herkese açık bir adresten indirir; --video-url verilmezse video Google Drive'a yüklenir.
//   --onayli-instagram: kullanıcı Telegram'da zaten onay verdiyse, sormadan yalnızca Instagram'a paylaşır.

import fs from "node:fs";
import path from "node:path";
import { driveYukle } from "./drive.mjs";

const PROJE = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const ENV_YOLU = path.join(PROJE, ".env");

const envOku = () =>
  Object.fromEntries(
    fs
      .readFileSync(ENV_YOLU, "utf8")
      .split("\n")
      .filter((s) => s.includes("="))
      .map((s) => [s.slice(0, s.indexOf("=")), s.slice(s.indexOf("=") + 1)]),
  );

const envYaz = (degisenler) => {
  const satirlar = fs.readFileSync(ENV_YOLU, "utf8").split("\n").filter(Boolean);
  const sonuc = satirlar.map((s) => {
    const k = s.slice(0, s.indexOf("="));
    return k in degisenler ? `${k}=${degisenler[k]}` : s;
  });
  for (const [k, v] of Object.entries(degisenler)) if (!satirlar.some((s) => s.startsWith(`${k}=`))) sonuc.push(`${k}=${v}`);
  fs.writeFileSync(ENV_YOLU, sonuc.join("\n") + "\n", { mode: 0o600 });
};

const argumanlar = process.argv.slice(2);
const secenek = (ad) => {
  const i = argumanlar.indexOf(ad);
  return i >= 0 ? argumanlar[i + 1] : undefined;
};
const [videoYolu, aciklamaYolu] = argumanlar.filter((a, i) => !a.startsWith("--") && !argumanlar[i - 1]?.startsWith("--video-url"));
const videoUrl = secenek("--video-url");
const onayliInstagram = argumanlar.includes("--onayli-instagram");
if (!videoYolu || !aciklamaYolu) {
  console.error("Kullanım: node otomasyon/onay_paylas.mjs <video.mp4> <aciklama.txt> [--video-url <adres>] [--onayli-instagram]");
  process.exit(1);
}
const video = fs.readFileSync(videoYolu);
const aciklama = fs.readFileSync(aciklamaYolu, "utf8").trim();
let env = envOku();

const bekle = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toLocaleTimeString("de-AT"), ...a);

// ---------- Telegram ----------

const tg = async (yontem, govde) => {
  const istek =
    govde instanceof FormData
      ? { method: "POST", body: govde }
      : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(govde ?? {}) };
  const y = await (await fetch(`https://api.telegram.org/bot${env.TG_BOT_TOKEN}/${yontem}`, istek)).json();
  if (!y.ok) throw new Error(`Telegram ${yontem}: ${y.description}`);
  return y.result;
};
const tgMesaj = (text, ekstra = {}) => tg("sendMessage", { chat_id: env.TG_CHAT_ID, text, ...ekstra });

// ---------- Instagram (Instagram Login API, Reels, dosyadan yükleme) ----------

const IG = "https://graph.instagram.com/v23.0";

const igPaylas = async () => {
  // Instagram videoyu yalnızca herkese açık bir adresten indirir: önce Drive'a yüklenir (klasörde en fazla 5 video kalır)
  let adres = videoUrl;
  if (!adres) {
    log("Drive'a yükleniyor…");
    const d = await driveYukle(videoYolu);
    adres = d.url;
    if (d.silinenler.length) log("Drive'dan silinen eski videolar:", d.silinenler.join(", "));
  }
  const p = new URLSearchParams({
    media_type: "REELS",
    video_url: adres,
    caption: aciklama,
    share_to_feed: "true",
    thumb_offset: "1500",
    access_token: env.IG_ACCESS_TOKEN,
  });
  const kap = await (await fetch(`${IG}/${env.IG_USER_ID}/media?${p}`, { method: "POST" })).json();
  if (!kap.id) throw new Error(`Instagram kapsayıcı oluşturulamadı: ${JSON.stringify(kap)}`);
  log("Instagram: video adresten indiriliyor ve işleniyor…");

  for (let i = 0; i < 60; i++) {
    await bekle(5000);
    const d = await (await fetch(`${IG}/${kap.id}?fields=status_code,status&access_token=${env.IG_ACCESS_TOKEN}`)).json();
    if (d.status_code === "FINISHED") break;
    if (d.status_code === "ERROR" || d.status_code === "EXPIRED") throw new Error(`Instagram işleme hatası: ${JSON.stringify(d)}`);
    if (i === 59) throw new Error("Instagram işleme 5 dakikada bitmedi");
  }
  const yay = await (
    await fetch(`${IG}/${env.IG_USER_ID}/media_publish?creation_id=${kap.id}&access_token=${env.IG_ACCESS_TOKEN}`, { method: "POST" })
  ).json();
  if (!yay.id) throw new Error(`Instagram yayınlanamadı: ${JSON.stringify(yay)}`);
  const bilgi = await (await fetch(`${IG}/${yay.id}?fields=permalink&access_token=${env.IG_ACCESS_TOKEN}`)).json();
  return bilgi.permalink ?? `media id ${yay.id}`;
};

// ---------- TikTok (Sandbox, taslak/inbox, dosyadan yükleme) ----------

const TT = "https://open.tiktokapis.com/v2";

const ttTokenYenile = async () => {
  const y = await (
    await fetch(`${TT}/oauth/token/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: env.TT_CLIENT_KEY,
        client_secret: env.TT_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: env.TT_REFRESH_TOKEN,
      }),
    })
  ).json();
  if (!y.access_token) throw new Error(`TikTok token yenilenemedi: ${y.error_description ?? y.error ?? "bilinmeyen hata"}`);
  envYaz({ TT_ACCESS_TOKEN: y.access_token, TT_REFRESH_TOKEN: y.refresh_token, TT_TOKEN_TARIHI: new Date().toISOString().slice(0, 10) });
  env = envOku();
};

const ttTaslak = async () => {
  await ttTokenYenile();
  const init = await (
    await fetch(`${TT}/post/publish/inbox/video/init/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.TT_ACCESS_TOKEN}`, "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({ source_info: { source: "FILE_UPLOAD", video_size: video.length, chunk_size: video.length, total_chunk_count: 1 } }),
    })
  ).json();
  if (init.error?.code !== "ok") throw new Error(`TikTok başlatma: ${JSON.stringify(init.error)}`);
  const { publish_id, upload_url } = init.data;
  fs.appendFileSync(path.join(path.dirname(videoYolu), "tiktok_publish_id.txt"), `${new Date().toISOString()} ${publish_id}\n`);
  log("TikTok: video yükleniyor…", publish_id);
  const put = await fetch(upload_url, {
    method: "PUT",
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(video.length),
      "Content-Range": `bytes 0-${video.length - 1}/${video.length}`,
    },
    body: video,
  });
  if (!put.ok) throw new Error(`TikTok yükleme HTTP ${put.status}`);
  for (let i = 0; i < 40; i++) {
    await bekle(4000);
    const s = await (
      await fetch(`${TT}/post/publish/status/fetch/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${env.TT_ACCESS_TOKEN}`, "Content-Type": "application/json; charset=UTF-8" },
        body: JSON.stringify({ publish_id }),
      })
    ).json();
    const durum = s.data?.status;
    if (durum === "SEND_TO_USER_INBOX" || durum === "PUBLISH_COMPLETE") return durum;
    if (durum === "FAILED") throw new Error(`TikTok işleme hatası: ${s.data?.fail_reason}`);
  }
  return "işleniyor (birkaç dakika içinde gelen kutusuna düşer)";
};

// ---------- akış ----------

const ana = async () => {
  if (onayliInstagram) {
    log("Onay önceden verildi; yalnızca Instagram'a paylaşılıyor…");
    const link = await igPaylas();
    await tgMesaj(`📸 Instagram: ${link}`);
    log("Instagram:", link);
    return;
  }

  // eski güncellemeleri atla, yalnızca bundan sonraki tıklamaları dinle
  const eski = await tg("getUpdates", { timeout: 0 });
  let offset = eski.length ? eski[eski.length - 1].update_id + 1 : 0;

  log("Taslak Telegram'a gönderiliyor…");
  const form = new FormData();
  form.append("chat_id", env.TG_CHAT_ID);
  form.append("supports_streaming", "true");
  // boyut verilmezse Telegram önizlemeyi kare gösterir
  form.append("width", "1080");
  form.append("height", "1920");
  const kapak = path.join(path.dirname(videoYolu), "kapak_kucuk.jpg");
  if (fs.existsSync(kapak)) form.append("thumbnail", new Blob([fs.readFileSync(kapak)], { type: "image/jpeg" }), "kapak.jpg");
  form.append("caption", "📝 TASLAK · The Mecca Alliance goes to Tehran");
  form.append("video", new Blob([video], { type: "video/mp4" }), path.basename(videoYolu));
  await tg("sendVideo", form);
  const taslak = await tgMesaj(`Paylaşım metni:\n\n${aciklama}`.slice(0, 4000), {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Paylaş", callback_data: "paylas" },
          { text: "✏️ Değiştir", callback_data: "degistir" },
          { text: "⏭ Atla", callback_data: "atla" },
        ],
      ],
    },
  });
  log("Onay bekleniyor (Telegram)…");

  const butonlariKaldir = () =>
    tg("editMessageReplyMarkup", { chat_id: env.TG_CHAT_ID, message_id: taslak.message_id, reply_markup: { inline_keyboard: [] } }).catch(() => {});

  let degisiklikBekleniyor = false;
  for (;;) {
    const guncellemeler = await tg("getUpdates", { offset, timeout: 50, allowed_updates: ["callback_query", "message"] });
    for (const g of guncellemeler) {
      offset = g.update_id + 1;
      const kimden = String(g.callback_query?.from?.id ?? g.message?.chat?.id ?? "");
      if (kimden !== String(env.TG_CHAT_ID)) continue; // sadece kullanıcının kendisi

      if (degisiklikBekleniyor && g.message?.text) {
        fs.writeFileSync(path.join(path.dirname(videoYolu), "degisiklik_talebi.txt"), g.message.text + "\n");
        await tgMesaj("📝 Değişiklik talebi kaydedildi. Yeni sürümü hazırlayıp tekrar onaya göndereceğim.");
        log("Değişiklik talebi:", g.message.text);
        return;
      }
      const secim = g.callback_query?.data;
      if (!secim) continue;
      await tg("answerCallbackQuery", { callback_query_id: g.callback_query.id }).catch(() => {});
      await butonlariKaldir();

      if (secim === "atla") {
        await tgMesaj("⏭ Atlandı. Bu taslak paylaşılmadı.");
        log("Kullanıcı atladı.");
        return;
      }
      if (secim === "degistir") {
        degisiklikBekleniyor = true;
        await tgMesaj("✏️ Neyi değiştireyim? Yaz, kaydedeyim.");
        continue;
      }
      if (secim === "paylas") {
        await tgMesaj("⏳ Onaylandı, paylaşılıyor…");
        log("Onaylandı. Paylaşılıyor…");
        const sonuc = [];
        try {
          sonuc.push(`📸 Instagram: ${await igPaylas()}`);
        } catch (e) {
          sonuc.push(`❌ Instagram hatası: ${e.message}`);
        }
        try {
          sonuc.push(`🎵 TikTok taslağı: ${await ttTaslak()} — TikTok uygulamasında gelen kutundan açıp paylaşabilirsin.`);
        } catch (e) {
          sonuc.push(`❌ TikTok hatası: ${e.message}`);
        }
        await tgMesaj(sonuc.join("\n\n"));
        log(sonuc.join("\n"));
        return;
      }
    }
  }
};

ana().catch(async (e) => {
  console.error("HATA:", e.message);
  try {
    await tgMesaj(`❌ Hata: ${e.message}`);
  } catch {}
  process.exit(1);
});
