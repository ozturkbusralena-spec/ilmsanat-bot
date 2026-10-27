#!/bin/bash
# İlm Sanat botunu Mac'te arka plan servisi olarak kurar: Mac açılınca kendiliğinden başlar,
# çökerse yeniden başlar, çalışırken Mac'in uykuya geçmesini engeller (caffeinate -i).
# Kaldırmak için: scripts/bot_kur.sh kaldir
set -euo pipefail
cd "$(dirname "$0")/.."
PROJE="$PWD"
ETIKET="com.ilmsanat.bot"
PLIST="$HOME/Library/LaunchAgents/$ETIKET.plist"
ALAN="gui/$(id -u)"

launchctl bootout "$ALAN/$ETIKET" 2>/dev/null || true
# terminalde elle çalışan bir bot varsa durdur (aynı anda iki bot olmasın)
if [ -f data/bot.pid ]; then kill "$(cat data/bot.pid)" 2>/dev/null || true; rm -f data/bot.pid; fi

if [ "${1:-}" = "kaldir" ]; then
  rm -f "$PLIST"
  echo "Bot servisi kaldırıldı."
  exit 0
fi

mkdir -p "$HOME/Library/LaunchAgents" data
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$ETIKET</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/caffeinate</string>
    <string>-i</string>
    <string>$HOME/.local/node/bin/node</string>
    <string>$PROJE/otomasyon/bot.mjs</string>
  </array>
  <key>WorkingDirectory</key><string>$PROJE</string>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>$HOME/.local/node/bin:/usr/bin:/bin:/usr/sbin:/sbin</string></dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>30</integer>
  <key>StandardOutPath</key><string>$PROJE/data/bot.out.log</string>
  <key>StandardErrorPath</key><string>$PROJE/data/bot.err.log</string>
</dict>
</plist>
EOF
plutil -lint "$PLIST" >/dev/null
launchctl bootstrap "$ALAN" "$PLIST"
sleep 5
if launchctl print "$ALAN/$ETIKET" | grep -q "state = running"; then
  echo "Tamam: İlm Sanat botu arka planda çalışıyor. Telegram'a 'bot çalışıyor' mesajı gelmiş olmalı."
else
  echo "Bot başlamadı. Ayrıntı: $PROJE/data/bot.err.log" >&2
  tail -5 data/bot.err.log >&2 || true
  exit 1
fi
