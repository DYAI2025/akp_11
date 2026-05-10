# AKP 11 Prompt Browser

Dieses Repository enthält eine Railway-fähige Node.js-Web-App, die die Dateien aus `all-prompts/` als durchsuchbaren Prompt-Katalog bereitstellt.

## Funktionen

- Generiert einen sauberen `index.json` ohne macOS-Metadaten wie `__MACOSX`, `.DS_Store` oder AppleDouble-Dateien.
- Stellt eine responsive Frontend-Oberfläche mit Suche, Kategorie-Filter, Prompt-Dialog, Copy-Buttons und Reader-Einstellungen bereit.
- Rendert Prompt-Inhalte ausschließlich über `textContent`, validiert Indexdaten im Browser und blockiert unsichere Prompt-Routen.
- Sendet strenge Security-Header inklusive CSP, Trusted-Types-Anforderung, Frame-Schutz und restriktiver Permissions-Policy.
- Bietet Deployment-Endpunkte für Railway:
  - `/` Frontend
  - `/index.json` generierter Prompt-Index
  - `/prompts/<path>` Rohdatei-Zugriff auf indexierte Text-Prompts
  - `/health` Healthcheck mit Index-Zählung
- Enthält Unit-, Frontend-, Server- und Smoke-Tests für stabile Deployments.
- Binärdateien werden bewusst nicht indexiert oder als Prompt ausgeliefert; der Browser ist für Text-/Markdown-Prompts ausgelegt.

## Lokale Entwicklung

```bash
npm ci
npm run build
npm test
npm run smoke
npm start
```

Die App lauscht standardmäßig auf Port `3000`. Railway setzt automatisch `PORT`; der Server bindet deshalb auf `0.0.0.0` und liest `process.env.PORT`.

## Railway Deployment

Railway kann das Repository direkt mit Nixpacks deployen. Die relevante Konfiguration liegt in `railway.json`:

- Build: `npm ci && npm run build`
- Start: `npm start`
- Healthcheck: `/health`

Vor jedem Deployment sollte die CI erfolgreich sein, da sie den Index neu generiert, Tests ausführt und den Deployment-Smoke-Check startet.
