#!/bin/bash
# Telegram bot token'ını ve senin sohbet kimliğini (chat id) .env dosyasına yazar, deneme mesajı gönderir.
# Bot sadece bu chat id'den gelen komutları dinleyecek.
set -euo pipefail

PROJE="$(cd "$(dirname "$0")/.." && pwd)"
ENV_DOSYASI="$PROJE/.env"

echo "1) BotFather'ın verdiği bot token'ını yapıştır (yazarken görünmez), Enter'a bas:"
read -rs TOKEN
echo

BEN=$(curl -s "https://api.telegram.org/bot$TOKEN/getMe")
BOT_ADI=$(printf '%s' "$BEN" | grep -o '"username" *: *"[^"]*"' | head -1 | sed 's/.*: *"\(.*\)"/\1/' || true)
if [ -z "$BOT_ADI" ]; then
  echo "Token geçersiz görünüyor. Telegram'ın cevabı: $BEN" >&2
  exit 1
fi

echo "2) Telegram'da @$BOT_ADI botunu aç, Başlat'a (Start) bas veya ona 'merhaba' yaz."
echo "   Yazdıktan sonra buraya dönüp Enter'a bas:"
read -r _

CHAT_ID=""
for _ in 1 2 3 4 5 6; do
  GUNCELLEME=$(curl -s "https://api.telegram.org/bot$TOKEN/getUpdates")
  CHAT_ID=$(printf '%s' "$GUNCELLEME" | grep -o '"chat" *: *{ *"id" *: *-\?[0-9]*' | tail -1 | grep -o -- '-\?[0-9]*$' || true)
  [ -n "$CHAT_ID" ] && break
  echo "   Mesaj henüz görünmüyor, 5 saniye sonra tekrar bakıyorum..."
  sleep 5
done
if [ -z "$CHAT_ID" ]; then
  echo "Bota gönderdiğin mesaj bulunamadı. Bota bir mesaj yazıp programı yeniden çalıştır." >&2
  exit 1
fi

touch "$ENV_DOSYASI"
grep -v '^TG_' "$ENV_DOSYASI" > "$ENV_DOSYASI.tmp" || true
{
  echo "TG_BOT_TOKEN=$TOKEN"
  echo "TG_BOT_ADI=$BOT_ADI"
  echo "TG_CHAT_ID=$CHAT_ID"
} >> "$ENV_DOSYASI.tmp"
mv "$ENV_DOSYASI.tmp" "$ENV_DOSYASI"
chmod 600 "$ENV_DOSYASI"

curl -s -X POST "https://api.telegram.org/bot$TOKEN/sendMessage" \
  --data-urlencode chat_id="$CHAT_ID" \
  --data-urlencode text="✅ İlm Sanat botu bağlandı. Taslaklar, onaylar ve hata bildirimleri buraya gelecek." > /dev/null

echo "Tamam: @$BOT_ADI kaydedildi ve sana bir deneme mesajı gönderildi."
