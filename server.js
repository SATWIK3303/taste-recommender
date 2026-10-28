import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = process.env.PORT || 3000;
const QLOO_API_KEY = (process.env.QLOO_API_KEY || '').trim();
const QLOO_BASE_URL = (process.env.QLOO_BASE_URL || 'https://hackathon.api.qloo.com').replace(/\/+$/, '');
const ANTHROPIC_API_KEY = (process.env.ANTHROPIC_API_KEY || '').trim();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Used only when there is no Qloo key, so the page still works
const MOCK_MATCHES = [
  { title: 'Tame Impala', category: 'music' },
  { title: 'The Left Hand of Darkness', category: 'book' },
  { title: 'Ramen Nagi', category: 'restaurant' },
];

// ---------- Qloo ----------

// Step 1: turn a name like "Blade Runner" into a Qloo entity ID
async function findEntityId(name) {
  const url = new URL(`${QLOO_BASE_URL}/search`);
  url.searchParams.set('query', name);

  const response = await fetch(url, { headers: { 'X-Api-Key': QLOO_API_KEY } });
  if (!response.ok) {
    throw new Error(`Qloo search failed with status ${response.status}`);
  }

  const data = await response.json();
  return data.results?.[0]?.entity_id ?? null;
}

// Step 2: ask Qloo's Insights API for things related to that entity
// Categories to ask Qloo for. Add or remove types here.
const TARGET_TYPES = ['urn:entity:artist', 'urn:entity:movie'];

async function fetchInsights(entityId, filterType) {
  const url = new URL(`${QLOO_BASE_URL}/v2/insights`);
  url.searchParams.set('filter.type', filterType);
  url.searchParams.set('signal.interests.entities', entityId);
  url.searchParams.set('take', '5');

  const response = await fetch(url, { headers: { 'X-Api-Key': QLOO_API_KEY } });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Qloo insights (${filterType}) failed with status ${response.status}: ${body}`);
  }

  const data = await response.json();
  return (data.results?.entities ?? []).map((entity) => ({
    title: entity.name,
    category: (entity.subtype ?? 'other').split(':').pop(),
  }));
}

async function getQlooMatches(favorite) {
  if (!QLOO_API_KEY) return MOCK_MATCHES;

  const entityId = await findEntityId(favorite);
  if (!entityId) return [];

  // Ask for each category at once. If one fails, keep the others.
  const settled = await Promise.allSettled(
    TARGET_TYPES.map((type) => fetchInsights(entityId, type))
  );

  const matches = [];
  for (const result of settled) {
    if (result.status === 'fulfilled') {
      matches.push(...result.value);
    } else {
      console.error(result.reason.message);
    }
  }
  return matches;
}

// ---------- Explanations ----------

function fallbackReason(source) {
  return `Matched to your taste in ${source}.`;
}

async function explainMatch(favorites, match, source) {
  if (!ANTHROPIC_API_KEY) return fallbackReason(source);

  const prompt =
    `A user likes: ${favorites.join(', ')}.\n` +
    `Recommend this ${match.category} to them: ${match.title}.\n` +
    'In one or two plain sentences, explain why it fits their taste.';

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-5-5',
        max_tokens: 150,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!response.ok) return fallbackReason(source);

    const data = await response.json();
    const text = (data.content ?? [])
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join(' ')
      .trim();
    return text || fallbackReason(source);
  } catch {
    return fallbackReason(source);
  }
}

// ---------- Routes ----------

app.post('/api/recommend', async (req, res) => {
  const favorites = (req.body?.favorites ?? [])
    .map((f) => String(f).trim())
    .filter(Boolean)
    .slice(0, 3);

  if (favorites.length === 0) {
    return res.status(400).json({ detail: 'Enter at least one favorite.' });
  }

  const favoritesLower = new Set(favorites.map((f) => f.toLowerCase()));
  const seen = new Set();
  const results = [];

  try {
    for (const favorite of favorites) {
      const matches = await getQlooMatches(favorite);
      for (const match of matches) {
        const key = match.title.toLowerCase();
        if (seen.has(key) || favoritesLower.has(key)) continue;
        seen.add(key);

        const reason = await explainMatch(favorites, match, favorite);
        results.push({
          source: favorite,
          title: match.title,
          category: match.category,
          reason,
        });
      }
    }
  } catch (error) {
    console.error(error);
    return res.status(502).json({ detail: 'Could not get recommendations right now.' });
  }

  res.json(results.slice(0, 10));
});

app.listen(PORT, () => {
  console.log(`Taste recommender running at http://localhost:${PORT}`);
});