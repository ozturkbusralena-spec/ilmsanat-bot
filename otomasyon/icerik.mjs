// Claude ile haber seçimi ve video planı (senaryo, çekimler, grafikler, paylaşım metni).
// Pazar tablosu için Met Museum Open Access'ten kamu malı oryantalist eser seçer.

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { envOku, jsonOku, log } from "./ortak.mjs";
import { makaleMetni } from "./haberler.mjs";

const MODEL = "claude-opus-5-5";

const istemci = () => new Anthropic({ apiKey: envOku().ANTHROPIC_API_KEY });

const cagir = async ({ sistem, kullanici, sema, effort, maxTokens = 16000 }) => {
  let yanit;
  try {
    yanit = await istemci().messages.parse({
      model: MODEL,
      max_tokens: maxTokens,
      system: sistem,
      messages: [{ role: "user", content: kullanici }],
      output_config: { effort, format: zodOutputFormat(sema) },
    });
  } catch (e) {
    if (e instanceof Anthropic.BadRequestError && /credit balance/i.test(e.message))
      throw new Error("Claude API kredisi yok. platform.claude.com → Settings → Billing'den kredi yüklenmeli (5 $ yeterli).");
    if (e instanceof Anthropic.AuthenticationError) throw new Error("Claude API anahtarı geçersiz ya da süresi dolmuş.");
    throw e;
  }
  if (yanit.stop_reason === "refusal") throw new Error(`Claude isteği reddetti (${yanit.stop_details?.category ?? "bilinmiyor"})`);
  if (yanit.stop_reason === "max_tokens") throw new Error("Claude yanıtı yarıda kesildi (max_tokens)");
  if (!yanit.parsed_output) throw new Error("Claude yanıtı beklenen biçimde değil");
  return yanit.parsed_output;
};

// ---------- haber seçimi ----------

const SECIM_KURALLARI = `You select stories for "Ilm Sanat", an English-language Instagram/TikTok channel on geopolitics and history.
Priorities, in order:
1. Middle East geopolitics (most important)
2. North Africa and the Horn of Africa (Libya, Egypt, Sudan, Somalia, ...)
3. Great-power geopolitics: USA, China, Russia — especially where it touches the Middle East or Africa
4. Political history (e.g. the Balfour Declaration, the Palestine land question) — only when tied to an anniversary or today's news
Prefer the most important development of the day; if the day is quiet, the most important story of the week.
A story reported by several outlets counts as more important and more reliable. Anadolu Agency is trusted.
Avoid: celebrity, sport, crime without political weight, business news without geopolitical weight, stories already covered.`;

const SecimSemasi = z.object({
  secim: z.number().int().describe("index of the chosen candidate"),
  ayni_olay: z.array(z.number().int()).describe("indexes of other candidates reporting the same event, may be empty"),
  gerekce: z.string().describe("one sentence, in Turkish, why this story"),
});

export const haberSec = async (adaylar, tur, konu) => {
  const taslakBasliklari = Object.values(jsonOku("taslaklar.json", {}))
    .filter((t) => t.baslik && !["atlandi", "hata"].includes(t.durum))
    .map((t) => ({ baslik: t.baslik }));
  const onceki = [...jsonOku("paylasilanlar.json", []), ...taslakBasliklari].slice(-30).map((p) => `- ${p.baslik}`).join("\n") || "(none)";
  const liste = adaylar
    .filter((a) => a.tur === tur)
    .slice(0, 160)
    .map((a, i) => ({ ...a, i }));
  if (!liste.length) throw new Error(`Seçilecek ${tur} adayı yok`);
  const metin = liste.map((a) => `[${a.i}] ${a.tarih.slice(0, 16)} | ${a.kaynak} | ${a.baslik} — ${a.ozet.slice(0, 160)}`).join("\n");
  const s = await cagir({
    sistem: SECIM_KURALLARI,
    kullanici:
      `Choose one ${tur === "analiz" ? "ANALYSIS / opinion piece" : "NEWS story"} for the next post.` +
      (konu ? `\nThe editor asked for a post on this topic; choose the candidate that best matches it: ${konu}` : "") +
      `\n\nAlready covered recently:\n${onceki}\n\nCandidates:\n${metin}`,
    sema: SecimSemasi,
    effort: "low",
    maxTokens: 4000,
  });
  const secilen = liste[s.secim];
  if (!secilen) throw new Error("Claude geçersiz bir aday seçti");
  const ayni = s.ayni_olay.map((i) => liste[i]).filter(Boolean);
  log(`Seçilen ${tur}: ${secilen.kaynak} — ${secilen.baslik} (${s.gerekce})`);
  return { ana: secilen, ayni, gerekce: s.gerekce };
};

// ---------- video planı ----------

