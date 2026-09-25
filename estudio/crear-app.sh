#!/bin/bash
# Crea ~/Desktop/Estudio.app (doble clic → abre el Estudio) con el logo «M» como icono.
set -e
cd "$(dirname "$0")/.."
APP="$HOME/Desktop/Estudio.app"
rm -rf "$APP"
osacompile -o "$APP" -e "do shell script \"export PATH=/usr/local/bin:/opt/homebrew/bin:\$PATH; '$(pwd)/estudio/abrir.sh' > /dev/null 2>&1\""
T=$(mktemp -d); mkdir "$T/icono.iconset"
for s in 16 32 128 256 512; do
  sips -z $s $s public/favicon-512.png --out "$T/icono.iconset/icon_${s}x${s}.png" > /dev/null
  d=$((s * 2)); [ $d -le 512 ] && sips -z $d $d public/favicon-512.png --out "$T/icono.iconset/icon_${s}x${s}@2x.png" > /dev/null
done
cp public/favicon-512.png "$T/icono.iconset/icon_512x512@2x.png"
iconutil -c icns "$T/icono.iconset" -o "$APP/Contents/Resources/applet.icns"
rm -rf "$T"
codesign --force --deep -s - "$APP" 2>/dev/null || true   # vuelve a firmar tras cambiar el icono
touch "$APP"
echo "✔ $APP"
