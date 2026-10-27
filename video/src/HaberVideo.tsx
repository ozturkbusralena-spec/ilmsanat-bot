import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from "remotion";
import { loadFont as loadOpenSans } from "@remotion/google-fonts/OpenSans";
import { loadFont as loadCormorant } from "@remotion/google-fonts/CormorantGaramond";
import type { Grafik, HaberVerisi, Isaret, Sahne } from "./tipler";

const { fontFamily: SANS } = loadOpenSans("normal", { weights: ["600", "700", "800"], subsets: ["latin", "latin-ext"] });
const { fontFamily: SERIF } = loadCormorant("italic", { weights: ["500", "600"], subsets: ["latin", "latin-ext"] });

// İlm Sanat marka renkleri (STIL_REHBERI.md)
const RENK = {
  gece: "#0b1424",
  altin: "#907640", // Grauorange
  fildisi: "#f3ecdc",
  lacivert: "#142d54", // Dunkelblau
  yesil: "#183c25", // Dunkelgrün
  kirmizi: "#b3261e",
};

const KAPANIS = 2.5; // saniye
const GECIS = 0.18; // kesmeler hızlı; kısa çapraz geçiş

export const haberSuresi = (v: HaberVerisi) => v.sesGecikme + v.sesSuresi + 0.2 + KAPANIS;

const kenetle = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// "**altın** kelime" → parçalar
const Vurgulu: React.FC<{ metin: string; renk?: string }> = ({ metin, renk = RENK.altin }) => (
  <>
    {metin.split("**").map((p, i) => (
      <span key={i} style={{ color: i % 2 === 1 ? renk : undefined }}>
        {p}
      </span>
    ))}
  </>
);

// ---------- arka plan sahneleri ----------

