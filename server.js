import express from 'express';

const app = express();
app.use(express.static('public'));
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Hello!');
});

const MOCK_MATCHES = [
  { title: 'Tame Impala', category: 'music' },
  { title: 'The Left Hand of Darkness', category: 'book' },
  { title: 'Ramen Nagi', category: 'restaurant' },
];

async function explainMatch(favorites, match, source) {
  const fallback = `Matched to your taste in ${source}.`;

  // If there's no key, skip the AI call and use the fallback
  if (!process.env.ANTHROPIC_API_KEY) {
    return fallback;
  }

  const prompt =
    `A user likes: ${favorites.join(', ')}.\n` +
    `Recommend this ${match.category} to them: ${match.title}.\n` +
    'In one or two plain sentences, explain why it fits their taste.';

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-5-5',
        max_tokens: 150,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) return fallback;

    const data = await response.json();
    const text = data.content
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join(' ')
      .trim();

    return text || fallback;
  } catch {
    return fallback;
  }
}

app.post('/api/recommend', async (req, res) => {
  const favorites = (req.body.favorites ?? []).filter(Boolean);
  if (favorites.length === 0) {
    return res.status(400).json({ detail: 'Enter at least one favorite.' });
  }

  const results = [];
  for (const favorite of favorites) {
    for (const match of MOCK_MATCHES) {
      const reason = await explainMatch(favorites, match, favorite);
      results.push({
        source: favorite,
        title: match.title,
        category: match.category,
        reason,
      });
    }
  }
  res.json(results);
});

app.listen(3000, () => {
  console.log('Running on http://localhost:3000');
});