// Bir haber videosunun tüm verisi. Otomasyon her paylaşım için bu biçimde bir JSON üretir.

export type Sahne = {
  dosya: string; // public/ altındaki yol (video yoksa ya da yedek olarak)
  video?: string; // Kling klibi
  videoHizi?: number;
  bas: number; // saniye
  son: number;
  yakinlasma?: [number, number]; // ölçek başı → sonu
  kayma?: [number, number]; // dikey kayma (px) başı → sonu
  harita?: boolean; // true ise işaretler bu sahnede çizilir
  karartma?: number; // 0–1, grafik okunsun diye ek karartma
  odak?: [number, number]; // yakınlaşmanın merkezi, % (tablonun bir bölgesine yaklaşmak için)
  sigdir?: boolean; // görseli kırpmadan sığdır, arkasını bulanık kopyasıyla doldur (tablolar)
};

export type Isaret = {
  ad: string;
  x: number; // 1080×1920 karedeki konum
  y: number;
  bas: number; // görünme saniyesi
  merkez?: boolean; // çizgiler bu noktaya çekilir
  ok?: "sag" | "sol"; // ekran dışındaki ülke için kenar oku
  cizgisiz?: boolean;
};

export type Grafik =
  | { tur: "hook"; bas: number; son: number; satirlar: string[] } // **altın** vurgu desteklenir
  | { tur: "kartlar"; bas: number; son: number; kartlar: { ulke: string; unvan: string; bas: number }[] }
  | { tur: "damga"; bas: number; son: number; ust: string; alt: string }
  | { tur: "alinti"; bas: number; son: number; metin: string; kimden: string }
  | { tur: "buyuk"; bas: number; son: number; satirlar: string[] };

export type HaberVerisi = {
  etiket: string;
  etiketRengi?: "altin" | "kirmizi" | "yesil";
  baslik: string; // **çift yıldız** içindeki kelimeler marka renginde
  baslikBas: number; // alt başlık bloğunun görünme saniyesi (hook'tan sonra)
  ses: string;
  sesGecikme: number;
  sesSuresi: number;
  konusma: [number, number][]; // seslendirmedeki konuşma aralıkları (sessizlik tespitinden)
  metin: string; // seslendirme metni, altyazı için
  muzik: string;
  muzikSesi: number;
  darbe?: string; // darbe efekti (hook ve damga)
  whoosh?: string; // geçiş efekti
  sahneler: Sahne[];
  isaretler: Isaret[];
  grafikler: Grafik[];
};
