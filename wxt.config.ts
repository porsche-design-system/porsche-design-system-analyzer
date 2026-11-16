import { defineConfig } from 'wxt';
import pkg from './package.json' with { type: 'json' };

const version = pkg.version;

export default defineConfig({
  // Open porsche.com when starting dev server
  webExt: {
    startUrls: ['https://www.porsche.com/germany/'],
    chromiumProfile: '.wxt/chrome-data',
    keepProfileChanges: true,
  },
  manifest: ({ mode }) => ({
    name: mode === 'development' ? `PDS Analyzer [DEV]` : `Porsche Design System Analyzer`,
    description: '__MSG_extDescription__',
    default_locale: 'en',
    version,

    permissions: ['scripting'],
    host_permissions: ['<all_urls>'],
    icons: {
      16: 'icon.png',
      32: 'icon.png',
      48: 'icon.png',
      128: 'icon.png',
    },
    web_accessible_resources: [
      {
        resources: ['*.woff2'],
        matches: ['<all_urls>'],
      },
    ],
  }),
});
