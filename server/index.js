import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: true }));
app.use(express.json({ limit: '20mb' }));

// In-memory cache for auto-resolved models per provider and API key
const resolvedModels = { openai: new Map(), google: new Map(), anthropic: new Map(), xai: new Map(), openrouter: new Map() };

async function resolveOpenAIModel(apiKey) {
  if (resolvedModels.openai.has(apiKey)) return resolvedModels.openai.get(apiKey);
  try {
    const resp = await axios.get('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` }, timeout: 12000
    });
    const ids = (resp.data?.data || []).map(m => m.id);
    const pick = ids.find(id => /^gpt-4o(\b|[-.])/.test(id))
      || ids.find(id => /^gpt-4\.1(\b|[-.])/.test(id))
      || ids.find(id => /^gpt-4(\b|[-.])/.test(id))
      || ids.find(id => /^gpt-3\.5(\b|[-.])/.test(id))
      || ids[0];
    if (pick) resolvedModels.openai.set(apiKey, pick);
    return pick || 'gpt-4o';
  } catch {
    return 'gpt-4o';
  }
}

async function resolveGoogleModel(apiKey) {
  if (resolvedModels.google.has(apiKey)) return resolvedModels.google.get(apiKey);
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
    const resp = await axios.get(url, { timeout: 12000 });
    const ids = (resp.data?.models || []).map(m => m.name?.split('/').pop()).filter(Boolean);
    const prefer = ['gemini-2.5-pro', 'gemini-2.0-pro', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'];
    const pick = prefer.find(p => ids.includes(p)) || ids.find(id => /^gemini-/.test(id)) || ids[0];
    if (pick) resolvedModels.google.set(apiKey, pick);
    return pick || 'gemini-1.5-pro';
  } catch {
    return 'gemini-1.5-pro';
  }
}

async function resolveAnthropicModel(apiKey) {
  if (resolvedModels.anthropic.has(apiKey)) return resolvedModels.anthropic.get(apiKey);
  // Anthropic lacks a public list endpoint; use a sensible default
  const pick = 'claude-3-5-sonnet-20240620';
  resolvedModels.anthropic.set(apiKey, pick);
  return pick;
}

async function resolveXAIModel(apiKey) {
  if (resolvedModels.xai.has(apiKey)) return resolvedModels.xai.get(apiKey);
  try {
    const resp = await axios.get('https://api.x.ai/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` }, timeout: 12000
    });
    const ids = (resp.data?.data || []).map(m => m.id);
    const prefer = ['grok-2', 'grok-2-mini', 'grok-2-1212', 'grok-beta'];
    const pick = prefer.find(p => ids.includes(p)) || ids[0];
    if (pick) resolvedModels.xai.set(apiKey, pick);
    return pick || 'grok-2';
  } catch {
    return 'grok-2';
  }
}

async function resolveOpenRouterModel(apiKey) {
  if (resolvedModels.openrouter.has(apiKey)) return resolvedModels.openrouter.get(apiKey);
  try {
    const resp = await axios.get('https://openrouter.ai/api/v1/models', {
headers: { Authorization: `Bearer ${apiKey}`, 'X-Title': 'KeyBridge', 'HTTP-Referer': 'http://localhost:5173' }
    });
    const ids = (resp.data?.data || []).map(m => m.id);
    // Prefer strong, general models if present
    const prefer = [
      'anthropic/claude-3.7-sonnet',
      'anthropic/claude-3.5-sonnet',
      'openai/gpt-4o',
      'openai/gpt-4.1-mini',
      'google/gemini-2.0-pro',
      'google/gemini-1.5-pro'
    ];
    const pick = prefer.find(p => ids.includes(p)) || ids[0];
    if (pick) resolvedModels.openrouter.set(apiKey, pick);
    return pick || 'openai/gpt-4o';
  } catch {
    return 'openai/gpt-4o';
  }
}

function redactKey(str) {
  if (!str || typeof str !== 'string') return '';
  if (str.length <= 8) return '******';
  return str.slice(0, 4) + '...' + str.slice(-4);
}

// Normalize incoming messages: expect [{ role: 'user'|'assistant'|'system', content: string }]
function normalizeMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages.map(m => ({ role: m.role || 'user', content: typeof m.content === 'string' ? m.content : String(m.content) }));
}

function isImageAttachment(att) {
  return att && typeof att === 'object' && typeof att.mime === 'string' && typeof att.data === 'string' && att.data.length > 0;
}