const PLAN_KURALLARI = `You write short vertical news videos for "Ilm Sanat" (Instagram Reels / TikTok), modelled on agency-style geopolitics explainers.

NARRATION
- English, serious and precise, but punchy: short sentences, no filler.
- The FIRST sentence is the hook: a striking, accurate one-liner that makes viewers stay. No question-bait, no exaggeration.
- Length: news ~75 words; analysis and painting ~90 words. Every claim must come from the source texts. Paraphrase; never copy sentences.
- Never mention AI, generated images or illustrations.

ON-SCREEN TEXT
- etiket: one of KEY DEVELOPMENT, ESCALATION, ANALYSIS, MAP EXPLAINER, HISTORY, ORIENTALIST ART.
- baslik: a short headline (max 8 words); wrap 1–2 key phrases in **double asterisks** to colour them.
- hook_satirlar: the hook split into 2–3 short lines for big kinetic text; wrap the single key word in **double asterisks**.

SHOTS (sahneler) — 5 or 6, each starts at a narration sentence (cumle = 0-based sentence index, ascending, first is 0)
- gorsel_prompt: an English image prompt. Style: 19th-century academic oil painting or copperplate engraving / antique map, dark desaturated navy and muted brass tones, dramatic chiaroscuro, cinematic composition, visible brushstrokes. Never: recognisable real people's faces, flags with text, blood or corpses, any text or letters in the image. Show places, buildings, objects, maps, silhouettes, symbolic scenes.
- hareket_prompt: a gentle camera move for an image-to-video model (slow push-in, drift, light flicker, mist, clouds). No fast motion, no morphing.

GRAPHICS (grafikler) — 3 to 5, each tied to a narration sentence (cumle). Types:
- kartlar: 2–3 cards (ulke = country or actor in CAPITALS, unvan = role/short fact), each with its own cumle where it is mentioned
- damga: a stamp with ust (2–4 words, may use \\n) and alt (date or short fact)
- buyuk: 2–3 big lines (satirlar) restating the key point; wrap the key word in **double asterisks**
Unused fields: empty string or empty array. Do not put a graphic on sentence 0 (the hook has its own text).

CAPTION (aciklama) for Instagram
- Line 1: the headline (no asterisks). Then 2–3 short academic paragraphs with names, roles, dates and context, strictly from the sources.
- Then "Source: <outlet names>". Then 8–10 relevant hashtags ending with #IlmSanat.
- Never mention AI.`;

const PlanSemasi = z.object({
  etiket: z.enum(["KEY DEVELOPMENT", "ESCALATION", "ANALYSIS", "MAP EXPLAINER", "HISTORY", "ORIENTALIST ART"]),
  baslik: z.string(),
  hook_satirlar: z.array(z.string()),
  cumleler: z.array(z.string()).describe("narration, one sentence per item; item 0 is the hook"),
  sahneler: z.array(z.object({ cumle: z.number().int(), gorsel_prompt: z.string(), hareket_prompt: z.string() })),
  grafikler: z.array(
    z.object({
      tur: z.enum(["kartlar", "damga", "buyuk"]),
      cumle: z.number().int(),
      satirlar: z.array(z.string()),
      kartlar: z.array(z.object({ ulke: z.string(), unvan: z.string(), cumle: z.number().int() })),
      ust: z.string(),
      alt: z.string(),
    }),
  ),
  aciklama: z.string(),
});

const planDuzelt = (p) => {
  // sahneler ve grafikler cümle sırasına göre, geçerli aralıkta
  const son = p.cumleler.length - 1;
  p.sahneler = p.sahneler.map((s) => ({ ...s, cumle: Math.min(Math.max(0, s.cumle), son) })).sort((a, b) => a.cumle - b.cumle);
  if (p.sahneler.length && p.sahneler[0].cumle !== 0) p.sahneler[0].cumle = 0;
  p.grafikler = p.grafikler.filter((g) => g.cumle > 0 && g.cumle <= son).sort((a, b) => a.cumle - b.cumle);
  if (/\b(AI|artificial intelligence|generated)\b/i.test(p.aciklama)) p.aciklama = p.aciklama.replace(/.*\b(AI|artificial intelligence|generated)\b.*\n?/gi, "");
  return p;
};

export const haberPlani = async ({ tur, ana, ayni = [], talimat }) => {
  const kaynaklar = [ana, ...ayni.slice(0, 2)];
  const metinler = [];
  for (const k of kaynaklar) {
    const govde = await makaleMetni(k.link).catch(() => "");
    metinler.push(`### ${k.kaynak} — ${k.baslik}\n${k.link}\n${govde || k.ozet}`);
  }
  const plan = await cagir({
    sistem: PLAN_KURALLARI,
    kullanici:
      `Write the plan for one ${tur === "analiz" ? "ANALYSIS (use etiket ANALYSIS; credit the author/outlet in the caption; if the source is in Turkish, write everything in English)" : "NEWS"} video.\n` +
      (talimat ? `\nThe editor asked for this change, apply it: ${talimat}\n` : "") +
      `\nSource texts:\n\n${metinler.join("\n\n")}`,
    sema: PlanSemasi,
    effort: "medium",
  });
  return { ...planDuzelt(plan), tur, kaynaklar: kaynaklar.map((k) => ({ ad: k.kaynak, baslik: k.baslik, link: k.link })) };
};

