# Niti Trader Apps Script backend

This directory is the source mirror for the Google Apps Script project.

- `Code.gs` — configuration, market-data integration, analysis, paper engine, logging, triggers, and diagnostics.
- `Core.js` — pure time, indicator, candidate, and paper-result helpers.
- `Bridge.gs` — authenticated server-to-server HMAC bridge used by the web application.
- `index.html` — legacy Apps Script-hosted fallback UI; the primary UI is the Niti Trader web app in the repository root.
- `appsscript.json` — Apps Script manifest. It intentionally keeps the web app owner-only; the production bridge is deployed separately with the required access setting.

All API credentials belong in Apps Script Project Properties. The blank values in `Code.gs` are safe defaults only and must not be replaced with real keys in Git.
