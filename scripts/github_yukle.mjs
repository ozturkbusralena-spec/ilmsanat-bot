// Projeyi GitHub deposuna yükler (git kurmadan, GitHub API ile) ve gizli bilgileri depo "Secrets"ına şifreli koyar.
// Yalnızca aşağıdaki listedeki dosyalar yüklenir; .env, ÖNEMLI/ ve videolar asla yüklenmez.
// Kullanım: node scripts/github_yukle.mjs <kullanici/depo>      (GH_PAT .env içinde olmalı)
//           node scripts/github_yukle.mjs <kullanici/depo> --sadece-secret

import fs from "node:fs";
import path from "node:path";
import sodium from "libsodium-wrappers";

const PROJE = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const [depo] = process.argv.slice(2);
const sadeceSecret = process.argv.includes("--sadece-secret");
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(PROJE, ".env"), "utf8")
    .split("\n")
    .filter((s) => s.includes("="))
    .map((s) => [s.slice(0, s.indexOf("=")), s.slice(s.indexOf("=") + 1)]),
);
const TOKEN = env.GH_PAT;
if (!depo || !TOKEN) {
  console.error("Kullanım: node scripts/github_yukle.mjs <kullanici/depo>  (.env içinde GH_PAT olmalı)");
  process.exit(1);
}

const gh = async (yol, secenek = {}) => {
  const y = await fetch(`https://api.github.com${yol}`, {
    ...secenek,
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(secenek.headers ?? {}) },
  });
  const metin = await y.text();
  const j = metin ? JSON.parse(metin) : {};
  // 404 = yok, 409 = depo tamamen boş: ikisi de çağıran tarafından ele alınır
  if (!y.ok && y.status !== 404 && y.status !== 409) throw new Error(`GitHub ${secenek.method ?? "GET"} ${yol}: ${y.status} ${j.message ?? ""}`);
  return { durum: y.status, j };
};

// ---------- yüklenecek dosyalar (beyaz liste) ----------

const IZINLI = [
  ".github",
  ".gitignore",
  "package.json",
  "package-lock.json",
  "otomasyon",
  "scripts",
  "config",
  "marka",
  "video/package.json",
  "video/package-lock.json",
  "video/tsconfig.json",
  "video/src",
  "video/public/marka",
  "KULLANIM.md",
  "STIL_REHBERI.md",
  "YOL_HARITASI.md",
  "Mein Logi Ilmsanat.png",
  "Mein Logi Ilmsanat transparent.png",
];
const YASAK = /(^|\/)(\.env|\.env\.tmp|ÖNEMLI|node_modules|isler|\.DS_Store)(\/|$)/;

const dosyalar = [];
const gez = (goreli) => {
  const tam = path.join(PROJE, goreli);
  if (!fs.existsSync(tam) || YASAK.test(goreli)) return;
  if (fs.statSync(tam).isDirectory()) for (const a of fs.readdirSync(tam)) gez(path.posix.join(goreli, a));
  else dosyalar.push(goreli);
};
IZINLI.forEach(gez);
// botun durumu (paylaşılanlar, ayarlar, müzik havuzu) yalnızca ilk yüklemede gönderilir; sonra GitHub'daki sürüm esas
if (process.argv.includes("--ilk")) ["data/muzik", "data/paylasilanlar.json", "data/bot_ayar.json"].forEach(gez);

// ---------- secrets ----------

const secretKoy = async (ad, deger) => {
  await sodium.ready;
  const { j: anahtar } = await gh(`/repos/${depo}/actions/secrets/public-key`);
  const sifreli = sodium.to_base64(
    sodium.crypto_box_seal(sodium.from_string(deger), sodium.from_base64(anahtar.key, sodium.base64_variants.ORIGINAL)),
    sodium.base64_variants.ORIGINAL,
  );
  await gh(`/repos/${depo}/actions/secrets/${ad}`, { method: "PUT", body: JSON.stringify({ encrypted_value: sifreli, key_id: anahtar.key_id }) });
  console.log(`secret güncellendi: ${ad}`);
};

// GH_PAT'ı ENV_DOSYASI'nın içine koymuyoruz; ayrı secret olarak duruyor
const envMetni = fs
  .readFileSync(path.join(PROJE, ".env"), "utf8")
  .split("\n")
  .filter((s) => s && !s.startsWith("GH_PAT="))
  .join("\n");

if (!sadeceSecret) {
  let { durum, j: ref } = await gh(`/repos/${depo}/git/ref/heads/main`);
  if (durum === 404 || durum === 409) {
    // tamamen boş depoda git veri API'si çalışmaz; önce içerik API'siyle ilk dosya (README) oluşturulur
    const readme = "# İlm Sanat otomasyonu\n\nInstagram ve TikTok için otomatik haber videoları. Kullanım: KULLANIM.md\n";
    await gh(`/repos/${depo}/contents/README.md`, {
      method: "PUT",
      body: JSON.stringify({ message: "ilk dosya", content: Buffer.from(readme).toString("base64"), branch: "main" }),
    });
    ({ durum, j: ref } = await gh(`/repos/${depo}/git/ref/heads/main`));
  }
  const ust = durum === 404 ? null : ref.object.sha;
  console.log(`${dosyalar.length} dosya yükleniyor…`);
  const agac = [];
  for (const d of dosyalar) {
    const icerik = fs.readFileSync(path.join(PROJE, d));
    const { j: blob } = await gh(`/repos/${depo}/git/blobs`, { method: "POST", body: JSON.stringify({ content: icerik.toString("base64"), encoding: "base64" }) });
    agac.push({ path: d, mode: d.endsWith(".sh") ? "100755" : "100644", type: "blob", sha: blob.sha });
  }
  // base_tree: listede olmayan dosyalar (botun GitHub'da yazdığı durum dosyaları, README) korunur
  const { j: ustCommit } = await gh(`/repos/${depo}/git/commits/${ust}`);
  const { j: tree } = await gh(`/repos/${depo}/git/trees`, { method: "POST", body: JSON.stringify({ base_tree: ustCommit.tree.sha, tree: agac }) });
  const { j: commit } = await gh(`/repos/${depo}/git/commits`, {
    method: "POST",
    body: JSON.stringify({ message: "İlm Sanat otomasyonu", tree: tree.sha, parents: ust ? [ust] : [] }),
  });
  if (ust) await gh(`/repos/${depo}/git/refs/heads/main`, { method: "PATCH", body: JSON.stringify({ sha: commit.sha, force: true }) });
  else await gh(`/repos/${depo}/git/refs`, { method: "POST", body: JSON.stringify({ ref: "refs/heads/main", sha: commit.sha }) });
  console.log(`yüklendi: https://github.com/${depo}/commit/${commit.sha}`);
}

await secretKoy("ENV_DOSYASI", envMetni);
await secretKoy("GH_PAT", TOKEN);
console.log("Tamam.");
