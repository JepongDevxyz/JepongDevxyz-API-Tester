# JepongDevxyz API Tester

A mobile-friendly **Universal AI API Tester** based on the approved single-card UI. It can test one API key or multiple keys, load models, run sequential key checks, and send a real model smoke test.

## Connection modes

- **Auto** — tries Direct Browser first, then falls back to the same-origin Vercel proxy only for browser/CORS/network transport failures.
- **Direct Browser** — sends the request straight from the browser. This works for any public HTTPS provider that allows browser CORS.
- **Vercel Proxy** — sends the request through `/api/proxy` so ordinary browser CORS does not block verified provider presets.

The proxy does **not** spoof supported clients or bypass provider-side client restrictions.

## Verified endpoint presets

The dropdown library is dated **2026-09-13** and includes documented endpoints for major providers such as AgentRouter, OpenAI, Anthropic, Google Gemini, OpenRouter, Groq, DeepSeek, Mistral AI, Together AI, Cohere, xAI, Perplexity, Fireworks AI, Cerebras Inference, and NVIDIA API Catalog / NIM.

Available preset formats include:

- OpenAI Chat Completions
- OpenAI Responses
- Anthropic Messages
- Google Gemini `generateContent`
- Cohere Chat v2
- Provider model-list endpoints when documented

Presets only provide request shapes and documented endpoint URLs. A successful request still depends on the user's own valid key, model access, quota, provider availability, and provider policies.

## Custom / own API provider

Turn **Verified Endpoint Library** OFF to use a custom provider. The UI lets the user set:

- Base URL or full HTTPS endpoint
- Endpoint path and optional models path
- GET or POST
- Bearer, `x-api-key`, `x-goog-api-key`, custom-header, query-key, or no authentication
- OpenAI Chat, OpenAI Responses, Anthropic Messages, Gemini generateContent, Cohere Chat, Generic JSON, or no-body request format
- Custom headers JSON
- Generic JSON body template with `{{model}}`, `{{prompt}}`, and `{{max_tokens}}` placeholders

### Custom proxy safety

The public Vercel function intentionally does **not** proxy arbitrary user-supplied hosts by default. Custom proxy hosts must be explicitly allowlisted by the site owner with:

```text
CUSTOM_PROXY_ALLOWLIST=api.example.com,other-provider.example
```

This protects the deployment from being turned into an open proxy or SSRF relay. Custom endpoints can still be tested in **Direct Browser** mode whenever that provider permits browser CORS.

## Key handling

Keys are not stored in `localStorage` or committed to the repository. They exist only in page memory. In proxy mode the submitted key is forwarded for the current request and is not echoed back by the proxy response.

Do not hard-code a permanent API key in public HTML or commit one to GitHub.

## Deploy to Vercel

1. Import `JepongDevxyz/JepongDevxyz-API-Tester` into Vercel.
2. Framework preset: **Other**.
3. No environment variables are required for the verified provider presets.
4. Optional: add `CUSTOM_PROXY_ALLOWLIST` if you want selected custom domains to work through proxy mode.
5. Deploy.

## Verification

Requires Node.js 20+:

```bash
npm test
npm run verify
```

GitHub Actions runs the same verification on pushes to `main`.
