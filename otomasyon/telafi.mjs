// Kaçırılan takvim paylaşımlarını şimdi üretir. Çalışan bot taslakları data/taslaklar.json'dan okur:
// Telegram'daki düğmeleri o işler; cevap gelmezse taslak hazır olduktan GECIKME_DK sonra otomatik paylaşılır.
// Kullanım: node otomasyon/telafi.mjs 09:00:haber 14:00:analiz

import { log, jsonOku, jsonYaz, viyana, tgMesaj, tgVideo, tgHata } from "./ortak.mjs";
import { adaylariTopla } from "./haberler.mjs";
import { haberSec, haberPlani, tabloSec, tabloPlani } from "./icerik.mjs";
import { uret } from "./uret.mjs";

const GECIKME_DK = 30;
const TUR_ADI = { haber: "HABER", analiz: "ANALİZ", tablo: "PAZAR TABLOSU" };

const taslakYaz = (id, degisiklik) => {
  const t = jsonOku("taslaklar.json", {});
  t[id] = { ...(t[id] ?? {}), ...degisiklik };
  jsonYaz("taslaklar.json", t);
  return t[id];
};

const bugun = viyana().tarih;
for (const arg of process.argv.slice(2)) {
  const [saat, dk, tur] = arg.split(":");
  const id = `${bugun}_${saat}${dk}_${tur}_telafi`;
  try {
    taslakYaz(id, { tur, durum: "uretiliyor" });
    log(`[${id}] telafi üretimi başladı`);
    let plan;
    if (tur === "tablo") plan = await tabloPlani(await tabloSec());
    else {
      const { adaylar } = await adaylariTopla({ saat: tur === "analiz" ? 168 : 30 });
      const secim = await haberSec(adaylar, tur);
      plan = await haberPlani({ tur, ana: secim.ana, ayni: secim.ayni });
    }
    const sonuc = await uret(plan, id);
    const zaman = new Date(Date.now() + GECIKME_DK * 60000);
    const baslik = plan.baslik.replace(/\*\*/g, "");
    taslakYaz(id, { durum: "onay_bekliyor", zaman: zaman.toISOString(), video: sonuc.video, kapak: sonuc.kapak, aciklama: sonuc.aciklama, baslik, plan });

    await tgVideo(sonuc.video, `📝 TELAFİ TASLAĞI · ${TUR_ADI[tur]} (bugün ${saat}:${dk}) · ${baslik}`, sonuc.kapak);
    const kaynak = plan.kaynaklar.map((k) => `• ${k.ad}: ${k.link}`).join("\n");
    const mesaj = await tgMesaj(
      `Paylaşım metni:\n\n${sonuc.aciklama}\n\nKaynaklar:\n${kaynak}\n\n⏰ Paylaş'a basarsan hemen paylaşılır. Cevap vermezsen ${viyana(zaman).saat}'da otomatik paylaşılacak.`,
      {
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
      },
    );
    taslakYaz(id, { mesajId: mesaj.message_id });
    log(`[${id}] telafi taslağı Telegram'a gönderildi`);
  } catch (e) {
    taslakYaz(id, { durum: "hata", hata: e.message });
    await tgHata(`Telafi ${TUR_ADI[tur] ?? tur} taslağı hazırlanamadı`, e);
  }
}
