#!/bin/bash
# Projeyi yeni bir bilgisayarda (macOS veya Linux) çalışır hale getirir:
# Node.js 22'yi ~/.local/node altına kurar (yönetici şifresi gerekmez), paketleri yükler.
set -euo pipefail
cd "$(dirname "$0")/.."
SURUM="v22.12.0"

case "$(uname -s)-$(uname -m)" in
  Darwin-arm64) PAKET="node-$SURUM-darwin-arm64" ;;
  Darwin-x86_64) PAKET="node-$SURUM-darwin-x64" ;;
  Linux-x86_64) PAKET="node-$SURUM-linux-x64" ;;
  Linux-aarch64) PAKET="node-$SURUM-linux-arm64" ;;
  *) echo "Bu sistem desteklenmiyor: $(uname -s) $(uname -m)" >&2; exit 1 ;;
esac

if [ ! -x "$HOME/.local/node/bin/node" ]; then
  echo "Node.js $SURUM indiriliyor (nodejs.org)…"
  mkdir -p "$HOME/.local"
  GECICI="$(mktemp -d)"
  curl -fsSL -o "$GECICI/node.tar.gz" "https://nodejs.org/dist/$SURUM/$PAKET.tar.gz"
  BEKLENEN=$(curl -fsSL "https://nodejs.org/dist/$SURUM/SHASUMS256.txt" | grep " $PAKET.tar.gz$" | awk '{print $1}')
  GERCEK=$(shasum -a 256 "$GECICI/node.tar.gz" 2>/dev/null | awk '{print $1}' || sha256sum "$GECICI/node.tar.gz" | awk '{print $1}')
  [ "$BEKLENEN" = "$GERCEK" ] || { echo "Node.js dosyası doğrulanamadı" >&2; exit 1; }
  tar -xzf "$GECICI/node.tar.gz" -C "$GECICI"
  rm -rf "$HOME/.local/node"
  mv "$GECICI/$PAKET" "$HOME/.local/node"
  rm -rf "$GECICI"
fi
export PATH="$HOME/.local/node/bin:$PATH"
echo "Node.js: $(node -v)"

echo "Paketler yükleniyor…"
npm ci --no-audit --no-fund
npm ci --no-audit --no-fund --prefix video
(cd video && npx remotion browser ensure)

[ -f .env ] && chmod 600 .env || echo "⚠️ .env bulunamadı — gizli anahtarlar olmadan API'ler çalışmaz."
echo "Tamam. Claude'da bu klasörü aç ve ilk mesaj olarak: DEVIR_NOTU.md dosyasını oku ve oradan devam edelim."
