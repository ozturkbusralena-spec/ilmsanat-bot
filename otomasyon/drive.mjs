// Google Drive: videoyu "İlm Sanat Paylaşımlar" klasörüne yükler, linke sahip herkese okuma izni verir,
// Instagram'ın indirebileceği doğrudan adresi döndürür ve klasörde en fazla 5 video bırakır.
// İzin kapsamı drive.file: yalnızca bu uygulamanın kendi oluşturduğu dosyalara erişir.

import fs from "node:fs";
import path from "node:path";

const PROJE = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const ENV_YOLU = path.join(PROJE, ".env");
const KLASOR_ADI = "İlm Sanat Paylaşımlar";
const EN_FAZLA = 5;

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

const erisimTokeni = async () => {
  const env = envOku();
  const y = await (
    await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.GD_CLIENT_ID,
        client_secret: env.GD_CLIENT_SECRET,
        refresh_token: env.GD_REFRESH_TOKEN,
        grant_type: "refresh_token",
      }),
    })
  ).json();
  // Google uygulaması "Test" modunda olduğu için izin 7 günde bir biter
  if (y.error === "invalid_grant")
    throw new Error("Google Drive izninin süresi doldu. Mac'te Terminal'de şunu çalıştır: cd ~/Desktop/ILMSANAT && ~/.local/node/bin/node otomasyon/drive_baglan.mjs");
  if (!y.access_token) throw new Error(`Drive token alınamadı: ${y.error_description ?? y.error}`);
  return y.access_token;
};

const api = async (token, yol, secenekler = {}) => {
  const y = await fetch(`https://www.googleapis.com/drive/v3/${yol}`, {
    ...secenekler,
    headers: { Authorization: `Bearer ${token}`, ...(secenekler.headers ?? {}) },
  });
  if (y.status === 204) return {};
  const j = await y.json();
  if (!y.ok) throw new Error(`Drive ${yol}: ${j.error?.message ?? y.status}`);
  return j;
};

const klasorBul = async (token) => {
  const env = envOku();
  if (env.GD_KLASOR_ID) return env.GD_KLASOR_ID;
  const k = await api(token, "files?fields=id", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: KLASOR_ADI, mimeType: "application/vnd.google-apps.folder" }),
  });
  envYaz({ GD_KLASOR_ID: k.id });
  return k.id;
};

// Klasörde en yeni EN_FAZLA video kalır; eskiler kalıcı olarak silinir (çöp kutusunda yer kaplamasın diye).
const eskileriSil = async (token, klasor) => {
  const q = encodeURIComponent(`'${klasor}' in parents and trashed=false`);
  const liste = await api(token, `files?q=${q}&orderBy=createdTime desc&fields=files(id,name)&pageSize=100`);
  const fazla = liste.files.slice(EN_FAZLA);
  for (const f of fazla) await api(token, `files/${f.id}`, { method: "DELETE" });
  return fazla.map((f) => f.name);
};

export const driveYukle = async (dosyaYolu) => {
  const token = await erisimTokeni();
  const klasor = await klasorBul(token);
  const icerik = fs.readFileSync(dosyaYolu);
  const ad = `${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}_${path.basename(dosyaYolu)}`;

  // çok parçalı yükleme: üst bilgi + dosya içeriği tek istekte
  const sinir = "ilmsanat" + Date.now();
  const govde = Buffer.concat([
    Buffer.from(
      `--${sinir}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: ad, parents: [klasor] })}\r\n--${sinir}\r\nContent-Type: video/mp4\r\n\r\n`,
    ),
    icerik,
    Buffer.from(`\r\n--${sinir}--`),
  ]);
  const y = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${sinir}` },
    body: govde,
  });
  const dosya = await y.json();
  if (!dosya.id) throw new Error(`Drive yükleme: ${dosya.error?.message ?? y.status}`);

  await api(token, `files/${dosya.id}/permissions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "anyone", role: "reader" }),
  });
  const silinenler = await eskileriSil(token, klasor);
  return {
    id: dosya.id,
    url: `https://drive.usercontent.google.com/download?id=${dosya.id}&export=download&confirm=t`,
    silinenler,
  };
};

// Doğrudan çalıştırılırsa: node otomasyon/drive.mjs <video.mp4>
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  driveYukle(process.argv[2])
    .then((s) => console.log(JSON.stringify(s, null, 2)))
    .catch((e) => {
      console.error("HATA:", e.message);
      process.exit(1);
    });
}
