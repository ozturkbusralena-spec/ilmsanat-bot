// Plan → video: Magnific (ses, görsel, Kling, müzik) + ffmpeg (tempo, zamanlama) + Remotion (kurgu).
// Çıktı: data/isler/<id>/{video.mp4, kapak_kucuk.jpg, plan.json, props.json}

import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { PROJE, VERI, envOku, log, bekle, jsonOku } from "./ortak.mjs";

const calistir = promisify(execFile);
const VIDEO = path.join(PROJE, "video");
const NODE_PATH = `${process.env.HOME}/.local/node/bin:${process.env.PATH}`;
const remotion = (args, sure = 900000) =>
  calistir(path.join(VIDEO, "node_modules/.bin/remotion"), args, { cwd: VIDEO, env: { ...process.env, PATH: NODE_PATH }, timeout: sure, maxBuffer: 64 << 20 });

const SES_ID = "onwK4e9ZLuTAKqWW03F9"; // ElevenLabs "Daniel"
const MUZIK_HAVUZ = 6;

// ---------- Magnific ----------

const API = "https://api.magnific.com";

// Bazı modellerde durum adresi gönderim adresinden farklıdır (Kling 2.6 Pro: …-pro → …).
const durumAdresi = (uc) => (uc.endsWith("/kling-v2-6-pro") ? uc.replace(/-pro$/, "") : uc);

export const magnific = async (uc, govde, cikti) => {
  const key = envOku().MAGNIFIC_API_KEY;
  let gorev;
  for (let deneme = 1; deneme <= 4; deneme++) {
    const y = await (
      await fetch(API + uc, { method: "POST", headers: { "x-magnific-api-key": key, "Content-Type": "application/json" }, body: JSON.stringify(govde) })
    ).json();
    gorev = y.data?.task_id;
    if (gorev) break;
    // "Error consuming credits" gibi geçici hatalarda tekrar dene
    if (deneme === 4) throw new Error(`Magnific ${uc}: ${y.message ?? JSON.stringify(y)}`);
    await bekle(15000 * deneme);
  }
  for (let i = 0; i < 160; i++) {
    await bekle(5000);
    const d = await (await fetch(`${API}${durumAdresi(uc)}/${gorev}`, { headers: { "x-magnific-api-key": key } })).json();
    const s = d.data?.status;
    if (!s) throw new Error(`Magnific durum okunamadı (${uc}): ${d.message ?? JSON.stringify(d)}`);
    if (s === "COMPLETED") {
      const url = d.data.generated?.[0];
      if (!url) throw new Error(`Magnific ${uc}: tamamlandı ama dosya yok`);
      fs.writeFileSync(cikti, Buffer.from(await (await fetch(url)).arrayBuffer()));
      return cikti;
    }
    if (s === "FAILED") throw new Error(`Magnific ${uc} başarısız: ${d.data.error ?? ""}`);
  }
  throw new Error(`Magnific ${uc}: 13 dakikada bitmedi`);
};

// ---------- ses ----------

