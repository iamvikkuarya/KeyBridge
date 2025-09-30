# KeyBridge

Compare answers from multiple LLMs side-by-side — fast, simple, and privacy‑minded.

KeyBridge is a local, two‑part app:
- Client: a clean React + Vite UI with a dynamic input, image uploads, and a centered Settings modal
- Server: a lightweight Express proxy that calls multiple providers in parallel and auto‑selects suitable models based on your API key

Features
- Side‑by‑side answers for better judgment and clarity
- Providers: OpenAI (ChatGPT), Anthropic (Claude), Google (Gemini), xAI (Grok), OpenRouter
- Auto model selection from your API keys (no need to remember exact model names)
- Image upload (multimodal) support where the model/provider supports images
- Local key handling: keys are stored in your browser (localStorage) and only sent to your local server per request
- Clean, monochrome UI with subtle animations and a dynamic, auto‑resizing input

Quick start
1) Install dependencies

```bash
npm install
```

2) Run client and server together

```bash
npm run dev
```

- Client: http://localhost:5173
- Server: http://localhost:3001

3) Add API keys
- Click Settings (top‑right), paste your keys for the providers you want, toggle them on, Save
- Ask a question (optionally upload images) to see provider responses side‑by‑side

Providers and model selection
- OpenAI, Gemini, xAI, OpenRouter: models are discovered from the provider’s list endpoints when possible
- Anthropic: uses a sensible default (due to no public list endpoint) and will work with common Claude models

Security notes
- This project is designed for local use. If deploying, add HTTPS and a proper secrets strategy (don’t keep keys client‑side in production)
- The server does not log keys; keys are sent only per request from the browser to your local server

Scripts
- npm run dev — start client and server together
- npm run client — start client only
- npm run server — start server only

Project structure
```
KeyBridge/
  client/         # Vite + React UI
  server/         # Express server (proxy + provider calls)
  package.json    # root scripts to run both
```

Roadmap ideas
- Streaming responses per provider
- Conversation history + export
- Provider‑specific knobs (temperature, max tokens) via advanced settings
- Keyboard shortcuts and chat slash‑commands

Contributing
- Issues and PRs are welcome. Please keep changes minimal and cohesive.

License
- No license specified yet. Add one before public distribution.

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
