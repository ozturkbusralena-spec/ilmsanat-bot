// Yarım kalan bir paylaşımı tamamlar (ör. bağlantı koptuğu için Instagram ya da TikTok'a gitmeyen taslak).
// Kullanım: node otomasyon/eksik_paylas.mjs <taslak-id> instagram|tiktok
import { jsonOku, jsonYaz, tgMesaj, log } from "./ortak.mjs";
import { herIkisinePaylas } from "./paylas.mjs";
import { isTemizle } from "./uret.mjs";

const [id, hedef] = process.argv.slice(2);
const taslaklar = jsonOku("taslaklar.json", {});
const t = taslaklar[id];
if (!t?.video || !["instagram", "tiktok"].includes(hedef)) {
  console.error("Kullanım: node otomasyon/eksik_paylas.mjs <taslak-id> instagram|tiktok");
  process.exit(1);
}
log(`[${id}] eksik paylaşım tamamlanıyor: ${hedef}`);
const sonuc = await herIkisinePaylas(t.video, t.aciklama, { instagram: hedef === "instagram", tiktok: hedef === "tiktok" });
const basarili = !sonuc.startsWith("❌");
taslaklar[id] = { ...t, sonuc: `${t.sonuc ?? ""}\n\n(tamamlandı) ${sonuc}`, durum: basarili && hedef === "instagram" ? "paylasildi" : t.durum };
jsonYaz("taslaklar.json", taslaklar);
if (basarili && hedef === "instagram") {
  const p = jsonOku("paylasilanlar.json", []);
  for (const k of t.plan?.kaynaklar ?? []) p.push({ tarih: new Date().toISOString(), tur: t.tur, baslik: t.baslik, link: k.link });
  jsonYaz("paylasilanlar.json", p.slice(-500));
  isTemizle(id);
}
await tgMesaj(`🔁 Yarım kalan paylaşım tamamlandı — "${t.baslik}":\n\n${sonuc}`);
log(sonuc);
