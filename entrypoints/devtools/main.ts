// DevTools entry point – registers the PDS Analyzer panel tab
browser.devtools.panels.create(
  'PDS Analyzer',
  'icon.png',
  'panel.html',
);
