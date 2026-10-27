#!/bin/bash
# Instagram yetki kodunu 60 günlük erişim token'ına çevirir ve .env dosyasına yazar.
# Gizli değerler ekrana yazdırılmaz.
set -euo pipefail

PROJE="$(cd "$(dirname "$0")/.." && pwd)"
ENV_DOSYASI="$PROJE/.env"
APP_ID="876472492154670"
REDIRECT_URI="https://localhost/"

echo "1) Chrome'daki adres çubuğunda https://localhost/?code=... ile başlayan adresin TAMAMINI kopyalayıp buraya yapıştır, Enter'a bas:"
read -r ADRES
KOD="${ADRES#*code=}"
KOD="${KOD%%#*}"
KOD="${KOD%%&*}"
if [ -z "$KOD" ] || [ "$KOD" = "$ADRES" ]; then
  echo "Adreste code= bulunamadı." >&2
  exit 1
fi

echo "2) Meta'daki 'Instagram-App-Geheimcode' değerini yapıştır (yazarken görünmez), Enter'a bas:"
read -rs SECRET
echo

KISA_YANIT=$(curl -s -X POST https://api.instagram.com/oauth/access_token \
  -F client_id="$APP_ID" \
  -F client_secret="$SECRET" \
  -F grant_type=authorization_code \
  -F redirect_uri="$REDIRECT_URI" \
  -F code="$KOD")
KISA_TOKEN=$(printf '%s' "$KISA_YANIT" | grep -o '"access_token" *: *"[^"]*"' | head -1 | sed 's/.*: *"\(.*\)"/\1/' || true)
if [ -z "$KISA_TOKEN" ]; then
  echo "Kod token'a çevrilemedi. Instagram'ın cevabı:" >&2
  printf '%s\n' "$KISA_YANIT" | sed 's/"access_token" *: *"[^"]*"/"access_token":"***"/' >&2
  exit 1
fi

UZUN_YANIT=$(curl -s -G https://graph.instagram.com/access_token \
  --data-urlencode grant_type=ig_exchange_token \
  --data-urlencode client_secret="$SECRET" \
  --data-urlencode access_token="$KISA_TOKEN")
UZUN_TOKEN=$(printf '%s' "$UZUN_YANIT" | grep -o '"access_token" *: *"[^"]*"' | head -1 | sed 's/.*: *"\(.*\)"/\1/' || true)
if [ -z "$UZUN_TOKEN" ]; then
  echo "Uzun süreli token alınamadı. Instagram'ın cevabı:" >&2
  printf '%s\n' "$UZUN_YANIT" >&2
  exit 1
fi

# .env içindeki eski Instagram satırlarını sil, yenilerini ekle
touch "$ENV_DOSYASI"
grep -v '^IG_' "$ENV_DOSYASI" > "$ENV_DOSYASI.tmp" || true
{
  echo "IG_APP_ID=$APP_ID"
  echo "IG_APP_SECRET=$SECRET"
  echo "IG_USER_ID=17841408771656111"
  echo "IG_ACCESS_TOKEN=$UZUN_TOKEN"
  echo "IG_TOKEN_TARIHI=$(date +%Y-%m-%d)"
} >> "$ENV_DOSYASI.tmp"
mv "$ENV_DOSYASI.tmp" "$ENV_DOSYASI"
chmod 600 "$ENV_DOSYASI"

KULLANICI=$(curl -s -G "https://graph.instagram.com/me" \
  --data-urlencode fields=username \
  --data-urlencode access_token="$UZUN_TOKEN" | grep -o '"username" *: *"[^"]*"' | sed 's/.*: *"\(.*\)"/\1/' || true)

echo "Tamam: token .env dosyasına kaydedildi (60 gün geçerli). Bağlı hesap: ${KULLANICI:-bilinmiyor}"
