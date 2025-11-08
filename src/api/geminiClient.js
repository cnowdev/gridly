import { GoogleGenAI } from '@google/genai';

// Gemini client wrapper
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_API_KEY;

let genAI = null;
if (API_KEY) {
  try {
    genAI = new GoogleGenAI({ apiKey: API_KEY });
  } catch (err) {
    console.error('Failed to initialize GoogleGenAI client:', err);
    genAI = null;
  }
} else {
  console.warn('No Gemini API key found (VITE_GEMINI_API_KEY or VITE_API_KEY)');
}

async function _callGenerate(prompt, model = 'gemini-2.5-flash') {
  if (!genAI) throw new Error('Gemini client not initialized. Set VITE_GEMINI_API_KEY in .env');

  // support multiple possible SDK method names
  if (genAI.models && typeof genAI.models.generateContent === 'function') {
    return genAI.models.generateContent({ model, contents: prompt });
  }

  if (genAI.models && typeof genAI.models.generate === 'function') {
    return genAI.models.generate({ model, prompt });
  }

  if (typeof genAI.generate === 'function') {
    return genAI.generate({ model, prompt });
  }

  throw new Error('No supported generate method found on Gemini client');
}

function normalizeResult(result) {
  if (!result) return { text: '', raw: result };
  if (typeof result === 'string') return { text: result, raw: result };
  if (result.text) return { text: result.text, raw: result };
  if (result.outputText) return { text: result.outputText, raw: result };
  if (result.content && typeof result.content === 'string') return { text: result.content, raw: result };

  // try to extract from nested outputs
  if (result.output && Array.isArray(result.output)) {
    const out = result.output.map((o) => (o.text ? o.text : JSON.stringify(o))).join('\n');
    return { text: out, raw: result };
  }

  if (result.results && Array.isArray(result.results)) {
    const out = result.results.map((r) => r.outputText || r.text || '').join('\n');
    return { text: out, raw: result };
  }

  return { text: JSON.stringify(result), raw: result };
}

export async function generate(prompt, model) {
  const res = await _callGenerate(prompt, model);
  return normalizeResult(res);
}

export async function edit(currentCode, userPrompt, model) {
  const editPrompt = `Edit the following component:\n\n${currentCode}\n\nUser request: ${userPrompt}`;
  const res = await _callGenerate(editPrompt, model);
  return normalizeResult(res);
}

export function isInitialized() {
  return !!genAI;
}
