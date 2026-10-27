// Ortak yardımcılar: .env, kayıt dosyaları, Telegram, zaman.

import fs from "node:fs";
import path from "node:path";

export const PROJE = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
export const VERI = path.join(PROJE, "data");
fs.mkdirSync(VERI, { recursive: true });
const ENV_YOLU = path.join(PROJE, ".env");

export const envOku = () =>
  Object.fromEntries(
    fs
      .readFileSync(ENV_YOLU, "utf8")
      .split("\n")
      .filter((s) => s.includes("="))
      .map((s) => [s.slice(0, s.indexOf("=")), s.slice(s.indexOf("=") + 1)]),
  );

export const envYaz = (degisenler) => {
  const satirlar = fs.readFileSync(ENV_YOLU, "utf8").split("\n").filter(Boolean);
  const sonuc = satirlar.map((s) => {
    const k = s.slice(0, s.indexOf("="));
    return k in degisenler ? `${k}=${degisenler[k]}` : s;
  });
  for (const [k, v] of Object.entries(degisenler)) if (!satirlar.some((s) => s.startsWith(`${k}=`))) sonuc.push(`${k}=${v}`);
  fs.writeFileSync(ENV_YOLU, sonuc.join("\n") + "\n", { mode: 0o600 });
};

export const bekle = (ms) => new Promise((r) => setTimeout(r, ms));

export const log = (...a) => {
  const satir = `${new Date().toLocaleString("de-AT", { timeZone: "Europe/Vienna" })} ${a.join(" ")}`;
  console.log(satir);
  fs.appendFileSync(path.join(VERI, "gunluk.log"), satir + "\n");
};

export const jsonOku = (ad, varsayilan) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(VERI, ad), "utf8"));
  } catch {
    return varsayilan;
  }
};
export const jsonYaz = (ad, deger) => fs.writeFileSync(path.join(VERI, ad), JSON.stringify(deger, null, 2));

// Viyana saatine göre tarih parçaları
export const viyana = (t = new Date()) => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Vienna",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hour12: false,
    })
      .formatToParts(t)
      .map((x) => [x.type, x.value]),
  );
  return { tarih: `${p.year}-${p.month}-${p.day}`, saat: `${p.hour}:${p.minute}`, gun: p.weekday };
};

// ---------- Telegram ----------

export const tg = async (yontem, govde) => {
  const env = envOku();
  const istek =
    govde instanceof FormData
      ? { method: "POST", body: govde }
      : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(govde ?? {}) };
  const y = await (await fetch(`https://api.telegram.org/bot${env.TG_BOT_TOKEN}/${yontem}`, istek)).json();
  if (!y.ok) throw new Error(`Telegram ${yontem}: ${y.description}`);
  return y.result;
};

export const tgMesaj = (text, ekstra = {}) => tg("sendMessage", { chat_id: envOku().TG_CHAT_ID, text: text.slice(0, 4000), ...ekstra });

export const tgVideo = async (videoYolu, baslik, kapakYolu) => {
  const form = new FormData();
  form.append("chat_id", envOku().TG_CHAT_ID);
  form.append("supports_streaming", "true");
  form.append("width", "1080"); // boyut verilmezse Telegram önizlemeyi kare gösterir
  form.append("height", "1920");
  form.append("caption", baslik.slice(0, 1000));
  form.append("video", new Blob([fs.readFileSync(videoYolu)], { type: "video/mp4" }), path.basename(videoYolu));
  if (kapakYolu && fs.existsSync(kapakYolu)) form.append("thumbnail", new Blob([fs.readFileSync(kapakYolu)], { type: "image/jpeg" }), "kapak.jpg");
  return tg("sendVideo", form);
};

export const tgHata = async (baglam, e) => {
  log("HATA", baglam, e?.message ?? e);
  try {
    await tgMesaj(`❌ ${baglam}: ${e?.message ?? e}`);
  } catch {}
};
