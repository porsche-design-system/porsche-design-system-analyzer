# Porsche Design System Analyzer

Chrome DevTools Extension for analyzing websites for Porsche Design System compliance. Identifies UI components and checks correct usage of the Design System.

## Download & Installation

**[⬇ Download Extension](https://github.com/porsche-design-system/porsche-design-system-analyzer/raw/main/porsche-design-system-analyzer-v2.1.0-chrome.zip)**

### Install in Chrome

1. Download and unzip the ZIP file
2. Open Chrome → `chrome://extensions`
3. Enable **Developer mode** (top right)
4. Click **"Load unpacked"** → select the unzipped folder

### Usage

1. Right-click on a website → **"Inspect"** (or `F12`)
2. Select the **"PDS Analyzer"** tab in DevTools
3. Click **"Seite analysieren"**

---

## Development

```bash
npm install
npm run dev
```

Opens Chrome with the extension and automatically navigates to porsche.com.

## Build

```bash
npm run build    # Build the extension
npm run zip      # Create ZIP for Chrome Web Store
```

After building, update the ZIP in the repo root:

```bash
cp .output/porsche-design-system-analyzer-*-chrome.zip ./porsche-design-system-analyzer-chrome.zip
```

## Technology

- [WXT](https://wxt.dev/) — Browser Extension Framework
- TypeScript
- Chrome DevTools Panel
