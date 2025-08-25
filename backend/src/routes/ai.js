// backend/src/routes/ai.js
import { Router } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  tool_searchCities,
  tool_addCity,
  tool_getWeather,
  tool_deleteCityByName,
} from '../services/aiTools.js';

const r = Router();

// Primary + fallback model
const PRIMARY_MODEL = 'gemini-1.5-flash';
const FALLBACK_MODEL = 'gemini-1.5-flash-8b'; // cheaper/friendlier to quotas

// Use a proper systemInstruction (not a user message)
const SYSTEM =
  'You are WeatherDeck Assistant. You can answer ANY general question (science, math, history, writing, ' +
  'and coding in ANY language including C++, Java, JavaScript, Python, Go, Rust, etc.). ' +
  'You ALSO have tools for weather: add/delete cities and fetch weather. ' +
  'Default country is India (IN) if country is not specified. ' +
  'Call tools ONLY when the user asks about weather or managing cities; otherwise answer directly. ' +
  'When returning code, always use proper markdown fences with the correct language tag (```cpp, ```java, ```js, etc.). ' +
  'Never claim you are restricted to Python or any single library—you are not. ' +
  'Use concise answers unless the user asks for more detail. Use metric (°C) for weather.';

function getModel(key, modelId) {
  const genAI = new GoogleGenerativeAI((key || '').trim());
  return genAI.getGenerativeModel({
    model: modelId,
    systemInstruction: SYSTEM,
  });
}

// ------------- Tiny intent parser to avoid LLM calls for weather ops -------------
function detectIntent(userText) {
  const t = (userText || '').toLowerCase().trim();

  // Add city: e.g., "add city: ranchi, jharkhand"
  if (/^\s*(add\s+city|add)\s*[:\-]?\s*/i.test(userText)) {
    const after = userText.replace(/^\s*(add\s+city|add)\s*[:\-]?\s*/i, '').trim();
    const [namePart, statePart] = after.split(',').map(s => s?.trim()).filter(Boolean);
    if (namePart) return { type: 'add', name: namePart, state: statePart || null, country: 'IN' };
  }

  // Delete city: e.g., "delete city: pune, maharashtra"
  if (/^\s*(delete\s+city|delete|remove)\s*[:\-]?\s*/i.test(userText)) {
    const after = userText.replace(/^\s*(delete\s+city|delete|remove)\s*[:\-]?\s*/i, '').trim();
    const [namePart, statePart] = after.split(',').map(s => s?.trim()).filter(Boolean);
    if (namePart) return { type: 'delete', name: namePart, state: statePart || null, country: 'IN' };
  }

  // Get weather: e.g., "weather for <city>" or "show weather for ..."
  const wxMatch = t.match(/\b(weather\s+for|show\s+weather\s+for|forecast\s+for)\s+(.+)/i);
  if (wxMatch) {
    const name = wxMatch[2]?.split(',')[0]?.trim();
    if (name) return { type: 'weather_query_name', name };
  }

  return { type: 'none' };
}

// ------------- Tool declarations for Gemini tool calling -------------
const functionDeclarations = [
  {
    name: 'searchCities',
    description: 'Search worldwide cities by text query',
    parameters: { type: 'object', properties: { q: { type: 'string' } }, required: ['q'] },
  },
  {
    name: 'addCity',
    description:
      'Add a city to the user’s saved list. If lat/lon are omitted, the server will geocode automatically. Default country=IN if not provided.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        state: { type: 'string' },
        country: { type: 'string' },
        lat: { type: 'number' },
        lon: { type: 'number' },
      },
      required: ['name'],
    },
  },
  {
    name: 'deleteCity',
    description: 'Delete a saved city by name and optional state/country (default country=IN).',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        state: { type: 'string' },
        country: { type: 'string' },
      },
      required: ['name'],
    },
  },
  {
    name: 'getWeather',
    description: 'Fetch current weather + 5-day forecast for a saved city',
    parameters: { type: 'object', properties: { cityId: { type: 'string' } }, required: ['cityId'] },
  },
];