const SahneKatmani: React.FC<{ sahne: Sahne; isaretler: Isaret[] }> = ({ sahne, isaretler }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sure = (sahne.son - sahne.bas) * fps;
  const ilerleme = frame / sure;
  const [o1, o2] = sahne.yakinlasma ?? [1.04, 1.12];
  const [k1, k2] = sahne.kayma ?? [0, 0];
  // her kesmede kısa bir "punch-in": 1.08 → 1 (ajans kurgusu hissi)
  const punch = interpolate(frame, [0, 9], [1.08, 1], { ...kenetle, easing: Easing.out(Easing.cubic) });
  const olcek = interpolate(ilerleme, [0, 1], [o1, o2], { easing: Easing.inOut(Easing.quad) }) * punch;
  const kayma = interpolate(ilerleme, [0, 1], [k1, k2]);
  const opaklik = interpolate(frame, [0, GECIS * fps, sure, sure + GECIS * fps], [0, 1, 1, 0], kenetle);

  return (
    <AbsoluteFill style={{ opacity: opaklik }}>
      {sahne.sigdir ? (
        <Img
          src={staticFile(sahne.dosya)}
          style={{ position: "absolute", width: "100%", height: "100%", objectFit: "cover", filter: "blur(40px) brightness(0.45)", transform: "scale(1.2)" }}
        />
      ) : null}
      <AbsoluteFill
        style={{
          transform: `translateY(${kayma}px) scale(${olcek})`,
          transformOrigin: sahne.odak ? `${sahne.odak[0]}% ${sahne.odak[1]}%` : "50% 50%",
        }}
      >
        {sahne.sigdir ? (
          <Img src={staticFile(sahne.dosya)} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        ) : sahne.video ? (
          <OffthreadVideo
            src={staticFile(sahne.video)}
            playbackRate={sahne.videoHizi ?? 1}
            muted
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <Img src={staticFile(sahne.dosya)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        )}
        {sahne.harita ? <HaritaIsaretleri isaretler={isaretler} sahneBas={sahne.bas} /> : null}
      </AbsoluteFill>
      {sahne.karartma ? <AbsoluteFill style={{ background: `rgba(11,20,36,${sahne.karartma})` }} /> : null}
    </AbsoluteFill>
  );
};

const HaritaIsaretleri: React.FC<{ isaretler: Isaret[]; sahneBas: number }> = ({ isaretler, sahneBas }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps + sahneBas;
  const merkez = isaretler.find((i) => i.merkez);

  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute" }}>
        {merkez &&
          isaretler
            .filter((i) => !i.merkez && !i.cizgisiz)
            .map((i) => {
              const uzunluk = Math.hypot(merkez.x - i.x, merkez.y - i.y);
              const cizim = interpolate(t, [i.bas + 0.1, i.bas + 0.8], [uzunluk, 0], {
                ...kenetle,
                easing: Easing.out(Easing.cubic),
              });
              return (
                <line
                  key={i.ad}
                  x1={i.x}
                  y1={i.y}
                  x2={merkez.x}
                  y2={merkez.y}
                  stroke={RENK.altin}
                  strokeWidth={5}
                  strokeLinecap="round"
                  strokeDasharray={uzunluk}
                  strokeDashoffset={cizim}
                  style={{ filter: "drop-shadow(0 0 6px rgba(144,118,64,0.9))" }}
                />
              );
            })}
      </svg>
      {isaretler.map((i) => {
        const giris = spring({ frame: Math.round((t - i.bas) * fps), fps, config: { damping: 12, stiffness: 180 } });
        const nabiz = 1 + 0.3 * Math.sin(t * 5);
        return (
          <div
            key={i.ad}
            style={{
              position: "absolute",
              left: i.x,
              top: i.y,
              // nokta tam (x, y) üzerine gelir; yazı sağa uzanır. Ok işaretinde ok ucu (x, y)'dedir.
              transform: `translate(${i.ok === "sag" ? "-100%" : i.ok === "sol" ? "0" : "-13px"}, -50%) scale(${giris})`,
              transformOrigin: i.ok === "sag" ? "right center" : "13px center",
              display: "flex",
              alignItems: "center",
              flexDirection: i.ok === "sag" ? "row-reverse" : "row",
              gap: 14,
            }}
          >
            {i.ok ? (
              <div style={{ color: RENK.altin, fontSize: 54, fontFamily: SANS, fontWeight: 800 }}>{i.ok === "sag" ? "→" : "←"}</div>
            ) : (
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  background: i.merkez ? RENK.kirmizi : RENK.altin,
                  boxShadow: `0 0 0 ${9 * nabiz}px ${i.merkez ? "rgba(179,38,30,0.35)" : "rgba(144,118,64,0.4)"}`,
                }}
              />
            )}
            <div
              style={{
                fontFamily: SANS,
                fontWeight: 800,
                fontSize: 34,
                letterSpacing: "0.12em",
                color: RENK.fildisi,
                background: "rgba(11,20,36,0.7)",
                padding: "4px 12px",
                whiteSpace: "nowrap",
              }}
            >
              {i.ad}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ---------- hareketli grafikler ----------

const kelimeGirisi = (frame: number, fps: number, sira: number) =>
  spring({ frame: frame - sira * 3, fps, config: { damping: 14, stiffness: 160 } });

const Hook: React.FC<{ satirlar: string[]; sure: number }> = ({ satirlar, sure }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cikis = interpolate(frame, [sure * fps - 6, sure * fps], [1, 0], kenetle);
  const flas = interpolate(frame, [0, 3, 8], [0.85, 0.5, 0], kenetle);
  let sira = 0;
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: cikis }}>
      <AbsoluteFill style={{ background: RENK.fildisi, opacity: flas }} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, marginTop: 120 }}>
        {satirlar.map((s, si) => (
          <div
            key={si}
            style={{
              fontFamily: SANS,
              fontWeight: 800,
              fontSize: si === satirlar.length - 1 ? 150 : 84,
              lineHeight: 1.02,
              letterSpacing: "-0.01em",
              textTransform: "uppercase",
              color: RENK.fildisi,
              textAlign: "center",
              textShadow: "0 6px 30px rgba(0,0,0,0.85)",
            }}
          >
            {s.split(" ").map((k, ki) => {
              const g = kelimeGirisi(frame, fps, sira++);
              const vurgu = k.startsWith("**");
              return (
                <span
                  key={ki}
                  style={{
                    display: "inline-block",
                    marginRight: "0.25em",
                    transform: `translateY(${(1 - g) * 80}px) scale(${0.7 + 0.3 * g})`,
                    opacity: g,
                    color: vurgu ? RENK.altin : undefined,
                  }}
                >
                  {k.replace(/\*\*/g, "")}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

const Kartlar: React.FC<{ kartlar: { ulke: string; unvan: string; bas: number }[]; grafikBas: number; sure: number }> = ({
  kartlar,
  grafikBas,
  sure,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cikis = interpolate(frame, [sure * fps - 6, sure * fps], [1, 0], kenetle);
  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: "0 70px", opacity: cikis }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 30, marginTop: -180 }}>
        {kartlar.map((k, i) => {
          const g = spring({ frame: frame - Math.round((k.bas - grafikBas) * fps), fps, config: { damping: 15, stiffness: 170 } });
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "stretch",
                transform: `translateX(${(1 - g) * (i % 2 ? 900 : -900)}px)`,
                opacity: g,
                boxShadow: "0 18px 50px rgba(0,0,0,0.55)",
              }}
            >
              <div style={{ width: 16, background: RENK.altin }} />
              <div style={{ flex: 1, background: "rgba(20,45,84,0.92)", padding: "26px 32px", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 58, color: RENK.fildisi, letterSpacing: "0.02em" }}>{k.ulke}</div>
                <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 32, color: RENK.altin, letterSpacing: "0.14em", textTransform: "uppercase" }}>
                  {k.unvan}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const Damga: React.FC<{ ust: string; alt: string; sure: number }> = ({ ust, alt, sure }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const g = spring({ frame: frame - 4, fps, config: { damping: 9, stiffness: 220, mass: 0.8 } });
  const cikis = interpolate(frame, [sure * fps - 6, sure * fps], [1, 0], kenetle);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: cikis }}>
      <div
        style={{
          marginTop: -260,
          transform: `rotate(-6deg) scale(${2.2 - 1.2 * g})`,
          opacity: Math.min(1, g * 1.4),
          border: `8px solid ${RENK.altin}`,
          outline: `3px solid ${RENK.altin}`,
          outlineOffset: 10,
          padding: "28px 40px",
          background: "rgba(11,20,36,0.78)",
          textAlign: "center",
        }}
      >
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 66, lineHeight: 1.05, color: RENK.fildisi, letterSpacing: "0.04em", whiteSpace: "pre-line" }}>{ust}</div>
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 38, marginTop: 14, color: RENK.altin, letterSpacing: "0.2em" }}>{alt}</div>
      </div>
    </AbsoluteFill>
  );
};

