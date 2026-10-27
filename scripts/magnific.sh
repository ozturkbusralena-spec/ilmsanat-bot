#!/bin/bash
# Magnific API'ye bir iş gönderir, bitene kadar bekler ve sonucu indirir.
# Kullanım: scripts/magnific.sh <uç-nokta> <istek.json> <çıktı-dosyası> [durum-uç-noktası]
#   ör.   scripts/magnific.sh /v1/ai/text-to-image/seedream-v4-5 istek.json gorsel.jpg
# Bazı modellerde durum adresi farklıdır (Kling 2.6 Pro: gönderim .../kling-v2-6-pro, durum .../kling-v2-6).
set -euo pipefail

PROJE="$(cd "$(dirname "$0")/.." && pwd)"
UC="$1"; ISTEK="$2"; CIKTI="$3"
case "$UC" in
  */kling-v2-6-pro) VARSAYILAN_DURUM="${UC%-pro}" ;;
  *) VARSAYILAN_DURUM="$UC" ;;
esac
DURUM_UC="${4:-$VARSAYILAN_DURUM}"
API="https://api.magnific.com"
KEY=$(grep '^MAGNIFIC_API_KEY=' "$PROJE/.env" | cut -d= -f2-)

YANIT=$(curl -s -X POST "$API$UC" -H "x-magnific-api-key: $KEY" -H "Content-Type: application/json" --data @"$ISTEK")
TASK=$(printf '%s' "$YANIT" | grep -o '"task_id" *: *"[^"]*"' | head -1 | sed 's/.*"\([^"]*\)"$/\1/' || true)
if [ -z "$TASK" ]; then
  echo "İş gönderilemedi: $YANIT" >&2
  exit 1
fi
echo "iş: $TASK ($UC)"

for i in $(seq 1 120); do
  sleep 5
  DURUM=$(curl -s "$API$DURUM_UC/$TASK" -H "x-magnific-api-key: $KEY")
  S=$(printf '%s' "$DURUM" | grep -o '"status" *: *"[A-Z_]*"' | head -1 | sed 's/.*"\([A-Z_]*\)"$/\1/' || true)
  if [ -z "$S" ]; then
    echo "Durum okunamadı ($API$DURUM_UC/$TASK): $DURUM" >&2
    exit 1
  fi
  case "$S" in
    COMPLETED)
      URL=$(printf '%s' "$DURUM" | grep -o '"generated" *: *\[ *"[^"]*"' | sed 's/.*"\(http[^"]*\)"$/\1/' || true)
      [ -z "$URL" ] && { echo "Tamamlandı ama dosya adresi yok: $DURUM" >&2; exit 1; }
      curl -sL -o "$CIKTI" "$URL"
      echo "tamam: $CIKTI"
      exit 0 ;;
    FAILED)
      echo "Magnific işi başarısız: $DURUM" >&2
      exit 1 ;;
  esac
done
echo "Zaman aşımı (10 dk): $TASK" >&2
exit 1
