# Porsche Design System Analyzer

Chrome DevTools Extension zur Analyse von Websites auf Porsche Design System Compliance. Identifiziert UI-Komponenten und prüft die korrekte Verwendung des Design Systems.

## Download & Installation

**[⬇ Extension herunterladen](https://github.com/porsche-design-system/porsche-design-system-analyzer/raw/main/porsche-design-system-analyzer-chrome.zip)**

### Chrome installieren

1. ZIP-Datei herunterladen und entpacken
2. Chrome öffnen → `chrome://extensions`
3. **Entwicklermodus** oben rechts aktivieren
4. **"Entpackte Erweiterung laden"** klicken → den entpackten Ordner auswählen

### Benutzen

1. Rechtsklick auf eine Website → **"Untersuchen"** (oder `F12`)
2. In den DevTools den Tab **"PDS Analyzer"** auswählen
3. **"Seite analysieren"** klicken

---

## Development

```bash
npm install
npm run dev
```

Öffnet Chrome mit der Extension und navigiert automatisch zu porsche.com.

## Build

```bash
npm run build    # Extension bauen
npm run zip      # ZIP für Chrome Web Store erstellen
```

Nach dem Build die ZIP im Root aktualisieren:

```bash
cp .output/porsche-design-system-analyzer-*-chrome.zip ./porsche-design-system-analyzer-chrome.zip
```

## Technologie

- [WXT](https://wxt.dev/) — Browser Extension Framework
- TypeScript
- Chrome DevTools Panel
