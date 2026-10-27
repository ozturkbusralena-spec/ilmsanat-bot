#!/bin/bash
# TikTok Sandbox uygulaması için erişim + yenileme token'ı alır ve .env dosyasına yazar.
# Gizli değerler ekrana yazdırılmaz.
set -euo pipefail

PROJE="$(cd "$(dirname "$0")/.." && pwd)"
ENV_DOSYASI="$PROJE/.env"
REDIRECT_URI="http://localhost:8765/callback/"
SCOPE="user.info.basic,video.upload"

urlencode() { local LC_ALL=C s="$1" i c o=""; for ((i=0; i<${#s}; i++)); do c="${s:i:1}"; case "$c" in [a-zA-Z0-9.~_-]) o+="$c";; *) o+=$(printf '%%%02X' "'$c");; esac; done; printf '%s' "$o"; }
urldecode() { local s="${1//+/ }"; printf '%b' "${s//%/\\x}"; }
json_al() { printf '%s' "$1" | grep -o "\"$2\" *: *\"[^\"]*\"" | head -1 | sed 's/.*: *"\(.*\)"/\1/' || true; }

echo "1) TikTok Sandbox sayfasındaki 'Client key' değerini yapıştır, Enter'a bas:"
read -r CLIENT_KEY
echo "2) 'Client secret' değerini yapıştır (yazarken görünmez), Enter'a bas:"
read -rs CLIENT_SECRET
echo

# TikTok masaüstü akışı PKCE ister: code_challenge = SHA256(verifier), hex
VERIFIER=$(openssl rand -hex 32)
CHALLENGE=$(printf '%s' "$VERIFIER" | openssl dgst -sha256 -hex | sed 's/^.*= *//')
STATE=$(openssl rand -hex 8)

AUTH_URL="https://www.tiktok.com/v2/auth/authorize/?client_key=$(urlencode "$CLIENT_KEY")&scope=$(urlencode "$SCOPE")&response_type=code&redirect_uri=$(urlencode "$REDIRECT_URI")&state=$STATE&code_challenge=$CHALLENGE&code_challenge_method=S256"

echo "3) Şimdi Chrome'da TikTok izin sayfası açılıyor. Giriş yap ve izin ver."
echo "   Sonra sayfa 'bu siteye ulaşılamıyor' diyecek; adres çubuğundaki adresin TAMAMINI kopyalayıp buraya yapıştır:"
open -a "Google Chrome" "$AUTH_URL" 2>/dev/null || open "$AUTH_URL"
read -r ADRES
KOD="${ADRES#*code=}"
KOD="${KOD%%&*}"
KOD="${KOD%%#*}"
if [ -z "$KOD" ] || [ "$KOD" = "$ADRES" ]; then
  echo "Adreste code= bulunamadı." >&2
  exit 1
fi
KOD=$(urldecode "$KOD")

YANIT=$(curl -s -X POST https://open.tiktokapis.com/v2/oauth/token/ \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode client_key="$CLIENT_KEY" \
  --data-urlencode client_secret="$CLIENT_SECRET" \
  --data-urlencode code="$KOD" \
  --data-urlencode grant_type=authorization_code \
  --data-urlencode redirect_uri="$REDIRECT_URI" \
  --data-urlencode code_verifier="$VERIFIER")
ACCESS=$(json_al "$YANIT" access_token)
REFRESH=$(json_al "$YANIT" refresh_token)
OPEN_ID=$(json_al "$YANIT" open_id)
if [ -z "$ACCESS" ] || [ -z "$REFRESH" ]; then
  echo "Token alınamadı. TikTok'un cevabı:" >&2
  printf '%s\n' "$YANIT" | sed -E 's/"(access_token|refresh_token)" *: *"[^"]*"/"\1":"***"/g' >&2
  exit 1
fi

touch "$ENV_DOSYASI"
grep -v '^TT_' "$ENV_DOSYASI" > "$ENV_DOSYASI.tmp" || true
{
  echo "TT_CLIENT_KEY=$CLIENT_KEY"
  echo "TT_CLIENT_SECRET=$CLIENT_SECRET"
  echo "TT_OPEN_ID=$OPEN_ID"
  echo "TT_ACCESS_TOKEN=$ACCESS"
  echo "TT_REFRESH_TOKEN=$REFRESH"
  echo "TT_TOKEN_TARIHI=$(date +%Y-%m-%d)"
} >> "$ENV_DOSYASI.tmp"
mv "$ENV_DOSYASI.tmp" "$ENV_DOSYASI"
chmod 600 "$ENV_DOSYASI"

AD=$(json_al "$(curl -s "https://open.tiktokapis.com/v2/user/info/?fields=display_name" -H "Authorization: Bearer $ACCESS")" display_name)
echo "Tamam: TikTok token'ları .env dosyasına kaydedildi (yenileme anahtarı 1 yıl geçerli). Bağlı hesap: ${AD:-bilinmiyor}"