// ---------- Pazar: oryantalist tablo ----------

// v1/search 2026-10-01'de kapatıldı; v1.1/search sayfalı (offset/limit). Nesne ayrıntısı hâlâ v1/objects.
const MET = "https://collectionapi.metmuseum.org/public/collection";
const UYGUNSUZ = /nude|nudity|naked|bath|hammam|harem|odalisque|slave/i;
const RESSAMLAR = [
  "orientalist",
  "Jean-Léon Gérôme",
  "Ludwig Deutsch",
  "Rudolf Ernst",
  "Frederick Arthur Bridgman",
  "Eugène Fromentin",
  "Alberto Pasini",
  "John Frederick Lewis",
  "Osman Hamdi",
  "Eugène Delacroix",
];

export const tabloSec = async () => {
  const kullanilan = new Set(jsonOku("paylasilanlar.json", []).filter((p) => p.tur === "tablo").map((p) => p.link));
  const idler = new Set();
  for (const q of RESSAMLAR) {
    const ara = await (
      await fetch(`${MET}/v1.1/search?q=${encodeURIComponent(q)}&hasImages=true&isPublicDomain=true&medium=Paintings&limit=40`)
    )
      .json()
      .catch(() => ({}));
    for (const id of ara.objectIDs ?? []) idler.add(id);
  }
  for (const id of [...idler].sort(() => Math.random() - 0.5).slice(0, 40)) {
    const o = await (await fetch(`${MET}/v1/objects/${id}`)).json().catch(() => null);
    if (!o?.isPublicDomain || !o.primaryImage || o.classification !== "Paintings") continue;
    const link = o.objectURL;
    const etiketler = (o.tags ?? []).map((t) => t.term).join(" ");
    if (kullanilan.has(link) || UYGUNSUZ.test(`${o.title} ${etiketler}`)) continue;
    log(`Pazar tablosu: ${o.artistDisplayName} — ${o.title}`);
    return {
      baslik: o.title,
      ressam: o.artistDisplayName,
      ressamBilgi: o.artistDisplayBio,
      tarih: o.objectDate,
      teknik: o.medium,
      gorsel: o.primaryImage,
      link,
      kaynak: "The Metropolitan Museum of Art",
    };
  }
  throw new Error("Uygun kamu malı oryantalist tablo bulunamadı");
};

const TabloPlanSemasi = z.object({
  baslik: z.string(),
  hook_satirlar: z.array(z.string()),
  cumleler: z.array(z.string()),
  odaklar: z.array(
    z.object({
      cumle: z.number().int(),
      odak: z.enum(["genel", "sol_ust", "sag_ust", "orta", "sol_alt", "sag_alt"]).describe("which part of the painting to show"),
    }),
  ),
  grafikler: z.array(
    z.object({
      tur: z.enum(["kartlar", "damga", "buyuk"]),
      cumle: z.number().int(),
      satirlar: z.array(z.string()),
      kartlar: z.array(z.object({ ulke: z.string(), unvan: z.string(), cumle: z.number().int() })),
      ust: z.string(),
      alt: z.string(),
    }),
  ),
  aciklama: z.string(),
});

export const tabloPlani = async (eser, talimat) => {
  const p = await cagir({
    sistem:
      PLAN_KURALLARI +
      `\n\nSUNDAY PAINTING EPISODE: the video shows one real painting. Instead of shots, give 5–6 "odaklar" (which part of the painting to frame while each sentence plays; first must be cumle 0, "genel"). Tell the story of the painting and a short biography of the painter. etiket is ORIENTALIST ART. Use a damga with the painter's name and life dates. In the caption, mention the museum. Approach Orientalism with scholarly nuance.`,
    kullanici:
      `Painting: "${eser.baslik}" by ${eser.ressam} (${eser.ressamBilgi}), ${eser.tarih}, ${eser.teknik}. Collection: ${eser.kaynak} (${eser.link}).` +
      (talimat ? `\nThe editor asked for this change, apply it: ${talimat}` : "") +
      `\nUse only well-established facts about the painter; if unsure, say less.`,
    sema: TabloPlanSemasi,
    effort: "medium",
  });
  const son = p.cumleler.length - 1;
  p.odaklar = p.odaklar.map((o) => ({ ...o, cumle: Math.min(Math.max(0, o.cumle), son) })).sort((a, b) => a.cumle - b.cumle);
  if (p.odaklar[0]) p.odaklar[0].cumle = 0;
  p.grafikler = p.grafikler.filter((g) => g.cumle > 0 && g.cumle <= son);
  return { ...p, etiket: "ORIENTALIST ART", tur: "tablo", eser, kaynaklar: [{ ad: eser.kaynak, baslik: eser.baslik, link: eser.link }] };
};
