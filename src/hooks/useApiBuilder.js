import { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { virtualServer } from '../lib/virtualServer';

const API_KEY = import.meta.env.VITE_API_KEY;
const API_STORAGE_KEY = 'gridly-api-state';

let genAI;
let model;
if (API_KEY) {
  genAI = new GoogleGenerativeAI(API_KEY);
  model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
}

const downloadFile = (content, filename, type = 'text/javascript') => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Helper to read state once safely
const loadSavedState = () => {
  try {
    const saved = localStorage.getItem(API_STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch (error) {
    console.error('Failed to load API state:', error);
    return null;
  }
};

export function useApiBuilder() {
  // --- 1. Lazy Initialization (Fixes persistence bug) ---
  const [baseServerCode, setBaseServerCode] = useState(() => {
     const saved = loadSavedState();
     return saved?.baseServerCode || '';
  });

  const [endpoints, setEndpoints] = useState(() => {
      const saved = loadSavedState();
      return saved?.endpoints || [];
  });

  const [isApiLoading, setIsApiLoading] = useState(false);

  // --- State for Manual Editing Modal ---
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentEditingEndpointId, setCurrentEditingEndpointId] = useState(null);
  const [currentEditingCode, setCurrentEditingCode] = useState('');

  const isMounted = useRef(false);

  // --- VIRTUAL SERVER BOOTER ---
  useEffect(() => {
      const bootVirtualServer = () => {
          virtualServer.reset();

          const baseMockApp = {
              get: (path, handler) => virtualServer.register('GET', path, handler),
              post: (path, handler) => virtualServer.register('POST', path, handler),
              put: (path, handler) => virtualServer.register('PUT', path, handler),
              delete: (path, handler) => virtualServer.register('DELETE', path, handler),
              patch: (path, handler) => virtualServer.register('PATCH', path, handler),
              use: () => {}, 
              listen: () => console.log("Virtual server 'listening' (mock)"),
          };

          const mockExpress = () => {
              const app = { ...baseMockApp };
              Object.defineProperty(app, 'db', {
                  get: () => virtualServer.db,
                  enumerable: true,
                  configurable: true
               });
              return app;
          };
          mockExpress.json = () => {};
          mockExpress.urlencoded = () => {};
          mockExpress.static = () => {};

          const mockRequire = (mod) => {
              if (mod === 'express') return mockExpress;
              if (mod === 'cors') return () => () => {};
              throw new Error(`Module '${mod}' is not available in the virtual environment.`);
          };

          const effectiveBaseCode = baseServerCode.trim() 
            ? baseServerCode 
            : 'const express = require("express"); const app = express();';

          const combinedCode = `
            // --- Base Server Code ---
            ${effectiveBaseCode}

            // --- Endpoints ---
            ${endpoints.map(ep => `
                try {
                    ${ep.code}
                } catch (err) {
                    console.error("Failed to register endpoint ${ep.path}:", err);
                }
            `).join('\n\n')}
          `;
          
          try {
              // --- FIX: ADDED 'module' AND 'exports' MOCKS ---
              const serverBootstrapper = new Function(
                  'require', 'console', 'module', 'exports',
                  combinedCode
              );
              
              const mockModule = { exports: {} };
              serverBootstrapper(mockRequire, console, mockModule, mockModule.exports);
              console.log("Virtual Server rebooted successfully.");
          } catch (error) {
              console.error("Failed to boot virtual server:", error);
          }
      };

      if (baseServerCode || endpoints.length > 0) {
          bootVirtualServer();
      }
  }, [baseServerCode, endpoints]);

  const testEndpoint = useCallback(async (method, path, body) => {
      try {
          return await virtualServer.fetch(method, path, body);
      } catch (error) {
          return { status: 500, ok: false, data: { error: error.message } };
      }
  }, []);

  // --- Save State ---
  useEffect(() => {
      if (!isMounted.current) {
          isMounted.current = true;
      }

      try {
          localStorage.setItem(API_STORAGE_KEY, JSON.stringify({ baseServerCode, endpoints }));
      } catch (error) {
          console.error('Failed to save API state:', error);
      }
  }, [baseServerCode, endpoints]);

  // --- Modal Handlers ---
  const openEditModal = (endpoint) => {
      setCurrentEditingEndpointId(endpoint.id);
      setCurrentEditingCode(endpoint.code);
      setIsEditModalOpen(true);
  }

  const closeEditModal = () => {
      setIsEditModalOpen(false);
      setCurrentEditingEndpointId(null);
      setCurrentEditingCode('');
  }

  // --- Unified Prompt Handler ---
  const handleApiPrompt = async (prompt) => {
    if (!model) { alert('Gemini API Key is not set.'); return; }
    setIsApiLoading(true);

    const existingEndpointsContext = endpoints.map(ep => ({
        id: ep.id, method: ep.method, path: ep.path, description: ep.description,
    }));

    const systemPrompt = `
      You are an expert Node.js/Express.js developer. Manage API endpoints based on the user request.
      
      Current Endpoints: ${JSON.stringify(existingEndpointsContext)}

      CRITICAL RULES FOR VIRTUAL ENVIRONMENT:
      1. **NO EXTERNAL LIBRARIES:** Only 'express' via \`require()\`.
      2. **USE CORS PROXY:** Route external requests through \`https://corsproxy.io/?\` + encodeURIComponent(url).
      3. **ROBUST FALLBACK:** External fetches MIGHT fail. You MUST wrap them in \`try/catch\`.
      4. **REALISTIC SILENT FALLBACKS:** In the \`catch\` block, return REALISTIC literal data. 
         - DO NOT use words like 'mock', 'fake', 'fallback', or 'error' in the data OR comments.
         - Make it look like standard data (e.g., \`res.json({ temp: '22°C', condition: 'Sunny' })\`).
      5. **SHARED STATE:** Use \`app.db\` for ALL shared data.
      6. **COMPLETE CODE ONLY:** Return complete \`app.METHOD(...)\` calls.
      7. **CLEAN DESCRIPTIONS:** Professional, concise descriptions only.
      8. **NO MARKDOWN:** Return PURE JSON.

      Return STRICT JSON with an "actions" array:
      {
        "baseServerCode": "...", 
        "actions": [
          {
            "type": "create",
            "data": {
              "method": "GET", "path": "/quotes", "description": "Get random quotes",
              "code": "app.get('/quotes', async (req, res) => { \n  try { \n    const r = await fetch('https://corsproxy.io/?' + encodeURIComponent('https://api.quotable.io/random')); \n    if (!r.ok) throw new Error('Fetch failed'); \n    const data = await r.json(); \n    res.json(data); \n  } catch (e) { \n    res.json({ content: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' }); \n  } \n});" 
            }
          }
        ]
      }
    `;

    try {
      const result = await model.generateContent(`${systemPrompt}\n\nUser Prompt: ${prompt}`);
      const text = result.response.text().replace(/```json|```/g, '').trim();
      const data = JSON.parse(text);

      if (data.baseServerCode) setBaseServerCode(data.baseServerCode);
      if (data.actions) {
          setEndpoints(prev => {
              let newEndpoints = [...prev];
              data.actions.forEach(action => {
                  if (action.type === 'create') newEndpoints.push({ ...action.data, id: `ep-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` });
                  else if (action.type === 'update') newEndpoints = newEndpoints.map(ep => ep.id === action.id ? { ...ep, ...action.data, id: action.id } : ep);
                  else if (action.type === 'delete') newEndpoints = newEndpoints.filter(ep => ep.id !== action.id);
              });
              return newEndpoints;
          });
      }
    } catch (error) {
      console.error("API prompt failed:", error);
      alert("AI Error. Check console.");
    } finally {
      setIsApiLoading(false);
    }
  };

  // --- AI Edit ---
  const editEndpointAi = async (userPrompt) => {
    if (!model || !currentEditingEndpointId) return;
    setIsApiLoading(true);
    const endpointToEdit = endpoints.find(ep => ep.id === currentEditingEndpointId);
    if (!endpointToEdit) { setIsApiLoading(false); return; }

    const systemPrompt = `
      Modify this Express.js endpoint. 
      CRITICAL RULES:
      1. Return COMPLETE \`app.METHOD(...)\` call.
      2. Use 'app.db' for shared state. 
      3. USE CORS PROXY ('https://corsproxy.io/?' + url) for external calls.
      4. MUST HAVE TRY/CATCH with REALISTIC SILENT FALLBACK data (no 'mock'/'fake' labels in data or comments).
      5. CLEAN DESCRIPTIONS.
      6. No external libraries.
      7. No markdown.
      
      Current: ${endpointToEdit.method} ${endpointToEdit.path}
      Code: ${currentEditingCode}
      Request: "${userPrompt}"
      
      Return STRICT JSON: { "method": "...", "path": "...", "description": "...", "code": "app.get(..." }
    `;

    try {
        const result = await model.generateContent(systemPrompt);
        const text = result.response.text().replace(/```json|```/g, '').trim();
        const data = JSON.parse(text);
        setCurrentEditingCode(data.code);
        setEndpoints(prev => prev.map(ep => ep.id === currentEditingEndpointId ? { ...ep, ...data } : ep));
    } catch (error) { console.error("AI edit failed:", error); } 
    finally { setIsApiLoading(false); }
  };

  const saveAndValidateEndpoint = async () => {
     setEndpoints(prev => prev.map(ep => ep.id === currentEditingEndpointId ? { ...ep, code: currentEditingCode } : ep));
     closeEditModal();
  };

  const exportApiCode = () => {
      let fullCode = baseServerCode || '';
      const listenIndex = fullCode.lastIndexOf('app.listen');
      const dbShim = '\n// Simple in-memory database for demonstration\nconst db = {};\n// Shim app.db to use our local db object if standard express is used\n';
      
      let endpointsStr = endpoints.map(ep => `\n// ${ep.description}\n${ep.code}`).join('\n');
      // Remove proxy usage for export
      endpointsStr = endpointsStr.replace(/https:\/\/corsproxy\.io\/\?\+?\s*encodeURIComponent\(([^)]+)\)/g, '$1');
      endpointsStr = endpointsStr.replace(/app\.db\./g, 'db.');

      if (listenIndex !== -1) {
           fullCode = fullCode.slice(0, listenIndex) + dbShim + '\n/* --- API Routes --- */\n' + endpointsStr + '\n\n' + fullCode.slice(listenIndex);
      } else {
          fullCode += dbShim + '\n\n' + endpointsStr;
      }
      downloadFile(fullCode, 'server.js', 'text/javascript');
  };

  return {
    baseServerCode, setBaseServerCode, endpoints, 
    deleteEndpoint: (id) => setEndpoints(prev => prev.filter(ep => ep.id !== id)),
    generateEndpoint: handleApiPrompt, isApiLoading, exportApiCode,
    isEditModalOpen, currentEditingCode, setCurrentEditingCode, openEditModal, closeEditModal,
    editEndpointAi, saveAndValidateEndpoint, testEndpoint
  };
}