// ------------- Main route -------------
r.post('/chat', async (req, res) => {
  const API_KEY = (process.env.GEMINI_API_KEY || '').trim();
  if (!API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY missing' });

  try {
    const { messages = [] } = req.body || {};
    const userId = req.header('x-user-id') || req.body?.userId || 'demo-user';
    const lastUserText = messages?.length ? messages[messages.length - 1]?.content || '' : '';

    // 1) Try to handle common weather intents locally (no LLM usage)
    const intent = detectIntent(lastUserText);
    if (intent.type === 'add') {
      // geocode & add
      let args = { name: intent.name, state: intent.state, country: intent.country };
      try {
        const q = [args.name, args.state, args.country].filter(Boolean).join(', ');
        const candidates = await tool_searchCities(q || args.name);
        if (candidates.length > 0) {
          const best = candidates[0];
          args.lat = best.lat;
          args.lon = best.lon;
          args.country = args.country || best.country || 'IN';
          args.state = args.state || best.state || null;
        }
      } catch {}
      const saved = await tool_addCity(userId, args);
      return res.json({
        reply: `Added **${saved.name}**${saved.state ? ', ' + saved.state : ''} (${saved.country}).`,
        toolsUsed: ['addCity'],
        data: [{ name: 'addCity', ok: true, output: saved }],
      });
    }

    if (intent.type === 'delete') {
      const out = await tool_deleteCityByName(userId, {
        name: intent.name,
        state: intent.state,
        country: intent.country,
      });
      if (out.ok) {
        const c = out.removed;
        return res.json({
          reply: `Deleted **${c.name}**${c.state ? ', ' + c.state : ''} (${c.country}).`,
          toolsUsed: ['deleteCity'],
          data: [{ name: 'deleteCity', ok: true, output: out }],
        });
      }
      return res.json({
        reply: `I couldn't find **${intent.name}**${intent.state ? ', ' + intent.state : ''} in your list.`,
        toolsUsed: ['deleteCity'],
        data: [{ name: 'deleteCity', ok: false, output: out }],
      });
    }

    if (intent.type === 'weather_query_name') {
      // simple name search → let user pick from matches or add
      const results = await tool_searchCities(intent.name);
      if (results.length === 0) {
        return res.json({ reply: `I couldn't find “${intent.name}”. Try with state name too.`, toolsUsed: ['searchCities'] });
      }
      const top = results[0];
      return res.json({
        reply: `Found **${top.name}**${top.state ? ', ' + top.state : ''} (${top.country}). You can say “Add city: ${top.name}${top.state ? ', ' + top.state : ''}”.`,
        toolsUsed: ['searchCities'],
        data: [{ name: 'searchCities', ok: true, output: results.slice(0, 5) }],
      });
    }

    // 2) Otherwise, go to LLM (with tools)
    const convo = messages.slice(-10).map((m) => ({ role: m.role, parts: [{ text: m.content }] }));

    // helper to run a model call, with tool-calling flow
    async function runWithModel(modelId) {
      const model = getModel(API_KEY, modelId);

      const first = await model.generateContent({
        contents: convo,
        tools: [{ functionDeclarations }],
      });

      const modelTurn = first.response.candidates?.[0]?.content;
      const callParts = modelTurn?.parts?.filter((p) => p.functionCall) || [];

      if (callParts.length === 0) {
        return { reply: first.response.text() || 'OK', toolsUsed: [], data: [] };
      }

      const toolOutputs = [];
      for (const p of callParts) {
        const { name, args = {} } = p.functionCall || {};
        try {
          if (name === 'searchCities') {
            const out = await tool_searchCities(args.q || '');
            toolOutputs.push({ name, args, ok: true, output: out });
          } else if (name === 'addCity') {
            let argsFixed = { country: 'IN', ...args };
            if (!argsFixed.lat || !argsFixed.lon) {
              const q = [argsFixed.name, argsFixed.state, argsFixed.country].filter(Boolean).join(', ');
              try {
                const candidates = await tool_searchCities(q || argsFixed.name || '');
                if (candidates.length > 0) {
                  const best = candidates[0];
                  argsFixed.lat = best.lat; argsFixed.lon = best.lon;
                  argsFixed.country = argsFixed.country || best.country || 'IN';
                  argsFixed.state = argsFixed.state || best.state || null;
                }
              } catch {}
            }
            const out = await tool_addCity(userId, argsFixed);
            toolOutputs.push({ name, args: argsFixed, ok: true, output: out });
          } else if (name === 'deleteCity') {
            const argsFixed = { country: 'IN', ...args };
            const out = await tool_deleteCityByName(userId, argsFixed);
            toolOutputs.push({ name, args: argsFixed, ok: out.ok, output: out });
          } else if (name === 'getWeather') {
            const out = await tool_getWeather(args.cityId, userId);
            toolOutputs.push({ name, args, ok: true, output: out });
          } else {
            toolOutputs.push({ name, args, ok: false, error: 'Unknown tool' });
          }
        } catch (e) {
          toolOutputs.push({ name, args, ok: false, error: e?.message || 'Tool failed' });
        }
      }

      const toolResponseParts = toolOutputs.map((t) => ({
        functionResponse: {
          name: t.name,
          response: {
            name: t.name,
            content: [{ text: JSON.stringify(t.ok ? t.output : { error: t.error }) }],
          },
        },
      }));

      const follow = await model.generateContent({
        contents: [
          ...convo,
          modelTurn, // MUST include functionCall turn
          { role: 'tool', parts: toolResponseParts }, // same order/count
        ],
      });

      return {
        reply: follow.response.text() || 'OK',
        toolsUsed: toolOutputs.map((t) => t.name),
        data: toolOutputs,
      };
    }

    // Try primary; if 429, fall back; if still fails, friendly message
    try {
      const out = await runWithModel(PRIMARY_MODEL);
      return res.json(out);
    } catch (e) {
      const status = e?.response?.status;
      const msg = e?.response?.data || e?.message || '';
      if (status === 429 || /Too Many Requests|quota/i.test(String(msg))) {
        try {
          const out2 = await runWithModel(FALLBACK_MODEL);
          return res.json(out2);
        } catch (e2) {
          return res.status(503).json({
            error: 'AI free-tier quota reached. Weather tools still work: try “Add city: <City, State>” or ask again later.',
            detail: e2?.message || 'quota',
          });
        }
      }
      // Other errors:
      return res.status(500).json({ error: e?.message || 'AI service failed' });
    }
  } catch (e) {
    console.error('AI chat error:', e?.response?.data || e?.message || e);
    return res.status(500).json({ error: e?.message || 'AI service failed' });
  }
});

export default r;
