const express = require('express');
const Groq = require('groq-sdk');
const { getMatchContext } = require('../services/footballStats');

const router = express.Router();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = 'llama-3.3-70b-versatile';

// Persistent chat sessions: sessionId → messages[]
const chatSessions = {};

async function chat(messages, json = false) {
  const params = { model: MODEL, messages, temperature: 0.4 };
  if (json) params.response_format = { type: 'json_object' };
  const res = await groq.chat.completions.create(params);
  return res.choices[0].message.content;
}

// ── POST /api/ai/recommend ──────────────────────────────────────────────────
router.post('/recommend', async (req, res) => {
  const { event } = req.body;
  if (!event) return res.status(400).json({ error: 'event is required' });

  const oddsText = event.odds.draw
    ? `Home (${event.homeTeam}): ${event.odds.home}, Draw: ${event.odds.draw}, Away (${event.awayTeam}): ${event.odds.away}`
    : `${event.homeTeam}: ${event.odds.home}, ${event.awayTeam}: ${event.odds.away}`;

  // Try to fetch real stats from API-Football
  const statsContext = event.sport === 'Football'
    ? await getMatchContext(event.homeTeam, event.awayTeam)
    : null;

  const statsSection = statsContext
    ? `\nReal team data:\n${statsContext}`
    : '\n(No historical stats available for this match.)';

  const prompt = `You are a professional sports betting analyst. Analyze this ${event.sport} match and give a betting recommendation.

Match: ${event.homeTeam} vs ${event.awayTeam}
Odds: ${oddsText}${statsSection}

Respond ONLY with valid JSON (no markdown):
{
  "pick": "<home|draw|away>",
  "confidence": "<Low|Medium|High>",
  "reasoning": "<2-3 sentences using the stats if available>",
  "suggestedStake": "<Conservative|Moderate|Aggressive>"
}`;

  try {
    const text = await chat([{ role: 'user', content: prompt }], true);
    res.json(JSON.parse(text));
  } catch (err) {
    console.error('Groq recommend error:', err.message);
    res.status(500).json({ error: 'AI recommendation failed', detail: err.message });
  }
});

// ── POST /api/ai/auto-bet ───────────────────────────────────────────────────
router.post('/auto-bet', async (req, res) => {
  const { events, bankroll, maxStakePercent = 10 } = req.body;
  if (!events || !bankroll) return res.status(400).json({ error: 'events and bankroll are required' });

  const upcoming = events.filter(e => e.status === 'upcoming');
  if (!upcoming.length) return res.json({ bets: [], message: 'No upcoming events to bet on.' });

  // Enrich football events with real stats (parallel, don't fail on errors)
  const statsMap = {};
  await Promise.all(
    upcoming
      .filter(e => e.sport === 'Football')
      .map(async e => {
        const ctx = await getMatchContext(e.homeTeam, e.awayTeam).catch(() => null);
        if (ctx) statsMap[e.id] = ctx;
      })
  );

  const maxStake = parseFloat(((bankroll * maxStakePercent) / 100).toFixed(2));

  const eventSummaries = upcoming.map(e => {
    const odds = e.odds.draw
      ? `Home: ${e.odds.home}, Draw: ${e.odds.draw}, Away: ${e.odds.away}`
      : `${e.homeTeam}: ${e.odds.home}, ${e.awayTeam}: ${e.odds.away}`;
    const stats = statsMap[e.id] ? `\n  Stats: ${statsMap[e.id].replace(/\n/g, ' | ')}` : '';
    return `- ID: ${e.id} | ${e.sport}: ${e.homeTeam} vs ${e.awayTeam} | Odds: ${odds}${stats}`;
  }).join('\n');

  const prompt = `You are an autonomous sports betting AI with a bankroll of $${bankroll.toFixed(2)}.
Max stake per bet: $${maxStake} (${maxStakePercent}% of bankroll).

Analyze these events and select only bets with genuine value. Use the stats where provided.

${eventSummaries}

Respond ONLY with a JSON array (no markdown):
[{ "eventId": "<id>", "selection": "<home|draw|away>", "stake": <number 1-${maxStake}>, "reasoning": "<one sentence>" }]

Return [] if no bets have value.`;

  try {
    const text = await chat([{ role: 'user', content: prompt }], true);
    const parsed = JSON.parse(text);
    const bets = Array.isArray(parsed) ? parsed : parsed.bets || [];
    res.json({ bets, maxStake });
  } catch (err) {
    console.error('Groq auto-bet error:', err.message);
    res.status(500).json({ error: 'Auto-bet failed', detail: err.message });
  }
});

// ── POST /api/ai/chat ───────────────────────────────────────────────────────
router.post('/chat', async (req, res) => {
  const { message, sessionId = 'default', context } = req.body;
  if (!message) return res.status(400).json({ error: 'message is required' });

  if (!chatSessions[sessionId]) {
    chatSessions[sessionId] = [
      {
        role: 'system',
        content: `You are BetIQ, an expert AI sports betting advisor powered by Groq (Llama 3.3 70B).
You help users analyze matches, understand odds, manage bankroll, and make informed decisions.
Be concise and insightful. Always remind users this is a simulator — not real money.
When discussing specific matches, factor in team form and H2H records when mentioned.`,
      },
    ];
  }

  const contextNote = context
    ? ` [User's simulator: $${context.balance?.toFixed(2)} balance, ${context.betsPlaced} bets, ${context.betsPending} pending]`
    : '';

  chatSessions[sessionId].push({ role: 'user', content: message + contextNote });

  try {
    const reply = await chat(chatSessions[sessionId]);
    chatSessions[sessionId].push({ role: 'assistant', content: reply });
    // Keep history manageable — trim to system + last 20 messages
    if (chatSessions[sessionId].length > 21) {
      chatSessions[sessionId] = [
        chatSessions[sessionId][0],
        ...chatSessions[sessionId].slice(-20),
      ];
    }
    res.json({ reply });
  } catch (err) {
    console.error('Groq chat error:', err.message);
    res.status(500).json({ error: 'Chat failed', detail: err.message });
  }
});

// Clear a chat session
router.delete('/chat/:sessionId', (req, res) => {
  delete chatSessions[req.params.sessionId];
  res.json({ message: 'Session cleared' });
});

module.exports = router;
