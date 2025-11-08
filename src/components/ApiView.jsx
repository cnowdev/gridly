import React, { useState } from 'react';
import * as Lucide from 'lucide-react';
import { generate, edit, isInitialized } from '../api/geminiClient';

export default function ApiView({ isOpen, onClose }) {
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState('gemini-2.5-flash');
  const [responseText, setResponseText] = useState('');
  const [raw, setRaw] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const runGenerate = async () => {
    setError(null);
    setLoading(true);
    setResponseText('');
    setRaw(null);
    try {
      if (!isInitialized()) throw new Error('Gemini client not initialized (check VITE_GEMINI_API_KEY)');
      const res = await generate(prompt, model);
      setResponseText(res.text || '');
      setRaw(res.raw);
    } catch (err) {
      console.error('API view generate failed:', err);
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center p-8">
      <div className="w-full max-w-4xl bg-gray-800 rounded-lg shadow-xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <Lucide.Server size={20} />
            <h3 className="text-lg font-semibold">API View</h3>
            <span className="text-xs text-gray-400">Inspect raw requests & responses</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="text-gray-300 hover:text-white"><Lucide.X size={20} /></button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <form onSubmit={(e) => { e.preventDefault(); runGenerate(); }} className="flex gap-2">
            <input
              className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter raw prompt to send to Gemini"
            />
            <select value={model} onChange={(e) => setModel(e.target.value)} className="bg-gray-700 border border-gray-600 text-white rounded px-2">
              <option value="gemini-2.5-flash">gemini-2.5-flash</option>
            </select>
            <button type="submit" disabled={loading || !prompt.trim()} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white disabled:opacity-60">
              {loading ? 'Running…' : 'Run'}
            </button>
          </form>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-gray-400 mb-2">Request Preview</div>
              <pre className="whitespace-pre-wrap bg-gray-900 p-3 rounded text-sm text-white h-48 overflow-auto">{prompt || '<empty>'}</pre>
            </div>

            <div>
              <div className="text-xs text-gray-400 mb-2">Response Text</div>
              <pre className="whitespace-pre-wrap bg-gray-900 p-3 rounded text-sm text-white h-48 overflow-auto">{responseText || (error ? `Error: ${error}` : '<no response>')}</pre>
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-400 mb-2">Raw Response (JSON)</div>
            <pre className="whitespace-pre-wrap bg-gray-900 p-3 rounded text-sm text-white h-40 overflow-auto">{raw ? JSON.stringify(raw, null, 2) : '<no raw response>'}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
