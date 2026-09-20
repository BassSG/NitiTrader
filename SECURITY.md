# Security policy

## Secret handling

Never commit API keys, bot tokens, HMAC secrets, OAuth tokens, or private deployment values. Use:

- Apps Script Project Properties for FMP, OpenRouter, and Telegram credentials.
- Server-side hosting environment variables for `GAS_BRIDGE_URL` and `GAS_BRIDGE_SECRET`.
- Local `.env` files only for development; `.env*` is ignored by Git.

If a secret is exposed, revoke or rotate it at the provider immediately, then update the secure runtime configuration. Removing the file from the latest commit is not enough because Git history may retain it.