function splitMessagesAndBuildLastUserWithImages(messages, attachments) {
  const out = messages.map(m => ({ ...m }));
  const lastUserIdx = [...out].reverse().findIndex(m => m.role === 'user');
  if (lastUserIdx === -1) return out;
  const idx = out.length - 1 - lastUserIdx;
  const user = out[idx];
  const parts = [];
  // text as first part
  if (typeof user.content === 'string' && user.content.trim()) {
    parts.push({ type: 'text', text: user.content });
  }
  // image parts
  (attachments || []).filter(isImageAttachment).forEach(att => {
    const dataUrl = `data:${att.mime};base64,${att.data}`;
    parts.push({ type: 'image_url', image_url: { url: dataUrl } });
  });
  out[idx] = { ...user, content: parts.length ? parts : [{ type: 'text', text: '' }] };
  return out;
}

async function callOpenAI(messages, apiKey, model, attachments = []) {
  const url = 'https://api.openai.com/v1/chat/completions';
  const start = Date.now();
  try {
    const payloadMessages = (attachments && attachments.length)
      ? splitMessagesAndBuildLastUserWithImages(messages, attachments)
      : messages;
    const res = await axios.post(url, {
      model,
      messages: payloadMessages,
      temperature: 0.2
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    });
    const text = res.data?.choices?.[0]?.message?.content ?? '';
    return { ok: true, provider: 'openai', model, text, ms: Date.now() - start };
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    return { ok: false, provider: 'openai', model, error: msg, ms: Date.now() - start };
  }
}

async function callAnthropic(messages, apiKey, model, attachments = []) {
  const url = 'https://api.anthropic.com/v1/messages';
  const start = Date.now();
  try {
    const norm = normalizeMessages(messages);
    let system = '';
    const conv = [];
    const lastUserIdx = [...norm].reverse().findIndex(m => m.role === 'user');
    const targetIdx = lastUserIdx === -1 ? -1 : (norm.length - 1 - lastUserIdx);

    for (let i = 0; i < norm.length; i++) {
      const m = norm[i];
      if (m.role === 'system') {
        system += (system ? '\n' : '') + m.content;
      } else if (m.role === 'user' || m.role === 'assistant') {
        if (i === targetIdx && (attachments && attachments.length)) {
          const content = [];
          if (m.content?.trim()) content.push({ type: 'text', text: m.content });
          attachments.filter(isImageAttachment).forEach(att => {
            content.push({ type: 'image', source: { type: 'base64', media_type: att.mime, data: att.data } });
          });
          conv.push({ role: 'user', content });
        } else {
          conv.push({ role: m.role, content: [{ type: 'text', text: m.content }] });
        }
      }
    }

    const res = await axios.post(url, {
      model,
      max_tokens: 1024,
      temperature: 0.2,
      system: system || undefined,
      messages: conv
    }, {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      timeout: 60000
    });
    const parts = res.data?.content || [];
    const text = parts.map(p => p.text).filter(Boolean).join('\n');
    return { ok: true, provider: 'anthropic', model, text, ms: Date.now() - start };
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    return { ok: false, provider: 'anthropic', model, error: msg, ms: Date.now() - start };
  }
}

async function callGoogle(messages, apiKey, model, attachments = []) {
  const start = Date.now();
  try {
    const norm = normalizeMessages(messages);
    let system = '';
    const contents = [];
    const lastUserIdx = [...norm].reverse().findIndex(m => m.role === 'user');
    const targetIdx = lastUserIdx === -1 ? -1 : (norm.length - 1 - lastUserIdx);

    for (let i = 0; i < norm.length; i++) {
      const m = norm[i];
      if (m.role === 'system') {
        system += (system ? '\n' : '') + m.content;
      } else {
        const parts = [];
        if (m.content?.trim()) parts.push({ text: m.content });
        if (i === targetIdx && (attachments && attachments.length)) {
          attachments.filter(isImageAttachment).forEach(att => {
            parts.push({ inlineData: { mimeType: att.mime, data: att.data } });
          });
        }
        contents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts });
      }
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const body = {
      contents,
      generationConfig: { temperature: 0.2, topP: 0.95, maxOutputTokens: 1024 },
      systemInstruction: system ? { role: 'user', parts: [{ text: system }] } : undefined
    };
    const res = await axios.post(url, body, { timeout: 60000 });
    const cand = res.data?.candidates?.[0];
    const parts = cand?.content?.parts || [];
    const text = parts.map(p => p.text).filter(Boolean).join('\n');
    return { ok: true, provider: 'google', model, text, ms: Date.now() - start };
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    return { ok: false, provider: 'google', model, error: msg, ms: Date.now() - start };
  }
}

