# KeyBridge

Compare answers from multiple LLMs side‑by‑side — fast, simple, and privacy‑minded.

KeyBridge is a single repo that ships a modern client and a drop‑in API layer:
- Client (Vite + React): clean monochrome UI, dynamic input, image uploads, centered Settings modal
- API: provider proxy with auto‑model selection (OpenAI, Anthropic, Google Gemini, xAI Grok, OpenRouter)

Highlights
- Side‑by‑side answers for better judgment and clarity
- Auto‑selects models from your API keys (no need to remember model IDs)
- Multimodal image support where providers/models allow
- Keys are stored locally in your browser and sent only per request
- Smooth animations, responsive grid, and auto‑resizing input

## Live demo

- https://key-bridge-nu.vercel.app

---

Getting started (local)
1) Install dependencies

```bash
npm install
```

2) Start dev (client + local Node server)

```bash
npm run dev
```

- Client: http://localhost:5173
- Local server: http://localhost:3001

3) Add API keys
- Click Settings (top‑right), paste keys, toggle providers ON, Save
- Ask a question and optionally upload images — answers render side‑by‑side

---



Configuration
Create environment files as needed (optional):

client/.env.local
```bash
VITE_API_BASE=http://localhost:3001   # default empty in production for same‑origin
```

client/.env.production (only if your API is on another domain)
```bash
VITE_API_BASE=https://your-keybridge-api.example.com
```

Providers and models
- OpenAI, Gemini, xAI, OpenRouter: models are discovered from provider list endpoints when available
- Anthropic: uses a sensible default due to lack of a public list endpoint

Security
- For personal/local use, keys in localStorage are fine; for production, prefer server‑side key storage and authenticated requests
- The API layer does not log keys; they are forwarded only to providers as needed

Scripts
- npm run dev — start client and local Node server together (dev only)
- npm run client — start client only
- npm run server — start server only
- npm run build — build the client (used by Vercel)

Project structure
```
KeyBridge/
  api/            # Vercel Serverless Functions (e.g., /api/chat)
  client/         # Vite + React client
  server/         # Local Express server (optional for local dev)
  vercel.json     # Vercel config (build and rewrites)
  package.json    # Root scripts + dependencies for API functions
```

Roadmap
- Streaming responses per provider
- Conversation history and export
- Advanced provider controls (temperature, max tokens)
- Shortcuts, slash‑commands, and prompt templates

Contributing
Issues and PRs are welcome. Please keep changes minimal and cohesive.

License
Add a license before distributing publicly.

# KeyBridge

Compare answers from multiple LLMs side-by-side.

Features
- Frontend: React + Vite, clean minimal UI
- Backend: Express proxy to call multiple providers securely from your machine
- Providers supported: OpenAI (ChatGPT), Anthropic (Claude), Google (Gemini), xAI (Grok)
- Settings panel to input your own API keys and preferred models
- Keys are stored in your browser localStorage and only sent to your local server for each request

Prerequisites
- Node.js 18+ and npm
- API keys for providers you want to use

Getting started
1) Install dependencies (from the project root):
   npm install

2) Run the app (from the project root):
   npm run dev

This starts:
- Server at http://localhost:3001
- Client at http://localhost:5173

Usage
- Open http://localhost:5173
- Click Settings in the top-right
- Enter your API keys and set models for the providers you want to use
- Toggle providers on
- Ask a question and see responses from each provider in a grid

Notes
- This is for local development. Do not deploy as-is without securing key handling and HTTPS.
- Anthropic and xAI APIs may evolve. If you hit provider-specific errors, confirm model names and update in Settings.
- For Gemini, ensure your key has access to the Generative Language API.
