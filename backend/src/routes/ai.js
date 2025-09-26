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

// Models configurable via env; change these in Render if needed
const PRIMARY_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || 'gemini-2.5-flash-lite';

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

// ---------- small intent parser (unchanged) ----------
function detectIntent(userText) {
  const t = (userText || '').toLowerCase().trim();

  if (/^\s*(add\s+city|add)\s*[:\-]?\s*/i.test(userText)) {
    const after = userText.replace(/^\s*(add\s+city|add)\s*[:\-]?\s*/i, '').trim();
    const [namePart, statePart] = after.split(',').map(s => s?.trim()).filter(Boolean);
    if (namePart) return { type: 'add', name: namePart, state: statePart || null, country: 'IN' };
  }

  if (/^\s*(delete\s+city|delete|remove)\s*[:\-]?\s*/i.test(userText)) {
    const after = userText.replace(/^\s*(delete\s+city|delete|remove)\s*[:\-]?\s*/i, '').trim();
    const [namePart, statePart] = after.split(',').map(s => s?.trim()).filter(Boolean);
    if (namePart) return { type: 'delete', name: namePart, state: statePart || null, country: 'IN' };
  }

  const wxMatch = t.match(/\b(weather\s+for|show\s+weather\s+for|forecast\s+for)\s+(.+)/i);
  if (wxMatch) {
    const name = wxMatch[2]?.split(',')[0]?.trim();
    if (name) return { type: 'weather_query_name', name };
  }

  return { type: 'none' };
}

// ---------- function declarations metadata ----------
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

// ---------- main endpoint ----------
r.post('/chat', async (req, res) => {
  const API_KEY = (process.env.GEMINI_API_KEY || '').trim();
  if (!API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY missing' });

  try {
    const { messages = [] } = req.body || {};
    const userId = req.header('x-user-id') || req.body?.userId || 'demo-user';
    const lastUserText = messages?.length ? messages[messages.length - 1]?.content || '' : '';

    // 1) Local intent handling (fast paths)
    const intent = detectIntent(lastUserText);
    if (intent.type === 'add') {
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
      } catch (e) {
        // ignore geocode failures — proceed with what we have
      }
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

    // 2) Map internal roles to API-required roles ('user' | 'model')
    function mapRoleForApi(role) {
      if (!role) return 'user';
      const r = String(role).toLowerCase();
      if (r === 'user') return 'user';
      return 'model'; // assistant, tool, system => model
    }

    const convo = messages.slice(-10).map((m) => ({
      role: mapRoleForApi(m.role),
      parts: [{ text: m.content || '' }],
    }));

    // helper: run model (with tool-call flow)
    async function runWithModel(modelId) {
      let model;
      try {
        model = getModel(API_KEY, modelId);
      } catch (err) {
        const e = new Error(`Model init failed for "${modelId}": ${err?.message || err}`);
        e.status = 500;
        throw e;
      }

      // initial model call (model may request tools via functionCall parts)
      let first;
      try {
        first = await model.generateContent({
          contents: convo,
          tools: [{ functionDeclarations }],
        });
      } catch (err) {
        const status = err?.response?.status || err?.status || 500;
        const detail = err?.response?.data || err?.message || String(err);
        const e = new Error(`Model call failed (${modelId}): ${detail}`);
        e.status = status;
        throw e;
      }

      // pick candidate content
      const candidate = first?.response?.candidates?.[0];
      const modelTurn = candidate?.content || first?.response?.messages?.[0];
      // ensure role is allowed
      if (modelTurn && !modelTurn.role) modelTurn.role = 'model';

      // check if model asked to call functions/tools
      const callParts = (modelTurn?.parts || []).filter((p) => p.functionCall);
      if (!callParts || callParts.length === 0) {
        // no tool calls — return textual reply
        const textReply = first.response?.text?.() || (candidate?.content?.parts?.map(p => p.text).join(' ') || 'OK');
        return { reply: textReply, toolsUsed: [], data: [] };
      }

      // run each requested tool locally
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

      // pass tool outputs back to model as a model-role turn (simple JSON text)
      const toolParts = [
        {
          role: 'model',
          parts: [{ text: JSON.stringify(toolOutputs) }],
        },
      ];

      // follow-up call: include model's function-call turn then the tool results
      let follow;
      try {
        follow = await model.generateContent({
          contents: [
            ...convo,
            modelTurn,
            ...toolParts,
          ],
        });
      } catch (err) {
        const status = err?.response?.status || err?.status || 500;
        const detail = err?.response?.data || err?.message || String(err);
        const e = new Error(`Follow-up model call failed (${modelId}): ${detail}`);
        e.status = status;
        throw e;
      }

      const finalText = follow.response?.text?.() ||
        (follow.response?.candidates?.[0]?.content?.parts?.map(p => p.text).join(' ') || 'OK');

      return {
        reply: finalText,
        toolsUsed: toolOutputs.map(t => t.name),
        data: toolOutputs,
      };
    } // end runWithModel

    // 3) Try primary model, fallback on quota/429 or choose friendly errors for 403/404
    try {
      const out = await runWithModel(PRIMARY_MODEL);
      return res.json(out);
    } catch (e) {
      const status = e?.status || (e?.response?.status) || 0;
      const msg = e?.message || e?.response?.data || String(e);

      // quota or rate limiting -> try fallback
      if (status === 429 || /Too Many Requests|quota/i.test(String(msg))) {
        try {
          const out2 = await runWithModel(FALLBACK_MODEL);
          return res.json(out2);
        } catch (e2) {
          return res.status(503).json({
            error: 'AI free-tier quota reached and fallback failed. Weather tools still work.',
            detail: e2?.message || String(e2),
          });
        }
      }

      // model-not-found or permission -> instructive message
      if (status === 404 || status === 403 || /not found|was not found|does not have access/i.test(String(msg))) {
        return res.status(500).json({
          error: 'AI model unavailable for this project. Please set GEMINI_MODEL to a model your Google Cloud project has access to (e.g., gemini-2.5-flash).',
          detail: msg,
        });
      }

      // other errors
      return res.status(500).json({ error: 'AI service failed', detail: msg });
    }
  } catch (e) {
    console.error('AI chat error:', e?.response?.data || e?.message || e);
    return res.status(500).json({ error: e?.message || 'AI service failed' });
  }
});

export default r;
