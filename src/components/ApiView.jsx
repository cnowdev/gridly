import React, { useState } from "react";
import * as Lucide from "lucide-react";
import { generate, isInitialized } from "../api/geminiClient";

export default function ApiView({ isOpen, onClose }) {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("gemini-2.5-flash");
  const [responseText, setResponseText] = useState("");
  const [raw, setRaw] = useState(null);
  const [nodeSnippet, setNodeSnippet] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const runGenerate = async () => {
    setError(null);
    setLoading(true);
    setResponseText("");
    setRaw(null);
    setNodeSnippet("");

    try {
      if (!isInitialized())
        throw new Error("Gemini client not initialized (check VITE_GEMINI_API_KEY)");

      const res = await generate(prompt, model);
      setResponseText(res.text || "");
      setRaw(res.raw);
      generateNodeSnippet(model);
    } catch (err) {
      console.error("API view generate failed:", err);
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const generateNodeSnippet = (modelName) => {
    const snippet = `// Example Node.js API endpoint for Gemini
import express from "express";
import { GoogleGenAI } from "@google/genai";

const router = express.Router();
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

router.post("/generate", async (req, res) => {
  try {
    const { prompt } = req.body;
    const result = await genAI.models.generateContent({
      model: "${modelName}",
      contents: prompt,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;`;

    setNodeSnippet(snippet);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center p-8">
      <div className="w-full max-w-5xl bg-gray-800 rounded-lg shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <Lucide.Server size={20} className="text-blue-400" />
            <h3 className="text-lg font-semibold text-white">API View</h3>
            <span className="text-xs text-gray-400">
              Build & Inspect Gemini API Endpoints
            </span>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-white">
            <Lucide.X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-5">
          {/* Prompt input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runGenerate();
            }}
            className="flex gap-2"
          >
            <input
              className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter raw prompt to send to Gemini"
            />
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="bg-gray-700 border border-gray-600 text-white rounded px-2"
            >
              <option value="gemini-2.5-flash">gemini-2.5-flash</option>
              <option value="gemini-2.0-pro">gemini-2.0-pro</option>
            </select>
            <button
              type="submit"
              disabled={loading || !prompt.trim()}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white disabled:opacity-60"
            >
              {loading ? "Running…" : "Run"}
            </button>
          </form>

          {/* Request / Response */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-gray-400 mb-2">Request Preview</div>
              <pre className="whitespace-pre-wrap bg-gray-900 p-3 rounded text-sm text-white h-48 overflow-auto">
                {prompt || "<empty>"}
              </pre>
            </div>

            <div>
              <div className="text-xs text-gray-400 mb-2">Response Text</div>
              <pre className="whitespace-pre-wrap bg-gray-900 p-3 rounded text-sm text-white h-48 overflow-auto">
                {responseText || (error ? `Error: ${error}` : "<no response>")}
              </pre>
            </div>
          </div>

          {/* Raw JSON */}
          <div>
            <div className="text-xs text-gray-400 mb-2">Raw Response (JSON)</div>
            <pre className="whitespace-pre-wrap bg-gray-900 p-3 rounded text-sm text-white h-40 overflow-auto">
              {raw ? JSON.stringify(raw, null, 2) : "<no raw response>"}
            </pre>
          </div>

          {/* Node.js Endpoint */}
          {nodeSnippet && (
            <div>
              <div className="text-xs text-gray-400 mb-2">
                Generated Node.js Endpoint
              </div>
              <pre className="whitespace-pre-wrap bg-gray-900 p-3 rounded text-sm text-green-400 h-56 overflow-auto">
                {nodeSnippet}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
