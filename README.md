
# Taste Recommender

Enter up to three things you love, such as a film, a band, or a book, and get recommendations from related areas of culture. Each result includes a short reason it fits your taste.

**Live demo:** https://taste-recommender-1.onrender.com/

**Repository:** https://github.com/SATWIK3303/taste-recommender

Built for the Qloo Agentic Hackathon, using Qloo's cultural intelligence API.

## How it works

1. You enter up to three favorites in the form.
2. The browser sends them to the server at `POST /api/recommend`.
3. For each favorite, the server calls Qloo's `/search` endpoint to find its entity ID.
4. The server sends that ID to Qloo's `/v2/insights` endpoint and gets related artists and films.
5. The server writes a short reason for each result. If an Anthropic API key is set, the reason is personalized. Otherwise, a generic sentence is shown.
6. The page displays the results as cards.

## Tech stack

- **Backend:** Node.js and Express (`server.js`)
- **Frontend:** HTML, CSS, and vanilla JavaScript (`public/index.html`)
- **Data:** Qloo API (hackathon endpoint)
- **Hosting:** Render (free tier)

## Run locally

Requires Node.js 18 or newer.

```bash
git clone https://github.com/SATWIK3303/taste-recommender.git
cd taste-recommender
npm install
cp .env.example .env    # then add your keys
npm run dev
```

Open http://localhost:3000 in your browser.

## Environment variables

Set these in a `.env` file for local development, or in the Environment section of your hosting dashboard. Never commit `.env`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `QLOO_API_KEY` | Yes | Your Qloo hackathon API key. Without it, the app shows test data. |
| `QLOO_BASE_URL` | Yes | Use `https://hackathon.api.qloo.com`. Hackathon keys don't work with other Qloo addresses. |
| `ANTHROPIC_API_KEY` | No | Enables personalized reasons. Without it, a generic sentence is shown. |
| `ANTHROPIC_MODEL` | No | Model used for reasons. Defaults to `claude-haiku-5-5`. |
| `PORT` | No | Server port. Defaults to 3000. |

## Project structure