const ffmpeg = (args) => remotion(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", ...args]);
const ffmpegCikti = async (args) => {
  try {
    const r = await remotion(["ffmpeg", "-hide_banner", ...args]);
    return r.stdout + r.stderr;
  } catch (e) {
    return (e.stdout ?? "") + (e.stderr ?? "");
  }
};

const sure = async (dosya) => Number((await remotion(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", dosya])).stdout.trim());

const konusmaAraliklari = async (dosya, toplam) => {
  const c = await ffmpegCikti(["-i", dosya, "-af", "silencedetect=noise=-35dB:d=0.22", "-f", "null", "-"]);
  const sesizlik = [...c.matchAll(/silence_(start|end): ([0-9.]+)/g)].map(([, t, v]) => [t, Number(v)]);
  const araliklar = [];
  let bas = 0;
  for (const [t, v] of sesizlik) {
    if (t === "start") {
      if (v - bas > 0.05) araliklar.push([Number(bas.toFixed(2)), Number(v.toFixed(2))]);
    } else bas = v;
  }
  if (toplam - bas > 0.05) araliklar.push([Number(bas.toFixed(2)), Number(toplam.toFixed(2))]);
  return araliklar;
};

// Cümle başlangıçlarını konuşma aralıklarına harf ağırlığıyla yerleştirir (şablondaki altyazı ile aynı yöntem).
const cumleZamanlari = (cumleler, konusma) => {
  const kelimeler = cumleler.flatMap((c, ci) => c.split(/\s+/).filter(Boolean).map((k) => ({ k, ci })));
  const toplamAgirlik = kelimeler.reduce((a, w) => a + w.k.length + 1, 0);
  const toplamKonusma = konusma.reduce((a, [b, s]) => a + (s - b), 0);
  const gercek = (z) => {
    let kalan = z;
    for (const [b, s] of konusma) {
      if (kalan <= s - b) return b + kalan;
      kalan -= s - b;
    }
    return konusma[konusma.length - 1][1];
  };
  const baslar = [];
  let birikim = 0;
  for (const w of kelimeler) {
    if (baslar[w.ci] === undefined) baslar[w.ci] = gercek((birikim / toplamAgirlik) * toplamKonusma);
    birikim += w.k.length + 1;
  }
  return baslar;
};

// ---------- müzik havuzu ----------

const MUZIK_PROMPT = {
  haber:
    "Modern cinematic world-news documentary score, like an international news channel package: driving pulsing synth bass on every eighth note, tight ticking hi-hat clock rhythm, punchy hybrid trailer percussion with big low impacts, urgent rising string ostinato, dark minor key, confident and tense, steady fast 122 bpm, continuous momentum from the first second, clean modern mix, instrumental only, no vocals, no ethnic or Middle Eastern instruments",
  sanat:
    "Elegant cinematic documentary score for a museum art film: flowing string ensemble, warm felt piano, soft pulsing low strings, gentle forward momentum, reflective but not sleepy, 96 bpm, rich modern film mix, instrumental only, no vocals",
};

// En yüksek enerjili 36 sn'lik bölümü (10 sn'lik pencerelerde ölçülen yüksekliğe göre) keser.
const enEnerjikBolum = async (girdi, cikti) => {
  const toplam = await sure(girdi);
  let enIyi = 0;
  let enIyiDeger = -99;
  for (let s = 0; s + 36 <= toplam; s += 10) {
    const c = await ffmpegCikti(["-i", girdi, "-af", `atrim=${s}:${s + 36},loudnorm=print_format=json`, "-f", "null", "-"]);
    const i = Number(c.match(/"input_i"\s*:\s*"(-?[0-9.]+)"/)?.[1] ?? -99);
    if (i > enIyiDeger) [enIyi, enIyiDeger] = [s, i];
  }
  await ffmpeg(["-i", girdi, "-af", `atrim=${enIyi}:${enIyi + 36},asetpts=PTS-STARTPTS,loudnorm=I=-14:TP=-1.5,aresample=48000`, "-ac", "2", cikti]);
};

const muzikSec = async (tur, isKlasoru) => {
  const havuz = path.join(VERI, "muzik", tur === "tablo" ? "sanat" : "haber");
  fs.mkdirSync(havuz, { recursive: true });
  let parcalar = fs.readdirSync(havuz).filter((f) => f.endsWith(".wav"));
  if (parcalar.length < MUZIK_HAVUZ) {
    try {
      const ham = path.join(isKlasoru, "muzik_ham.mp3");
      await magnific("/v1/ai/music-generation/lyria-3", { prompt: MUZIK_PROMPT[tur === "tablo" ? "sanat" : "haber"], model: "pro" }, ham);
      const yeni = path.join(havuz, `lyria3_${Date.now()}.wav`);
      await enEnerjikBolum(ham, yeni);
      parcalar = fs.readdirSync(havuz).filter((f) => f.endsWith(".wav"));
    } catch (e) {
      log("Yeni müzik üretilemedi, havuzdan seçiliyor:", e.message);
      if (!parcalar.length) throw e;
    }
  }
  return path.join(havuz, parcalar[Math.floor(Math.random() * parcalar.length)]);
};

// ---------- tablo odakları ----------

const ODAK = {
  genel: { odak: [50, 50], yakinlasma: [1.0, 1.06], sigdir: true },
  orta: { odak: [50, 50], yakinlasma: [1.5, 1.62] },
  sol_ust: { odak: [25, 30], yakinlasma: [1.6, 1.72] },
  sag_ust: { odak: [75, 30], yakinlasma: [1.6, 1.72] },
  sol_alt: { odak: [25, 70], yakinlasma: [1.6, 1.72] },
  sag_alt: { odak: [75, 70], yakinlasma: [1.6, 1.72] },
};

// ---------- ana akış ----------

export const uret = async (plan, isId) => {
  const is = path.join(VERI, "isler", isId);
  const pub = path.join(VIDEO, "public", "is", isId);
  fs.mkdirSync(is, { recursive: true });
  fs.mkdirSync(pub, { recursive: true });
  fs.writeFileSync(path.join(is, "plan.json"), JSON.stringify(plan, null, 2));
  const yol = (ad) => `is/${isId}/${ad}`;

  // 1) seslendirme + görseller + müzik aynı anda
  log(`[${isId}] Magnific: ses, görseller, müzik…`);
  const metin = plan.cumleler.join(" ");
  const sesIsi = magnific(
    "/v1/ai/voiceover/elevenlabs-turbo-v2-5",
    { text: metin, voice_id: SES_ID, stability: 0.4, similarity_boost: 0.75, speed: 1.2, use_speaker_boost: true },
    path.join(is, "ses.mp3"),
  );
  let gorselIsleri;
  if (plan.tur === "tablo") {
    const g = path.join(pub, "tablo.jpg");
    gorselIsleri = fetch(plan.eser.gorsel).then(async (r) => fs.writeFileSync(g, Buffer.from(await r.arrayBuffer())));
  } else {
    gorselIsleri = Promise.all(
      plan.sahneler.map((s, i) =>
        magnific("/v1/ai/text-to-image/seedream-v4-5", { prompt: s.gorsel_prompt, aspect_ratio: "social_story_9_16" }, path.join(pub, `sahne${i}.jpg`)),
      ),
    );
  }
  const muzikIsi = muzikSec(plan.tur, is);
  await Promise.all([sesIsi, gorselIsleri]);

  // 2) Kling hareketleri: kredi tasarrufu için video başına en fazla klingSayisi (varsayılan 2) çekim;
  //    ilk sahne hariç (hook sahnesi şablonda hızlı yakınlaşmayla hareket eder), diğerleri yakınlaşma/kaydırma ile
  const klingSayisi = jsonOku("bot_ayar.json", {}).klingSayisi ?? 2;
  if (plan.tur !== "tablo" && klingSayisi > 0) {
    log(`[${isId}] Kling hareket klipleri (${klingSayisi})…`);
    await Promise.all(
      plan.sahneler.slice(1, 1 + klingSayisi).map((s, j) => {
        const i = j + 1;
        const b64 = fs.readFileSync(path.join(pub, `sahne${i}.jpg`)).toString("base64");
        return magnific(
          "/v1/ai/image-to-video/kling-v2-6-pro",
          {
            image: b64,
            prompt: `${s.hareket_prompt}, oil painting texture preserved`,
            negative_prompt: "faces, text, morphing, warping, camera shake, distortion",
            duration: "5",
            cfg_scale: 0.5,
            aspect_ratio: "social_story_9_16",
            generate_audio: false,
          },
          path.join(pub, `sahne${i}.mp4`),
        ).catch((e) => log(`Kling sahne ${i} başarısız, durağan görsel kullanılacak:`, e.message));
      }),
    );
  }

  // 3) ses: hızlandır, seviyele, konuşma aralıkları
  await ffmpeg(["-i", path.join(is, "ses.mp3"), "-af", "atempo=1.1,loudnorm=I=-15:TP=-1.5:LRA=9,aresample=48000", "-ac", "2", path.join(pub, "ses.wav")]);
  const sesSuresi = await sure(path.join(pub, "ses.wav"));
  const konusma = await konusmaAraliklari(path.join(pub, "ses.wav"), sesSuresi);
  const gecikme = 0.25;
  const cz = cumleZamanlari(plan.cumleler, konusma).map((t) => t + gecikme);
  const icerikSonu = gecikme + sesSuresi + 0.2;
  const cumleSonu = (i) => (i + 1 < cz.length ? cz[i + 1] : icerikSonu);

  fs.copyFileSync(await muzikIsi, path.join(pub, "muzik.wav"));

  // 4) Remotion verisi
  const kaynakSahneler =
    plan.tur === "tablo"
      ? plan.odaklar.map((o) => ({ cumle: o.cumle, ...ODAK[o.odak] }))
      : plan.sahneler.map((s, i) => ({ cumle: s.cumle, i }));
  const sahneler = kaynakSahneler.map((s, k) => {
    const bas = k === 0 ? 0 : cz[s.cumle];
    const son = k + 1 < kaynakSahneler.length ? cz[kaynakSahneler[k + 1].cumle] : icerikSonu + 0.1;
    if (plan.tur === "tablo") return { dosya: yol("tablo.jpg"), bas, son, odak: s.odak, yakinlasma: s.yakinlasma, sigdir: s.sigdir, karartma: 0.15 };
    const video = fs.existsSync(path.join(pub, `sahne${s.i}.mp4`)) ? yol(`sahne${s.i}.mp4`) : undefined;
    return {
      dosya: yol(`sahne${s.i}.jpg`),
      video,
      videoHizi: video ? Math.min(1, 5 / Math.max(0.5, son - bas)) : undefined,
      bas,
      son,
      // Kling'siz durağan çekimler daha belirgin yakınlaşma/kaydırma ile hareketlendirilir (yönler sırayla değişir)
      yakinlasma: k === 0 ? [1.0, 1.4] : video ? [1.0, 1.06] : k % 2 ? [1.02, 1.18] : [1.18, 1.02],
      kayma: k === 0 ? [0, 120] : video ? undefined : k % 2 ? [-50, 50] : [50, -50],
      karartma: k === 0 ? 0.25 : 0.3,
    };
  });

  // hook yazısı ilk cümle bitince kalkar; diğer grafikler onunla üst üste binmez
  const hookSon = cumleSonu(0);
  const grafikler = [{ tur: "hook", bas: 0, son: hookSon, satirlar: plan.hook_satirlar }];
  plan.grafikler.forEach((g, i) => {
    const bas = Math.max(hookSon + 0.05, cz[g.cumle] + 0.1);
    const sonraki = plan.grafikler[i + 1] ? cz[plan.grafikler[i + 1].cumle] - 0.1 : icerikSonu;
    const son = Math.max(bas + 1.5, Math.min(cumleSonu(g.cumle) + 1.2, sonraki));
    if (g.tur === "kartlar")
      grafikler.push({
        tur: "kartlar",
        bas,
        son,
        kartlar: g.kartlar.slice(0, 3).map((k, j) => ({ ulke: k.ulke, unvan: k.unvan, bas: Math.max(bas, (cz[k.cumle] ?? bas) + j * 0.15) })),
      });
    else if (g.tur === "damga") grafikler.push({ tur: "damga", bas, son, ust: g.ust.replace(/\\n/g, "\n"), alt: g.alt });
    else grafikler.push({ tur: "buyuk", bas, son, satirlar: g.satirlar.slice(0, 3) });
  });

  const props = {
    etiket: plan.etiket,
    etiketRengi: plan.etiket === "ANALYSIS" ? "yesil" : plan.etiket === "ESCALATION" ? "kirmizi" : "altin",
    baslik: plan.baslik,
    baslikBas: hookSon,
    ses: yol("ses.wav"),
    sesGecikme: gecikme,
    sesSuresi,
    konusma,
    metin,
    muzik: yol("muzik.wav"),
    muzikSesi: plan.tur === "tablo" ? 0.3 : 0.25,
    darbe: "marka/sfx/darbe.wav",
    whoosh: "marka/sfx/whoosh.wav",
    sahneler,
    isaretler: [],
    grafikler,
  };
  const propsYolu = path.join(is, "props.json");
  fs.writeFileSync(propsYolu, JSON.stringify(props, null, 2));

  // 5) kurgu
  log(`[${isId}] Remotion kurgusu…`);
  const videoYolu = path.join(is, "video.mp4");
  await remotion(["render", "src/index.ts", "Haber", videoYolu, `--props=${propsYolu}`, "--codec=h264", "--crf=20", "--audio-codec=aac", "--log=error"]);
  // Telegram önizlemesi için 180×320 kapak (Remotion ölçekler; macOS/Linux fark etmez)
  const kapak = path.join(is, "kapak_kucuk.jpg");
  await remotion(["still", "src/index.ts", "Haber", kapak, `--props=${propsYolu}`, "--frame=75", "--image-format=jpeg", "--scale=0.1667", "--log=error"]);
  log(`[${isId}] Video hazır: ${videoYolu}`);
  return { video: videoYolu, kapak, aciklama: plan.aciklama };
};

// Bir işin public/ altındaki medyasını siler (paylaşımdan sonra yer açmak için; video data/ altında kalır)
export const isTemizle = (isId) => fs.rmSync(path.join(VIDEO, "public", "is", isId), { recursive: true, force: true });
