// Instagram Reel (Drive linkiyle) ve TikTok taslak (Sandbox, inbox) paylaşımı.

import fs from "node:fs";
import path from "node:path";
import { envOku, envYaz, log, bekle } from "./ortak.mjs";
import { driveYukle } from "./drive.mjs";

const IG = "https://graph.instagram.com/v23.0";
const TT = "https://open.tiktokapis.com/v2";

// Instagram uzun süreli token'ı 60 gün geçerli; 30 günden eskiyse yenilenir.
const igTokenTaze = async () => {
  const env = envOku();
  const yas = (Date.now() - new Date(env.IG_TOKEN_TARIHI ?? 0).getTime()) / 86400000;
  if (yas < 30) return env.IG_ACCESS_TOKEN;
  const y = await (await fetch(`${IG.replace("/v23.0", "")}/refresh_access_token?grant_type=ig_refresh_token&access_token=${env.IG_ACCESS_TOKEN}`)).json();
  if (!y.access_token) throw new Error(`Instagram token yenilenemedi: ${JSON.stringify(y.error ?? y)}`);
  envYaz({ IG_ACCESS_TOKEN: y.access_token, IG_TOKEN_TARIHI: new Date().toISOString().slice(0, 10) });
  log("Instagram token yenilendi");
  return y.access_token;
};

export const igPaylas = async (videoYolu, aciklama, videoUrl) => {
  const token = await igTokenTaze();
  const env = envOku();
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
    access_token: token,
  });
  const kap = await (await fetch(`${IG}/${env.IG_USER_ID}/media?${p}`, { method: "POST" })).json();
  if (!kap.id) throw new Error(`Instagram kapsayıcı oluşturulamadı: ${JSON.stringify(kap.error ?? kap)}`);
  log("Instagram: video işleniyor…");
  for (let i = 0; i < 60; i++) {
    await bekle(5000);
    const d = await (await fetch(`${IG}/${kap.id}?fields=status_code,status&access_token=${token}`)).json();
    if (d.status_code === "FINISHED") break;
    if (d.status_code === "ERROR" || d.status_code === "EXPIRED") throw new Error(`Instagram işleme hatası: ${d.status ?? d.status_code}`);
    if (i === 59) throw new Error("Instagram işleme 5 dakikada bitmedi");
  }
  const yay = await (await fetch(`${IG}/${env.IG_USER_ID}/media_publish?creation_id=${kap.id}&access_token=${token}`, { method: "POST" })).json();
  if (!yay.id) throw new Error(`Instagram yayınlanamadı: ${JSON.stringify(yay.error ?? yay)}`);
  // yayınlandıktan sonra hata fırlatılmaz: tekrar deneme aynı videoyu ikinci kez paylaşmasın
  const bilgi = await fetch(`${IG}/${yay.id}?fields=permalink&access_token=${token}`)
    .then((r) => r.json())
    .catch(() => ({}));
  return bilgi.permalink ?? `yayınlandı (media id ${yay.id})`;
};

const ttTokenYenile = async () => {
  const env = envOku();
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
  return y.access_token;
};

export const ttTaslak = async (videoYolu) => {
  const token = await ttTokenYenile();
  const video = fs.readFileSync(videoYolu);
  const init = await (
    await fetch(`${TT}/post/publish/inbox/video/init/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({ source_info: { source: "FILE_UPLOAD", video_size: video.length, chunk_size: video.length, total_chunk_count: 1 } }),
    })
  ).json();
  if (init.error?.code !== "ok") throw new Error(`TikTok başlatma: ${init.error?.message ?? init.error?.code}`);
  const { publish_id, upload_url } = init.data;
  fs.appendFileSync(path.join(path.dirname(videoYolu), "tiktok_publish_id.txt"), `${new Date().toISOString()} ${publish_id}\n`);
  log("TikTok: video yükleniyor…", publish_id);
  const put = await fetch(upload_url, {
    method: "PUT",
    headers: { "Content-Type": "video/mp4", "Content-Length": String(video.length), "Content-Range": `bytes 0-${video.length - 1}/${video.length}` },
    body: video,
  });
  if (!put.ok) throw new Error(`TikTok yükleme HTTP ${put.status}`);
  for (let i = 0; i < 40; i++) {
    await bekle(4000);
    const s = await (
      await fetch(`${TT}/post/publish/status/fetch/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8" },
        body: JSON.stringify({ publish_id }),
      })
    ).json();
    const durum = s.data?.status;
    if (durum === "SEND_TO_USER_INBOX" || durum === "PUBLISH_COMPLETE") return "gelen kutuna gönderildi";
    if (durum === "FAILED") throw new Error(`TikTok işleme hatası: ${s.data?.fail_reason}`);
  }
  // TikTok Sandbox bazen 20–30 dk işliyor; video yine de sonradan gelen kutusuna düşüyor
  return "yüklendi, TikTok işliyor (bazen 20–30 dk sürüyor; sonra gelen kutuna düşer)";
};

// Bağlantı kopmalarında (Mac uykudan uyanırken, Wi-Fi değişirken) işi 2, 4, 8 dk arayla yeniden dener.
const AG_HATASI = /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket|network|aborted/i;
const tekrarla = async (ad, is) => {
  for (let deneme = 1; ; deneme++) {
    try {
      return await is();
    } catch (e) {
      const sebep = `${e.message} ${e.cause?.code ?? ""}`;
      if (deneme >= 4 || !AG_HATASI.test(sebep)) throw e;
      log(`${ad}: bağlantı hatası (${sebep.trim()}), ${2 ** deneme} dk sonra tekrar (${deneme}/3)`);
      await bekle(2 ** deneme * 60000);
    }
  }
};

// İkisini birden dener; biri hata verse de diğeri yapılır.
export const herIkisinePaylas = async (videoYolu, aciklama, { instagram = true, tiktok = true, videoUrl } = {}) => {
  const sonuc = [];
  if (instagram)
    try {
      sonuc.push(`📸 Instagram: ${await tekrarla("Instagram", () => igPaylas(videoYolu, aciklama, videoUrl))}`);
    } catch (e) {
      sonuc.push(`❌ Instagram hatası: ${e.message}`);
    }
  if (tiktok)
    try {
      sonuc.push(`🎵 TikTok taslağı: ${await tekrarla("TikTok", () => ttTaslak(videoYolu))} — TikTok'ta Gelen Kutusu → sistem bildirimlerinden ya da Profil → Taslaklar'dan açıp paylaşabilirsin.`);
    } catch (e) {
      sonuc.push(`❌ TikTok hatası: ${e.message}`);
    }
  return sonuc.join("\n\n");
};
