// Google Drive iznini bir kez alır: tarayıcıda izin sayfasını açar, dönüşü bilgisayardaki geçici bir
// adreste (127.0.0.1) yakalar ve yenileme anahtarını .env dosyasına yazar.
// Kullanım: node otomasyon/drive_baglan.mjs

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";

const PROJE = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const ENV_YOLU = path.join(PROJE, ".env");
const env = Object.fromEntries(
  fs
    .readFileSync(ENV_YOLU, "utf8")
    .split("\n")
    .filter((s) => s.includes("="))
    .map((s) => [s.slice(0, s.indexOf("=")), s.slice(s.indexOf("=") + 1)]),
);

const dogrulayici = crypto.randomBytes(48).toString("base64url");
const meydanOkuma = crypto.createHash("sha256").update(dogrulayici).digest("base64url");
const durum = crypto.randomBytes(12).toString("hex");

const sunucu = http.createServer(async (istek, yanit) => {
  const u = new URL(istek.url, "http://127.0.0.1");
  console.log("Google'dan dönüş geldi:", u.pathname, u.searchParams.has("code") ? "(kod var)" : u.search);
  if (u.pathname !== "/") return yanit.end();
  const kod = u.searchParams.get("code");
  if (!kod || u.searchParams.get("state") !== durum) {
    yanit.end("İzin alınamadı. Terminale bakın.");
    console.error("İzin alınamadı:", u.searchParams.get("error") ?? "geçersiz dönüş");
    process.exit(1);
  }
  const t = await (
    await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.GD_CLIENT_ID,
        client_secret: env.GD_CLIENT_SECRET,
        code: kod,
        code_verifier: dogrulayici,
        grant_type: "authorization_code",
        redirect_uri: yonlendirme,
      }),
    })
  ).json();
  if (!t.refresh_token) {
    yanit.end("Yenileme anahtarı gelmedi. Terminale bakın.");
    console.error("Token yanıtı:", t.error_description ?? t.error ?? "refresh_token yok");
    process.exit(1);
  }
  const satirlar = fs.readFileSync(ENV_YOLU, "utf8").split("\n").filter((s) => s && !s.startsWith("GD_REFRESH_TOKEN="));
  satirlar.push(`GD_REFRESH_TOKEN=${t.refresh_token}`);
  fs.writeFileSync(ENV_YOLU, satirlar.join("\n") + "\n", { mode: 0o600 });
  yanit.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  yanit.end("<h2>Google Drive bağlandı ✅</h2><p>Bu sekmeyi kapatabilirsin.</p>");
  console.log("Tamam: Google Drive bağlandı, anahtar .env dosyasına kaydedildi.");
  setTimeout(() => process.exit(0), 300);
});

let yonlendirme = "";
sunucu.listen(0, "127.0.0.1", () => {
  yonlendirme = `http://127.0.0.1:${sunucu.address().port}/`;
  const adres =
    "https://accounts.google.com/o/oauth2/v2/auth?" +
    new URLSearchParams({
      client_id: env.GD_CLIENT_ID,
      redirect_uri: yonlendirme,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/drive.file",
      access_type: "offline",
      prompt: "consent",
      code_challenge: meydanOkuma,
      code_challenge_method: "S256",
      state: durum,
    });
  console.log("Chrome'da Google izin sayfası açılıyor. Videoların kaydedileceği Google hesabını seç ve izin ver.");
  console.log(`İzinden sonra Chrome'un adres çubuğu ${yonlendirme} ile başlamalı.`);
  execFile("open", ["-a", "Google Chrome", adres], (h) => h && execFile("open", [adres]));
});
