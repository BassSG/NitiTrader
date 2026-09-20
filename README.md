# Niti Trader

Niti Trader is a paper-trading analysis desk built for XAUUSD first, with optional BTCUSD, EURUSD, and AUDUSD support. It produces limit-style Entry / TP / SL plans, records every analysis in Google Sheets, and uses AI only after the deterministic market checks produce a valid candidate.

This repository contains the hosted web application and the Google Apps Script backend used by the application.

## Architecture

- `app/` — the Niti Trader web application and signed server-side bridge.
- `backend/gas/` — the Apps Script runtime for FMP data, deterministic analysis, OpenRouter review, Telegram notifications, and Google Sheets logging.
- `public/` — branding and installable-web-app assets.
- `.openai/hosting.json` — the managed Sites project binding; it contains no API credentials.

The browser never receives the FMP, OpenRouter, Telegram, or bridge secret. The web app calls `/api/rpc`; the server signs the request and forwards it to the Apps Script bridge with HMAC-SHA256.

## Analysis flow

1. FMP supplies quote and closed 5-minute bars.
2. The backend validates freshness, continuity, session state, and Thai-time conversion.
3. M15/H1/H4 context and indicators are calculated: Supply/Demand structure, EMA 20/50, ATR 14, RSI 14, and Stochastic 14/3/3.
4. A deterministic candidate must pass score, freshness, direction, and net R:R rules before AI is called.
5. Gemini 3.8 Flash reviews the existing candidate or returns `WAIT`; it cannot invent prices.
6. The backend rechecks the quote and R:R, then locks the paper plan and logs the result.

AI is not called when there is no valid candidate, the market is closed for automatic analysis, data is stale, or the daily AI budget guard blocks the request.

FMP source time is handled per asset: BTCUSD intraday date fields use the DST-aware `America/New_York` zone observed from its quote alignment, while XAUUSD and FX use the configured FMP source timezone. Quote timestamps remain epoch-based.

## Local web checks

Requirements: Node.js `>=22.13.0`.

```bash
npm ci
npm run test:core
npm run lint
npm run typecheck
npm run build
```

For local server configuration, copy `.env.example` to `.env` and fill in the bridge values locally. Never commit `.env`.

## Runtime configuration

### Web hosting environment

Set these as server-side environment values in the hosting provider:

- `GAS_BRIDGE_URL`
- `GAS_BRIDGE_SECRET`

### Apps Script Project Properties

Set these in Apps Script Project Settings → Script Properties:

- `FMP_API_KEY`
- `OPENROUTER_API_KEY`
- `TELEGRAM_BOT_TOKEN` (optional)
- `TELEGRAM_CHAT_ID` (optional)
- `MODEL` (defaults to `google/gemini-3.8-flash`)
- `FMP_TIMEZONE` and `FMP_TIMEZONE_CONFIRMED`

The real values are intentionally excluded from this repository. Keep the repository private when possible and enable secret scanning/push protection.

## Apps Script deployment

The backend files under `backend/gas/` are source files for the Apps Script project. Deploy the web app from the Apps Script editor or with Clasp using a local, untracked `.clasp.json`. Do not put the script ID, deployment URL, API keys, or OAuth credentials in committed examples unless they are placeholders.

The production application is paper trading only. It does not send broker orders.

## Safety notes

- This project is an analysis and paper-testing tool, not financial advice.
- A `WAIT` result is valid and is preferable to forcing a trade.
- Do not expose API keys in client-side JavaScript, public issues, commits, screenshots, or logs.
- Rotate any credential that has been exposed and update the secure runtime property only.
