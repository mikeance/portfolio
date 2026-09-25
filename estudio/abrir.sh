#!/bin/bash
# Abre el Estudio: arranca el servidor (o lo reinicia si su código ha cambiado) y abre el navegador.
cd "$(dirname "$0")/.." || exit 1
NODE=$(command -v node || echo /usr/local/bin/node); [ -x "$NODE" ] || NODE=/opt/homebrew/bin/node
V=$(stat -f %m estudio/server.mjs)
R=$(curl -s --max-time 1 http://127.0.0.1:4455/api/ping)
case "$R" in
  *"\"v\":$V"*) ;;
  *)
    pkill -f "estudio/server.mjs" 2>/dev/null; sleep 0.3
    nohup "$NODE" estudio/server.mjs > /tmp/estudio.log 2>&1 &
    for i in $(seq 1 30); do sleep 0.3; curl -s -o /dev/null --max-time 1 http://127.0.0.1:4455/api/ping && break; done ;;
esac
open "http://localhost:4455/"
