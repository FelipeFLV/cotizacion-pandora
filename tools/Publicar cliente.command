#!/bin/zsh
cd "$(dirname "$0")/.." || exit 1
FILE="$1"
if [[ -z "$FILE" ]]; then
  FILE=$(osascript -e 'POSIX path of (choose file with prompt "Elige el paquete del cliente" default location (path to downloads folder))') || exit 1
fi
node tools/publicar.mjs "$FILE" --open
STATUS=$?
echo
echo "Pulsa una tecla para cerrar..."
read -k 1
exit $STATUS