const Alinti: React.FC<{ metin: string; kimden: string; sure: number }> = ({ metin, kimden, sure }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const g = spring({ frame, fps, config: { damping: 16 } });
  const cizgi = interpolate(frame, [4, 18], [0, 1], { ...kenetle, easing: Easing.out(Easing.cubic) });
  const cikis = interpolate(frame, [sure * fps - 6, sure * fps], [1, 0], kenetle);
  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: "0 80px", opacity: cikis }}>
      <div style={{ marginTop: -220, display: "flex", flexDirection: "column", gap: 24, transform: `translateY(${(1 - g) * 50}px)`, opacity: g }}>
        <div style={{ fontFamily: SERIF, fontSize: 200, lineHeight: 0.6, color: RENK.altin }}>“</div>
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 92, lineHeight: 1.02, color: RENK.fildisi, textTransform: "uppercase", textShadow: "0 6px 30px rgba(0,0,0,0.8)" }}>
          <Vurgulu metin={metin} />
        </div>
        <div style={{ height: 6, width: `${cizgi * 60}%`, background: RENK.altin }} />
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 44, color: RENK.fildisi }}>{kimden}</div>
      </div>
    </AbsoluteFill>
  );
};

const Buyuk: React.FC<{ satirlar: string[]; sure: number }> = ({ satirlar, sure }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cikis = interpolate(frame, [sure * fps - 6, sure * fps], [1, 0], kenetle);
  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: "0 70px", opacity: cikis }}>
      <div style={{ marginTop: -200, display: "flex", flexDirection: "column", gap: 8 }}>
        {satirlar.map((s, i) => {
          const g = spring({ frame: frame - i * 6, fps, config: { damping: 15, stiffness: 150 } });
          return (
            <div key={i} style={{ overflow: "hidden" }}>
              <div
                style={{
                  fontFamily: SANS,
                  fontWeight: 800,
                  fontSize: 96,
                  lineHeight: 1.02,
                  textTransform: "uppercase",
                  color: RENK.fildisi,
                  transform: `translateY(${(1 - g) * 110}%)`,
                  textShadow: "0 6px 30px rgba(0,0,0,0.8)",
                }}
              >
                <Vurgulu metin={s} />
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const GrafikKatmani: React.FC<{ g: Grafik }> = ({ g }) => {
  const sure = g.son - g.bas;
  switch (g.tur) {
    case "hook":
      return <Hook satirlar={g.satirlar} sure={sure} />;
    case "kartlar":
      return <Kartlar kartlar={g.kartlar} grafikBas={g.bas} sure={sure} />;
    case "damga":
      return <Damga ust={g.ust} alt={g.alt} sure={sure} />;
    case "alinti":
      return <Alinti metin={g.metin} kimden={g.kimden} sure={sure} />;
    case "buyuk":
      return <Buyuk satirlar={g.satirlar} sure={sure} />;
  }
};

// ---------- kalıcı katmanlar ----------

// Şeffaf logonun iç yıldızı boş; koyu zeminde okunsun diye arkasına fildişi yıldız konur.
const YILDIZ =
  "M0,-1 L0.2929,-0.7071 L0.7071,-0.7071 L0.7071,-0.2929 L1,0 L0.7071,0.2929 L0.7071,0.7071 L0.2929,0.7071 L0,1 L-0.2929,0.7071 L-0.7071,0.7071 L-0.7071,0.2929 L-1,0 L-0.7071,-0.2929 L-0.7071,-0.7071 L-0.2929,-0.7071 Z";

const Logo: React.FC<{ boyut: number; style?: React.CSSProperties }> = ({ boyut, style }) => (
  <div style={{ position: "relative", width: boyut, height: boyut, ...style }}>
    <svg width={boyut} height={boyut} viewBox="-1 -1 2 2" style={{ position: "absolute", inset: 0 }}>
      <path d={YILDIZ} transform="scale(0.82)" fill={RENK.fildisi} />
    </svg>
    <Img src={staticFile("marka/logo_yildiz.png")} style={{ position: "absolute", inset: 0, width: boyut, height: boyut }} />
  </div>
);

const AltBaslik: React.FC<{ v: HaberVerisi }> = ({ v }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const g = spring({ frame, fps, config: { damping: 18 } });
  const etiketZemin = v.etiketRengi === "kirmizi" ? RENK.kirmizi : v.etiketRengi === "yesil" ? RENK.yesil : RENK.altin;
  return (
    <div style={{ position: "absolute", left: 64, right: 120, top: 1190, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ overflow: "hidden", alignSelf: "flex-start" }}>
        <div
          style={{
            background: etiketZemin,
            color: RENK.fildisi,
            fontFamily: SANS,
            fontWeight: 800,
            fontSize: 26,
            letterSpacing: "0.16em",
            padding: "8px 16px",
            transform: `translateX(${(1 - g) * -105}%)`,
          }}
        >
          {v.etiket}
        </div>
      </div>
      <div style={{ overflow: "hidden" }}>
        <div
          style={{
            fontFamily: SANS,
            fontWeight: 800,
            fontSize: 64,
            lineHeight: 1.06,
            color: RENK.fildisi,
            textShadow: "0 3px 18px rgba(0,0,0,0.6)",
            transform: `translateY(${(1 - g) * 105}%)`,
          }}
        >
          <Vurgulu metin={v.baslik} />
        </div>
      </div>
    </div>
  );
};

// Kelimeleri konuşma aralıklarına harf uzunluğuna göre dağıtır.
const kelimeZamanlari = (v: HaberVerisi) => {
  const kelimeler = v.metin.split(/\s+/).filter(Boolean);
  const agirlik = kelimeler.map((k) => k.length + 1);
  const toplamAgirlik = agirlik.reduce((a, b) => a + b, 0);
  const toplamKonusma = v.konusma.reduce((a, [b, s]) => a + (s - b), 0);
  const gercekZaman = (konusmaZamani: number) => {
    let kalan = konusmaZamani;
    for (const [b, s] of v.konusma) {
      if (kalan <= s - b) return b + kalan;
      kalan -= s - b;
    }
    return v.konusma[v.konusma.length - 1][1];
  };
  let birikim = 0;
  return kelimeler.map((k, i) => {
    const bas = gercekZaman((birikim / toplamAgirlik) * toplamKonusma) + v.sesGecikme;
    birikim += agirlik[i];
    const son = gercekZaman((birikim / toplamAgirlik) * toplamKonusma) + v.sesGecikme;
    return { k, bas, son };
  });
};

const Altyazi: React.FC<{ v: HaberVerisi }> = ({ v }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const zamanlar = React.useMemo(() => kelimeZamanlari(v), [v]);
  const gruplar = React.useMemo(() => {
    const sonuc: { k: string; bas: number; son: number }[][] = [];
    let grup: { k: string; bas: number; son: number }[] = [];
    for (const z of zamanlar) {
      grup.push(z);
      if (grup.length === 3 || /[.,:;]$/.test(z.k)) {
        sonuc.push(grup);
        grup = [];
      }
    }
    if (grup.length) sonuc.push(grup);
    return sonuc;
  }, [zamanlar]);

  const aktif = gruplar.find((g) => t >= g[0].bas && t < g[g.length - 1].son + 0.12);
  if (!aktif) return null;
  const pop = spring({ frame: Math.round((t - aktif[0].bas) * fps), fps, config: { damping: 12, stiffness: 260 } });

  return (
    <div
      style={{
        position: "absolute",
        left: 60,
        right: 60,
        top: 1440,
        textAlign: "center",
        fontFamily: SANS,
        fontWeight: 800,
        fontSize: 54,
        lineHeight: 1.15,
        textTransform: "uppercase",
        transform: `scale(${0.85 + 0.15 * pop})`,
        textShadow: "0 0 6px rgba(0,0,0,1), 0 4px 24px rgba(0,0,0,0.9)",
      }}
    >
      {aktif.map((z, i) => {
        const okunuyor = t >= z.bas && t < z.son + 0.05;
        return (
          <span
            key={i}
            style={{
              color: RENK.fildisi,
              background: okunuyor ? RENK.altin : "transparent",
              padding: "0 10px",
              marginRight: 6,
              borderRadius: 4,
            }}
          >
            {z.k}
          </span>
        );
      })}
    </div>
  );
};

// Hafif film greni ve ışık süpürmesi; resim görüntüsünü "çekim" hissine yaklaştırır.
const Doku: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "overlay", opacity: 0.22 }}>
      <svg width="1080" height="1920">
        <filter id="gren">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={frame % 12} />
        </filter>
        <rect width="1080" height="1920" filter="url(#gren)" />
      </svg>
    </AbsoluteFill>
  );
};

