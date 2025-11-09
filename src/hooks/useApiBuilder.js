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

// --- NEW HELPER: Robust JSON Parser ---
const safeJSONParse = (text) => {
    try {
        return JSON.parse(text);
    } catch (e) {
        // Attempt to fix common LLM JSON issues
        try {
             // 1. Try to extract JSON from code blocks if present
             const match = text.match(/```json([\s\S]*?)```/);
             if (match) {
                 return JSON.parse(match[1]);
             }
             // 2. More aggressive cleanup if standard parse fails
             // This is a basic example, for complex cases a dedicated library might be needed
             const cleaned = text.replace(/[\u0000-\u001F]+/g, ""); 
             return JSON.parse(cleaned);
        } catch (e2) {
             console.error("Failed to parse AI JSON even after cleanup:", text);
             throw e; // Re-throw original error for the caller to handle
        }
    }
}


export function useApiBuilder() {
  // --- State ---
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

  // --- State for Endpoint Editing Modal ---
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentEditingEndpointId, setCurrentEditingEndpointId] = useState(null);
  const [currentEditingCode, setCurrentEditingCode] = useState('');

  // --- State for Base Server Editing Modal ---
  const [isBaseEditModalOpen, setBaseEditModalOpen] = useState(false);
  const [currentEditingBaseCode, setCurrentEditingBaseCode] = useState('');


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

          // Use a default base code if none is set, to ensure 'app' exists
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

      // Always boot server when code changes
      bootVirtualServer();

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

  // --- Endpoint Modal Handlers ---
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

  // --- Base Server Modal Handlers ---
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

  // --- AI: Reset Base Server Code ---
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
          // Remove markdown fences before parsing
          text = text.replace(/```json|```/g, '').trim();
          
          const data = safeJSONParse(text); // Use safe parser
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


  // --- AI: Generate/Manage Endpoints ---
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
      1. **CHECK FOR DUPLICATES:** Before creating, check if an endpoint with the *exact* same method and path exists. If yes, use action type 'update' with its 'id'.
      2. **NO EXTERNAL LIBRARIES:** Only 'express' via \`require()\`.
      3. **USE CORS PROXY:** Route external requests through \`https://corsproxy.io/?\` + encodeURIComponent(url).
      4. **ROBUST FALLBACK:** External fetches MIGHT fail. You MUST wrap them in \`try/catch\`.
      5. **REALISTIC SILENT FALLBACKS:** In the \`catch\` block, return REALISTIC literal data. 
         - DO NOT use words like 'mock', 'fake', 'fallback', or 'error' in the data OR comments.
         - Make it look like standard data (e.g., \`res.json({ temp: '22°C', condition: 'Sunny' })\`).
      6. **SHARED STATE:** Use \`app.db\` for ALL shared data.
      7. **COMPLETE CODE ONLY:** Return complete \`app.METHOD(...)\` calls.
      8. **CLEAN DESCRIPTIONS:** Professional, concise descriptions only.
      9. **NO MARKDOWN:** Return PURE JSON.
      10. **ESCAPE CAREFULLY:** When writing JavaScript code inside the JSON string, ensure ALL backslashes and quotes are properly escaped for JSON.

      Return STRICT JSON with an "actions" array (NO baseServerCode key):
      {
        "actions": [
          {
            "type": "create",
            "data": { "method": "GET", "path": "/path", "description": "...", "code": "app.get(...)" }
          },
          {
            "type": "update",
            "id": "ep-12345",
            "data": { "method": "POST", "path": "/newpath", "description": "...", "code": "app.post(...)" }
          }
        ]
      }
    `;

    try {
      const result = await model.generateContent(`${systemPrompt}\n\nUser Prompt: ${prompt}`);
      let text = result.response.text();
      // Clean up markdown fences before parsing
      text = text.replace(/```json|```/g, '').trim();
      
      const data = safeJSONParse(text); // Use safe parser

      if (data.actions) {
          setEndpoints(prev => {
              let newEndpoints = [...prev];
              data.actions.forEach(action => {
                  
                  if (action.type === 'create') {
                      // Client-side duplicate check, just in case AI misses.
                      const existing = newEndpoints.find(ep => 
                          ep.method.toUpperCase() === action.data.method.toUpperCase() && 
                          ep.path === action.data.path
                      );
                      
                      if (existing) {
                          // Convert this "create" to an "update"
                          console.warn(`AI tried to create duplicate ${action.data.method} ${action.data.path}. Converting to update.`);
                          newEndpoints = newEndpoints.map(ep => 
                              ep.id === existing.id ? { ...ep, ...action.data, id: existing.id } : ep
                          );
                      } else {
                          // True create
                          newEndpoints.push({ ...action.data, id: `ep-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` });
                      }
                  } 
                  else if (action.type === 'update') {
                      newEndpoints = newEndpoints.map(ep => 
                          ep.id === action.id ? { ...ep, ...action.data, id: action.id } : ep
                      );
                  } 
                  else if (action.type === 'delete') {
                      newEndpoints = newEndpoints.filter(ep => ep.id !== action.id);
                  }
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

  // --- AI: Edit Endpoint ---
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
      8. ESCAPE CAREFULLY: When writing JavaScript code inside the JSON string, ensure ALL backslashes and quotes are properly escaped for JSON.
      
      Current: ${endpointToEdit.method} ${endpointToEdit.path}
      Code: ${currentEditingCode}
      Request: "${userPrompt}"
      
      Return STRICT JSON: { "method": "...", "path": "...", "description": "...", "code": "app.get(..." }
    `;

    try {
        const result = await model.generateContent(systemPrompt);
        let text = result.response.text();
        text = text.replace(/```json|```/g, '').trim();
        const data = safeJSONParse(text); // Use safe parser
        
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
      let fullCode = baseServerCode || 'const express = require("express");\nconst app = express();\napp.db = {};';
      const listenIndex = fullCode.lastIndexOf('app.listen');
      
      // We shim 'db' differently now, assuming 'app.db' is the standard
      const dbShim = `
/* --- Auto-generated DB Shim --- */
// If app.db was not initialized in base code, initialize it.
if (typeof app.db === 'undefined') {
  console.log('Initializing app.db shim');
  app.db = {};
}
/* ------------------------------- */
`;
      
      let endpointsStr = endpoints.map(ep => `\n// ${ep.description}\n${ep.code}`).join('\n');
      // Remove proxy usage for export
      endpointsStr = endpointsStr.replace(/https:\/\/corsproxy\.io\/\?\+?\s*encodeURIComponent\(([^)]+)\)/g, '$1');

      if (listenIndex !== -1) {
           fullCode = fullCode.slice(0, listenIndex) + dbShim + '\n/* --- API Routes --- */\n' + endpointsStr + '\n\n' + fullCode.slice(listenIndex);
      } else {
          fullCode += dbShim + '\n\n/* --- API Routes --- */\n' + endpointsStr;
      }
      
      // Add a standard app.listen if it's missing for the export
      if (listenIndex === -1) {
          fullCode += `\n\nconst PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});
`;
      }
      
      downloadFile(fullCode, 'server.js', 'text/javascript');
  };

  return {
    baseServerCode, setBaseServerCode, endpoints, 
    deleteEndpoint: (id) => setEndpoints(prev => prev.filter(ep => ep.id !== id)),
    generateEndpoint: handleApiPrompt, isApiLoading, exportApiCode,
    
    // Endpoint modal
    isEditModalOpen, currentEditingCode, setCurrentEditingCode, 
    openEditModal, closeEditModal,
    editEndpointAi, saveAndValidateEndpoint, testEndpoint,

    // Base server modal
    isBaseEditModalOpen, openBaseEditModal, closeBaseEditModal,
    currentEditingBaseCode, setCurrentEditingBaseCode,
    saveBaseEditModal, resetBaseServerCode
  };
}