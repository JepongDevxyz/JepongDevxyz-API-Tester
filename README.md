# JepongDevxyz API Tester

A mobile-friendly AgentRouter.org API tester with three connection modes:

- **Auto** — tries direct browser access first, then falls back to the same-origin Vercel proxy only on browser transport/CORS failure.
- **Direct Browser** — sends requests from the browser directly to `https://agentrouter.org`.
- **Vercel Proxy** — sends requests through `/api/agentrouter` so normal browser CORS does not block the response.

Supported test surfaces:

- `GET /v1/models`
- `POST /v1/chat/completions` (OpenAI-compatible)
- `POST /v1/messages` (Anthropic-compatible)
- Multiple `sk-...` keys, custom model/prompt, Bearer or `x-api-key` auth, latency, raw JSON, copyable results, and provider/browser error classification.

## Security

The proxy is **not** a provider-restriction bypass. It only fixes browser CORS by making the upstream request server-side. If AgentRouter returns `unauthorized client detected`, the UI reports that result and does not spoof an allowed client.

Keys are not stored in `localStorage`, source code, or server environment variables. In proxy mode the key is sent to your own Vercel function for the current request and is not included in the proxy response.

Do not put a permanent API key into public HTML or commit it to GitHub.

## Deploy to Vercel

1. Import `JepongDevxyz/JepongDevxyz-API-Tester` into Vercel.
2. Framework preset: **Other**.
3. No environment variables are required.
4. Deploy.
5. Open the deployment and use **Auto** or **Vercel Proxy** mode.

## Local verification

Requires Node.js 20+:

```bash
npm test
npm run verify
```
