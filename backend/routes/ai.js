const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const router = express.Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// Shared chat history per session (in-memory, keyed by session id)
const chatSessions = {};

// ── POST /api/ai/recommend ──────────────────────────────────────────────────
// Get Gemini's betting recommendation for a specific event
router.post('/recommend', async (req, res) => {
  const { event } = req.body;
  if (!event) return res.status(400).json({ error: 'event is required' });

  const oddsText = event.odds.draw
    ? `Home (${event.homeTeam}): ${event.odds.home}, Draw: ${event.odds.draw}, Away (${event.awayTeam}): ${event.odds.away}`
    : `${event.homeTeam}: ${event.odds.home}, ${event.awayTeam}: ${event.odds.away}`;

  const prompt = `You are a professional sports betting analyst. Analyze this upcoming ${event.sport} match and give a concise betting recommendation.

Match: ${event.homeTeam} vs ${event.awayTeam}
Sport: ${event.sport}
Odds: ${oddsText}

Respond in this exact JSON format (no markdown, no code blocks):
{
  "pick": "<home|draw|away>",
  "confidence": "<Low|Medium|High>",
  "reasoning": "<2-3 sentence analysis>",
  "suggestedStake": "<Conservative|Moderate|Aggressive>"
}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const json = JSON.parse(text);
    res.json(json);
  } catch (err) {
    console.error('Gemini recommend error:', err.message);
    res.status(500).json({ error: 'AI recommendation failed', detail: err.message });
  }
});

// ── POST /api/ai/auto-bet ───────────────────────────────────────────────────
// Gemini autonomously analyzes all upcoming events and places bets
router.post('/auto-bet', async (req, res) => {
  const { events, bankroll, maxStakePercent = 10 } = req.body;
  if (!events || !bankroll) return res.status(400).json({ error: 'events and bankroll are required' });

  const upcoming = events.filter(e => e.status === 'upcoming');
  if (upcoming.length === 0) return res.json({ bets: [], message: 'No upcoming events to bet on.' });

  const eventSummaries = upcoming.map(e => {
    const odds = e.odds.draw
      ? `Home: ${e.odds.home}, Draw: ${e.odds.draw}, Away: ${e.odds.away}`
      : `${e.homeTeam}: ${e.odds.home}, ${e.awayTeam}: ${e.odds.away}`;
    return `- ID: ${e.id} | ${e.sport}: ${e.homeTeam} vs ${e.awayTeam} | Odds: ${odds}`;
  }).join('\n');

  const maxStake = parseFloat(((bankroll * maxStakePercent) / 100).toFixed(2));

  const prompt = `You are an autonomous sports betting AI with a bankroll of $${bankroll.toFixed(2)}.
Max stake per bet: $${maxStake} (${maxStakePercent}% of bankroll).

Analyze these upcoming events and select which ones to bet on. Only pick bets with genuine value.

Events:
${eventSummaries}

Respond ONLY with a JSON array (no markdown). Each item:
{
  "eventId": "<id>",
  "selection": "<home|draw|away>",
  "stake": <number between 1 and ${maxStake}>,
  "reasoning": "<one sentence>"
}

If no bets have value, return an empty array [].`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const cleaned = text.replace(/```json|```/g, '').trim();
    const bets = JSON.parse(cleaned);
    res.json({ bets, maxStake });
  } catch (err) {
    console.error('Gemini auto-bet error:', err.message);
    res.status(500).json({ error: 'Auto-bet failed', detail: err.message });
  }
});

// ── POST /api/ai/chat ───────────────────────────────────────────────────────
// Conversational AI sports betting advisor
router.post('/chat', async (req, res) => {
  const { message, sessionId = 'default', context } = req.body;
  if (!message) return res.status(400).json({ error: 'message is required' });

  if (!chatSessions[sessionId]) {
    chatSessions[sessionId] = model.startChat({
      history: [
        {
          role: 'user',
          parts: [{ text: 'You are BetIQ, an expert AI sports betting advisor. You help users analyze matches, understand odds, manage their bankroll, and make informed betting decisions. Be concise, insightful, and always remind users this is a simulator.' }],
        },
        {
          role: 'model',
          parts: [{ text: 'Got it! I\'m BetIQ, your AI betting advisor. I can analyze matches, break down odds, suggest strategies, and help you manage your bankroll — all within the simulator. What would you like to know?' }],
        },
      ],
    });
  }

  const chat = chatSessions[sessionId];
  const contextNote = context
    ? `\n\n[Current simulator state: Bankroll $${context.balance?.toFixed(2)}, ${context.betsPlaced} bets placed, ${context.betsPending} pending]`
    : '';

  try {
    const result = await chat.sendMessage(message + contextNote);
    res.json({ reply: result.response.text() });
  } catch (err) {
    console.error('Gemini chat error:', err.message);
    res.status(500).json({ error: 'Chat failed', detail: err.message });
  }
});

// Clear chat session
router.delete('/chat/:sessionId', (req, res) => {
  delete chatSessions[req.params.sessionId];
  res.json({ message: 'Session cleared' });
});

module.exports = router;