// xAI Grok: API is OpenAI-compatible style for chat completions.
async function callXAI(messages, apiKey, model, attachments = []) {
  const url = 'https://api.x.ai/v1/chat/completions';
  const start = Date.now();
  try {
    const payloadMessages = (attachments && attachments.length)
      ? splitMessagesAndBuildLastUserWithImages(messages, attachments)
      : messages;
    const res = await axios.post(url, {
      model,
      messages: payloadMessages,
      temperature: 0.2
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    });
    const text = res.data?.choices?.[0]?.message?.content ?? '';
    return { ok: true, provider: 'xai', model, text, ms: Date.now() - start };
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    return { ok: false, provider: 'xai', model, error: msg, ms: Date.now() - start };
  }
}

// OpenRouter: OpenAI-compatible chat completions with different endpoint and model ids
async function callOpenRouter(messages, apiKey, model, attachments = []) {
  const url = 'https://openrouter.ai/api/v1/chat/completions';
  const start = Date.now();
  try {
    const payloadMessages = (attachments && attachments.length)
      ? splitMessagesAndBuildLastUserWithImages(messages, attachments)
      : messages;
    const res = await axios.post(url, {
      model,
      messages: payloadMessages,
      temperature: 0.2
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
'X-Title': 'KeyBridge',
        'HTTP-Referer': 'http://localhost:5173'
      },
      timeout: 60000
    });
    const text = res.data?.choices?.[0]?.message?.content ?? '';
    return { ok: true, provider: 'openrouter', model, text, ms: Date.now() - start };
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    return { ok: false, provider: 'openrouter', model, error: msg, ms: Date.now() - start };
  }
}

app.post('/api/chat', async (req, res) => {
  try {
    const { messages = [], providers = {}, attachments = [] } = req.body || {};
    const normMessages = normalizeMessages(messages);

    const tasks = [];
    const immediate = [];

    // Auto-resolve models if missing
    const openaiModel = providers.openai?.apiKey ? (providers.openai.model || await resolveOpenAIModel(providers.openai.apiKey)) : null;
    const anthropicModel = providers.anthropic?.apiKey ? (providers.anthropic.model || await resolveAnthropicModel(providers.anthropic.apiKey)) : null;
    const googleModel = providers.google?.apiKey ? (providers.google.model || await resolveGoogleModel(providers.google.apiKey)) : null;
    const xaiModel = providers.xai?.apiKey ? (providers.xai.model || await resolveXAIModel(providers.xai.apiKey)) : null;
    const openrouterModel = providers.openrouter?.apiKey ? (providers.openrouter.model || await resolveOpenRouterModel(providers.openrouter.apiKey)) : null;

    if (providers.openai?.apiKey) {
      if (openaiModel) tasks.push(callOpenAI(normMessages, providers.openai.apiKey, openaiModel, attachments));
      else immediate.push({ ok: false, provider: 'openai', model: '', error: 'Unable to resolve OpenAI model' });
    }
    if (providers.anthropic?.apiKey) {
      if (anthropicModel) tasks.push(callAnthropic(normMessages, providers.anthropic.apiKey, anthropicModel, attachments));
      else immediate.push({ ok: false, provider: 'anthropic', model: '', error: 'Unable to resolve Anthropic model' });
    }
    if (providers.google?.apiKey) {
      if (googleModel) tasks.push(callGoogle(normMessages, providers.google.apiKey, googleModel, attachments));
      else immediate.push({ ok: false, provider: 'google', model: '', error: 'Unable to resolve Google model' });
    }
    if (providers.xai?.apiKey) {
      if (xaiModel) tasks.push(callXAI(normMessages, providers.xai.apiKey, xaiModel, attachments));
      else immediate.push({ ok: false, provider: 'xai', model: '', error: 'Unable to resolve xAI model' });
    }
    if (providers.openrouter?.apiKey) {
      if (openrouterModel) tasks.push(callOpenRouter(normMessages, providers.openrouter.apiKey, openrouterModel, attachments));
      else immediate.push({ ok: false, provider: 'openrouter', model: '', error: 'Unable to resolve OpenRouter model' });
    }

    if (tasks.length === 0 && immediate.length === 0) {
      return res.status(400).json({ error: 'No providers configured. Please add API keys in Settings.' });
    }

    const results = tasks.length ? await Promise.allSettled(tasks) : [];
    const normalized = results.map(r => r.status === 'fulfilled' ? r.value : ({ ok: false, error: r.reason?.message || 'Unknown error' }));
    res.json({ results: [...immediate, ...normalized] });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Server error' });
  }
});

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
console.log(`KeyBridge server running on http://localhost:${PORT}`);
});
