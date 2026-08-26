# Crusader Child Safety Intelligence

An installable demonstration of a child-safety conversation-analysis cascade. Deterministic rules run first, GPT-5.6 Luna reviews eligible cases, and GPT-5.6 Terra handles uncertain or escalated cases. High-risk outcomes remain subject to human review.

## Requirements

- Node.js 22.13 or newer
- npm 10 or newer
- An OpenAI project API key for live model analysis

## Install with npm

```powershell
npm install
Copy-Item .env.example .env.local
```

Edit `.env.local` and set the server-only values:

```dotenv
OPENAI_API_KEY=your-project-key
ENABLE_LIVE_ANALYSIS=true
```

Never commit `.env.local` or expose the API key in client-side code.

## Run locally

```powershell
npm run dev
```

Open `http://localhost:3000`.

## Validate and build

```powershell
npm test
npm run build
```

The application fails closed when live model access is unavailable: deterministic findings still run, and serious or uncertain cases are routed to human review.