const IlerlemeCubugu: React.FC<{ toplam: number }> = ({ toplam }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 10, background: "rgba(243,236,220,0.15)" }}>
      <div style={{ height: "100%", width: `${(frame / (toplam * fps)) * 100}%`, background: RENK.altin }} />
    </div>
  );
};

const Kapanis: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const giris = spring({ frame, fps, config: { damping: 14 } });
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 42%, ${RENK.lacivert} 0%, ${RENK.gece} 72%)`,
        alignItems: "center",
        justifyContent: "center",
        gap: 40,
        opacity: interpolate(frame, [0, 6], [0, 1], kenetle),
      }}
    >
      <Logo boyut={380} style={{ transform: `scale(${0.7 + 0.3 * giris}) rotate(${(1 - giris) * -20}deg)` }} />
      <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 56, letterSpacing: "0.06em", color: RENK.fildisi }}>
        Follow <span style={{ color: RENK.altin }}>@ilmsanat</span>
      </div>
      <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 44, color: RENK.fildisi, opacity: 0.85 }}>
        Geopolitics, History &amp; the Art of the Orient
      </div>
    </AbsoluteFill>
  );
};

// ---------- ana kompozisyon ----------

export const HaberVideo: React.FC<HaberVerisi> = (v) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const toplam = haberSuresi(v);
  const icerikSonu = toplam - KAPANIS;
  const t = frame / fps;

  const ustOpaklik = interpolate(t, [icerikSonu - 0.25, icerikSonu], [1, 0], kenetle);
  const kesmeler = v.sahneler.slice(1).map((s) => s.bas);

  return (
    <AbsoluteFill style={{ background: RENK.gece }}>
      {v.sahneler.map((s, i) => (
        <Sequence key={i} from={Math.round(s.bas * fps)} durationInFrames={Math.round((s.son - s.bas + GECIS) * fps)}>
          <SahneKatmani sahne={s} isaretler={v.isaretler} />
        </Sequence>
      ))}

      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(11,20,36,0.55) 0%, rgba(11,20,36,0) 16%, rgba(11,20,36,0) 50%, rgba(11,20,36,0.85) 66%, rgba(11,20,36,0.96) 100%)",
        }}
      />
      <AbsoluteFill style={{ boxShadow: "inset 0 0 240px rgba(0,0,0,0.75)" }} />
      <Doku />

      <AbsoluteFill style={{ opacity: ustOpaklik }}>
        {v.grafikler.map((g, i) => (
          <Sequence key={i} from={Math.round(g.bas * fps)} durationInFrames={Math.round((g.son - g.bas) * fps)}>
            <GrafikKatmani g={g} />
          </Sequence>
        ))}
        <Sequence from={Math.round(v.baslikBas * fps)} durationInFrames={Math.round((icerikSonu - v.baslikBas) * fps)}>
          <AltBaslik v={v} />
        </Sequence>
        <Sequence durationInFrames={Math.round(icerikSonu * fps)}>
          <Altyazi v={v} />
          <Logo boyut={160} style={{ position: "absolute", top: 60, right: 52, filter: "drop-shadow(0 4px 14px rgba(0,0,0,0.6))" }} />
        </Sequence>
      </AbsoluteFill>
      <IlerlemeCubugu toplam={toplam} />

      <Sequence from={Math.round(icerikSonu * fps)}>
        <Kapanis />
      </Sequence>

      {/* ses: seslendirme + müzik + efektler */}
      <Sequence from={Math.round(v.sesGecikme * fps)}>
        <Audio src={staticFile(v.ses)} />
      </Sequence>
      <Audio
        src={staticFile(v.muzik)}
        volume={(f) => {
          const tt = f / fps;
          const giris = interpolate(tt, [0, 0.3], [0.6, 1], kenetle);
          const kapanis = interpolate(tt, [icerikSonu - 0.3, icerikSonu + 0.3], [1, 1.3], kenetle);
          const cikis = interpolate(tt, [toplam - 1.2, toplam], [1, 0], kenetle);
          return v.muzikSesi * giris * kapanis * cikis;
        }}
      />
      {v.darbe ? (
        <>
          <Audio src={staticFile(v.darbe)} volume={0.55} />
          {v.grafikler
            .filter((g) => g.tur === "damga")
            .map((g, i) => (
              <Sequence key={`d${i}`} from={Math.round((g.bas + 0.12) * fps)}>
                <Audio src={staticFile(v.darbe!)} volume={0.4} />
              </Sequence>
            ))}
          <Sequence from={Math.round(icerikSonu * fps)}>
            <Audio src={staticFile(v.darbe)} volume={0.45} />
          </Sequence>
        </>
      ) : null}
      {v.whoosh
        ? kesmeler.map((k, i) => (
            <Sequence key={`w${i}`} from={Math.max(0, Math.round((k - 0.25) * fps))}>
              <Audio src={staticFile(v.whoosh!)} volume={0.32} />
            </Sequence>
          ))
        : null}
    </AbsoluteFill>
  );
};
