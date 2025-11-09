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

const safeJSONParse = (text) => {
    try {
        return JSON.parse(text);
    } catch (e) {
        try {
             const match = text.match(/```json([\s\S]*?)```/);
             if (match) {
                 return JSON.parse(match[1]);
             }
             const cleaned = text.replace(/[\u0000-\u001F]+/g, ""); 
             return JSON.parse(cleaned);
        } catch (e2) {
             console.error("Failed to parse AI JSON even after cleanup:", text);
             throw e; 
        }
    }
}

export function useApiBuilder() {
  const [baseServerCode, setBaseServerCode] = useState(() => {
     const saved = loadSavedState();
     return saved?.baseServerCode || '';
  });

  const [endpoints, setEndpoints] = useState(() => {
      const saved = loadSavedState();
      return saved?.endpoints || [];
  });

  const [isApiLoading, setIsApiLoading] = useState(false);
  const isMounted = useRef(false);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentEditingEndpointId, setCurrentEditingEndpointId] = useState(null);
  const [currentEditingCode, setCurrentEditingCode] = useState('');

  const [isBaseEditModalOpen, setBaseEditModalOpen] = useState(false);
  const [currentEditingBaseCode, setCurrentEditingBaseCode] = useState('');

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
            : `const express = require("express");\nconst app = express();\napp.db = {};`;

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

      bootVirtualServer();

  }, [baseServerCode, endpoints]);

  const testEndpoint = useCallback(async (method, path, body) => {
      try {
          return await virtualServer.fetch(method, path, body);
      } catch (error) {
          return { status: 500, ok: false, data: { error: error.message } };
      }
  }, []);

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

  const openBaseEditModal = () => {
      setCurrentEditingBaseCode(baseServerCode);
      setBaseEditModalOpen(true);
  };

  const closeBaseEditModal = () => {
      setBaseEditModalOpen(false);
  };

  const saveBaseEditModal = () => {
      setBaseServerCode(currentEditingBaseCode);
      closeBaseEditModal();
  };

  const resetBaseServerCode = async () => {
      if (!model) { alert('Gemini API Key is not set.'); return; }
      if (isApiLoading) return;
      
      setIsApiLoading(true);
      const systemPrompt = `
        Generate the base Node.js Express server setup code.
        Requirements:
        1. Import 'express' and 'cors'.
        2. Create the 'app' instance.
        3. Use 'cors()' and 'express.json()' middleware.
        4. Initialize an in-memory database: \`app.db = {};\`
        
        CRITICAL:
        - DO NOT include any routes (e.g., \`app.get\`, \`app.post\`).
        - DO NOT include \`app.listen(...)\`.
        - DO NOT include \`module.exports\`.
        
        Return STRICT JSON: { "baseServerCode": "..." }
      `;

      try {
          const result = await model.generateContent(systemPrompt);
          let text = result.response.text();
          text = text.replace(/```json|```/g, '').trim();
          
          const data = safeJSONParse(text);
          if (data.baseServerCode) {
              setBaseServerCode(data.baseServerCode);
          }
      } catch (error) {
          console.error("Base code reset failed:", error);
          alert("AI Error. Check console.");
      } finally {
          setIsApiLoading(false);
      }
  };

  const handleApiPrompt = async (prompt, frontendComponents = []) => {
    if (!model) { alert('Gemini API Key is not set.'); return; }
    setIsApiLoading(true);

    const existingEndpointsContext = endpoints.map(ep => ({
        id: ep.id, method: ep.method, path: ep.path, description: ep.description,
    }));

    const frontendContext = frontendComponents.length > 0 
        ? `FRONTEND CONTEXT (Infer needed endpoints from this UI):\n${frontendComponents.map((comp, i) => `--- Component ${i + 1} ---\n${comp.code}`).join('\n\n')}` 
        : "NO FRONTEND CONTEXT AVAILABLE";

    const systemPrompt = `
      You are an expert Node.js/Express.js developer. Manage API endpoints.
      Current Endpoints: ${JSON.stringify(existingEndpointsContext)}
      ${frontendContext}

      CRITICAL RULES FOR VIRTUAL ENVIRONMENT:
      1. CHECK FOR DUPLICATES: Use 'update' action if method+path exists.
      2. NO EXTERNAL LIBRARIES: Only 'express'.
      3. USE CORS PROXY for external calls.
      4. ROBUST FALLBACK with try/catch and REALISTIC data.
      5. USE \`app.db\` for shared state.
      6. COMPLETE CODE ONLY: \`app.METHOD(...)\`.
      7. PURE JSON response.

      Return STRICT JSON with "actions" array: { "actions": [ { "type": "create"|"update"|"delete", "data": { ... } } ] }
    `;

    try {
      const result = await model.generateContent(`${systemPrompt}\n\nUser Prompt: ${prompt}`);
      let text = result.response.text();
      text = text.replace(/```json|```/g, '').trim();
      const data = safeJSONParse(text);

      if (data.actions) {
          setEndpoints(prev => {
              let newEndpoints = [...prev];
              data.actions.forEach(action => {
                  if (action.type === 'create') {
                      const existing = newEndpoints.find(ep => ep.method === action.data.method && ep.path === action.data.path);
                      if (existing) {
                           newEndpoints = newEndpoints.map(ep => ep.id === existing.id ? { ...ep, ...action.data, id: existing.id } : ep);
                      } else {
                          newEndpoints.push({ ...action.data, id: `ep-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` });
                      }
                  } else if (action.type === 'update') {
                      newEndpoints = newEndpoints.map(ep => ep.id === action.id ? { ...ep, ...action.data, id: action.id } : ep);
                  } else if (action.type === 'delete') {
                      newEndpoints = newEndpoints.filter(ep => ep.id !== action.id);
                  }
              });
              return newEndpoints;
          });
      }
    } catch (error) {
      console.error("API prompt failed:", error);
    } finally {
      setIsApiLoading(false);
    }
  };

  // --- NEW: Auto-Generate All Endpoints ---
  const autoGenerateEndpoints = async (frontendComponents) => {
      if (!model) return;
      if (frontendComponents.length === 0) {
          alert("No frontend components to analyze.");
          return;
      }
      
      // Re-use the main handler but with a specific "generate everything" prompt
      await handleApiPrompt(
          "Analyze ALL provided frontend components. Generate a COMPLETE set of necessary API endpoints (CRUD, etc.) to make them fully functional. DO NOT delete existing endpoints unless they strictly conflict.", 
          frontendComponents
      );
  };

  const editEndpointAi = async (userPrompt) => {
    if (!model || !currentEditingEndpointId) return;
    setIsApiLoading(true);
    const endpointToEdit = endpoints.find(ep => ep.id === currentEditingEndpointId);
    if (!endpointToEdit) { setIsApiLoading(false); return; }

    const systemPrompt = `
      Modify this Express.js endpoint.
      Rules: COMPLETE \`app.METHOD(...)\` call, use \`app.db\`, NO markdown.
      Current: ${endpointToEdit.method} ${endpointToEdit.path}
      Code: ${currentEditingCode}
      Request: "${userPrompt}"
      Return STRICT JSON: { "method": "...", "path": "...", "description": "...", "code": "app.get(..." }
    `;

    try {
        const result = await model.generateContent(systemPrompt);
        let text = result.response.text();
        text = text.replace(/```json|```/g, '').trim();
        const data = safeJSONParse(text);
        setCurrentEditingCode(data.code);
        setEndpoints(prev => prev.map(ep => ep.id === currentEditingEndpointId ? { ...ep, ...data } : ep));
    } catch (error) { console.error("AI edit failed:", error); } 
    finally { setIsApiLoading(false); }
  };

  const saveAndValidateEndpoint = async () => {
     setEndpoints(prev => prev.map(ep => ep.id === currentEditingEndpointId ? { ...ep, code: currentEditingCode } : ep));
     closeEditModal();
  };

  const generateServerCode = () => {
      let fullCode = baseServerCode || 'const express = require("express");\nconst app = express();\napp.db = {};';
      const listenIndex = fullCode.lastIndexOf('app.listen');
      const dbShim = `\nif (typeof app.db === 'undefined') { app.db = {}; }\n`;
      let endpointsStr = endpoints.map(ep => `\n// ${ep.description}\n${ep.code}`).join('\n');
      endpointsStr = endpointsStr.replace(/https:\/\/corsproxy\.io\/\?\+?\s*encodeURIComponent\(([^)]+)\)/g, '$1');

      if (listenIndex !== -1) {
           fullCode = fullCode.slice(0, listenIndex) + dbShim + '\n/* --- API Routes --- */\n' + endpointsStr + '\n\n' + fullCode.slice(listenIndex);
      } else {
          fullCode += dbShim + '\n\n/* --- API Routes --- */\n' + endpointsStr;
      }
      
      if (listenIndex === -1) {
          fullCode += `\n\nconst PORT = process.env.PORT || 3000;\napp.listen(PORT, () => console.log(\`Server running on port \${PORT}\`));`;
      }
      return fullCode;
  };

  const exportApiCode = () => {
      const fullCode = generateServerCode();
      downloadFile(fullCode, 'server.js', 'text/javascript');
  };

  // Helper to read state once safely
  function loadSavedState() {
      try {
          const saved = localStorage.getItem(API_STORAGE_KEY);
          return saved ? JSON.parse(saved) : null;
      } catch (error) { return null; }
  }

  return {
    baseServerCode, setBaseServerCode, endpoints, 
    deleteEndpoint: (id) => setEndpoints(prev => prev.filter(ep => ep.id !== id)),
    generateEndpoint: handleApiPrompt, 
    autoGenerateEndpoints, // Export new function
    isApiLoading, exportApiCode, generateServerCode,
    isEditModalOpen, currentEditingCode, setCurrentEditingCode, openEditModal, closeEditModal,
    editEndpointAi, saveAndValidateEndpoint, testEndpoint,
    isBaseEditModalOpen, openBaseEditModal, closeBaseEditModal,
    currentEditingBaseCode, setCurrentEditingBaseCode, saveBaseEditModal, resetBaseServerCode
  };
}