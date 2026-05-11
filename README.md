# AKP 11 Prompt Browser

Dieses Repository enthält eine Railway-fähige Node.js-Web-App, die die Dateien aus `all-prompts/` als durchsuchbaren Prompt-Katalog bereitstellt.

## Funktionen

- Generiert einen sauberen `index.json` und `catalog.md` ohne macOS-Metadaten wie `__MACOSX`, `.DS_Store`, AppleDouble-Dateien oder nicht unterstützte Binärdateien.
- Stellt eine responsive Frontend-Oberfläche mit Suche, Kategorie-Filter und Prompt-Dialog bereit.
- Rendert Prompt-Inhalte ausschließlich über `textContent`, setzt strikte Sicherheitsheader/CSP und führt Prompt-Inhalte nicht als HTML aus.
- Bietet Deployment-Endpunkte für Railway:
  - `/` Frontend
  - `/index.json` generierter Prompt-Index
  - `/catalog.md` generierter Markdown-Katalog ohne Binärdiff
  - `/prompts/<path>` Rohdatei-Zugriff auf indexierte Prompts
  - `/health` Healthcheck mit Index-Zählung
- Enthält Copy-/Reader-Komfortfunktionen wie Rohtext-Link, Kopieren, Lesezeit, Schriftgröße und Zeilenumbruch.
- Enthält Unit-, Frontend-, Server- und Smoke-Tests sowie CI-Gates für stabile Deployments und frisch generierte Artefakte.

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

Vor jedem Deployment sollte die CI erfolgreich sein, da sie den JSON-Index und den textbasierten Markdown-Katalog neu generiert, prüft, dass beide Artefakte committed sind, Tests ausführt und den Deployment-Smoke-Check startet.
