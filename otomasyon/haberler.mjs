// Kaynaklardan haber ve analiz adaylarını toplar (config/kaynaklar.yaml ile aynı liste).
// Her aday: { kaynak, tur: "haber"|"analiz", baslik, link, tarih, ozet }

import { jsonOku } from "./ortak.mjs";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";

const KAYNAKLAR = [
  { ad: "Anadolu Agency", tur: "haber", rss: "https://www.aa.com.tr/en/rss/default?cat=middle-east" },
  { ad: "Anadolu Agency", tur: "haber", rss: "https://www.aa.com.tr/en/rss/default?cat=world" },
  { ad: "Al Jazeera", tur: "haber", rss: "https://www.aljazeera.com/xml/rss/all.xml" },
  { ad: "Middle East Eye", tur: "haber", rss: "https://www.middleeasteye.net/rss" },
  { ad: "Middle East Monitor", tur: "haber", rss: "https://www.middleeastmonitor.com/feed/" },
  { ad: "Anadolu Ajansı Analiz", tur: "analiz", rss: "https://www.aa.com.tr/tr/rss/default?cat=analiz" },
  { ad: "TRT World", tur: "haber", sayfalar: ["https://www.trtworld.com/middle-east", "https://www.trtworld.com/africa", "https://www.trtworld.com/world"] },
  { ad: "SETA", tur: "analiz", sitemap: ["https://www.setav.org/en/sitemap/yayinlar", "https://www.setav.org/sitemap/yayinlar"] },
];

const getir = async (url) => {
  const y = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(25000) });
  if (!y.ok) throw new Error(`${url} → HTTP ${y.status}`);
  return y.text();
};

const temizle = (s = "") =>
  s
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#8217;|&rsquo;/g, "’")
    .replace(/&#8216;|&lsquo;/g, "‘")
    .replace(/&#8220;|&ldquo;|&#8221;|&rdquo;/g, '"')
    .replace(/&#8211;|&ndash;/g, "–")
    .replace(/&#8212;|&mdash;/g, "—")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const etiket = (xml, ad) => {
  const m = xml.match(new RegExp(`<${ad}[^>]*>([\\s\\S]*?)</${ad}>`));
  return m ? temizle(m[1]) : "";
};

const rssOku = async (k) => {
  const xml = await getir(k.rss);
  return [...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/g)].map(([oge]) => ({
    kaynak: k.ad,
    tur: k.tur,
    baslik: etiket(oge, "title"),
    link: etiket(oge, "link").replace(/\?traffic_source=rss$/, ""),
    tarih: new Date(etiket(oge, "pubDate") || Date.now()).toISOString(),
    ozet: etiket(oge, "description").slice(0, 400),
  }));
};

// TRT World: RSS yok; bölüm sayfalarındaki /article/<id> linkleri ve sayfa başlıkları
const trtOku = async (k) => {
  const linkler = new Set();
  for (const s of k.sayfalar) {
    const html = await getir(s).catch(() => "");
    for (const [, id] of html.matchAll(/href="(?:https:\/\/(?:www\.)?trtworld\.com)?\/article\/([a-f0-9]{8,})"/g)) linkler.add(`https://www.trtworld.com/article/${id}`);
  }
  const sonuc = [];
  for (const link of [...linkler].slice(0, 15)) {
    const html = await getir(link).catch(() => "");
    const baslik = temizle(html.match(/<meta property="og:title" content="([^"]+)"/)?.[1] ?? "");
    const ozet = temizle(html.match(/<meta (?:name|property)="(?:og:)?description" content="([^"]+)"/)?.[1] ?? "");
    const tarih = html.match(/"datePublished":"([^"]+)"/)?.[1];
    if (baslik) sonuc.push({ kaynak: k.ad, tur: k.tur, baslik, link, tarih: tarih ? new Date(tarih).toISOString() : new Date().toISOString(), ozet });
  }
  return sonuc;
};

// SETA: yayın haritasından son yayınlar; başlık sayfadan okunur, etkinlik duyuruları atlanır
const setaOku = async (k) => {
  const sonuc = [];
  for (const s of k.sitemap) {
    const xml = await getir(s).catch(() => "");
    const ogeler = [...xml.matchAll(/<url>[\s\S]*?<loc>([^<]+)<\/loc>[\s\S]*?<lastmod>([^<]+)<\/lastmod>[\s\S]*?<\/url>/g)]
      .filter(([, l]) => !/\/(etkinlikler|events)\//.test(l))
      .slice(0, 6);
    for (const [, link, tarih] of ogeler) {
      const html = await getir(link).catch(() => "");
      const baslik = temizle(html.match(/<meta property="og:title" content="([^"]+)"/)?.[1] ?? html.match(/<title>([^<]+)<\/title>/)?.[1] ?? "");
      const ozet = temizle(html.match(/<meta (?:name|property)="(?:og:)?description" content="([^"]+)"/)?.[1] ?? "");
      if (baslik) sonuc.push({ kaynak: k.ad, tur: k.tur, baslik, link, tarih: new Date(tarih).toISOString(), ozet });
    }
  }
  return sonuc;
};

export const adaylariTopla = async ({ saat = 48 } = {}) => {
  const sinir = Date.now() - saat * 3600000;
  // paylaşılanlar ve henüz paylaşılmamış taslaklardaki haberler tekrar seçilmez
  const paylasilan = new Set([
    ...jsonOku("paylasilanlar.json", []).map((p) => p.link),
    ...Object.values(jsonOku("taslaklar.json", {})).flatMap((t) => (t.plan?.kaynaklar ?? []).map((k) => k.link)),
  ]);
  const sonuclar = await Promise.allSettled(
    KAYNAKLAR.map((k) => (k.rss ? rssOku(k) : k.sayfalar ? trtOku(k) : setaOku(k)).then((l) => ({ k, l }))),
  );
  const adaylar = [];
  const hatalar = [];
  for (const s of sonuclar) {
    if (s.status === "rejected") hatalar.push(String(s.reason?.message ?? s.reason));
    else adaylar.push(...s.value.l);
  }
  const gorulen = new Set();
  const temiz = adaylar.filter((a) => {
    if (!a.baslik || !a.link || gorulen.has(a.link) || paylasilan.has(a.link)) return false;
    gorulen.add(a.link);
    // analizler 7 gün, haberler istenen saat kadar geriye bakar
    return new Date(a.tarih).getTime() >= (a.tur === "analiz" ? Date.now() - 7 * 86400000 : sinir);
  });
  temiz.sort((a, b) => b.tarih.localeCompare(a.tarih));
  return { adaylar: temiz, hatalar };
};

// Bir haberin/analizin tam metnini sayfadan çıkarır (paragraflar).
export const makaleMetni = async (link) => {
  const html = await getir(link);
  const paragraflar = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)]
    .map(([, p]) => temizle(p))
    .filter((p) => p.length > 60 && !/cookie|subscribe|newsletter|©/i.test(p));
  return paragraflar.join("\n").slice(0, 9000);
};

if (process.argv[1]?.endsWith("haberler.mjs")) {
  const { adaylar, hatalar } = await adaylariTopla();
  const say = {};
  for (const a of adaylar) say[`${a.kaynak} (${a.tur})`] = (say[`${a.kaynak} (${a.tur})`] ?? 0) + 1;
  console.log(say);
  console.log(adaylar.slice(0, 5).map((a) => `${a.tarih.slice(0, 16)} ${a.kaynak}: ${a.baslik}`).join("\n"));
  if (hatalar.length) console.log("Hatalar:", hatalar);
}
