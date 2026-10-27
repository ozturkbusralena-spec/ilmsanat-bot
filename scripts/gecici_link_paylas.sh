#!/bin/bash
# Videoyu 1 saatlik geçici bir adrese (Litterbox) yükler ve Instagram'a o adresten paylaştırır.
# Kullanım: scripts/gecici_link_paylas.sh <video.mp4> <aciklama.txt>
set -euo pipefail
cd "$(dirname "$0")/.."
VIDEO="$1"; ACIKLAMA="$2"

echo "Video geçici adrese yükleniyor (1 saat sonra kendiliğinden silinir)…"
URL=""
for i in 1 2 3; do
  URL=$(curl -s -F "reqtype=fileupload" -F "time=1h" -F "fileToUpload=@$VIDEO" https://litterbox.catbox.moe/resources/internals/api.php || true)
  case "$URL" in https://*.mp4) break ;; esac
  echo "  Litterbox yanıt vermedi, 10 sn sonra tekrar ($i/3)…"; URL=""; sleep 10
done
if [ -z "$URL" ]; then
  echo "Geçici adrese yüklenemedi. Daha sonra tekrar dene." >&2
  exit 1
fi
echo "Adres: $URL"
PATH="$HOME/.local/node/bin:$PATH" node otomasyon/onay_paylas.mjs "$VIDEO" "$ACIKLAMA" --video-url "$URL" --onayli-instagram
