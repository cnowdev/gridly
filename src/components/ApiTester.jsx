import React, { useState, useEffect } from 'react';
import * as Lucide from 'lucide-react';

export default function ApiTester({ onTest, endpoints, onClose }) {
  const [method, setMethod] = useState('GET');
  const [path, setPath] = useState('');
  const [body, setBody] = useState('');
  const [response, setResponse] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [jsonError, setJsonError] = useState(null);

  // Prefill path if only one exists, or when endpoints change
  useEffect(() => {
      if (endpoints.length > 0 && !path) {
          // ADD .toUpperCase() to ensure case matches the dropdown values exactly
          setMethod((endpoints[0].method || 'GET').toUpperCase());
          setPath(endpoints[0].path);
      }
  }, [endpoints]);

  // Validate JSON whenever body changes
  useEffect(() => {
      if (!body.trim()) {
          setJsonError(null);
          return;
      }
      try {
          JSON.parse(body);
          setJsonError(null);
      } catch (e) {
          setJsonError(e.message);
      }
  }, [body]);

  const handleSend = async (e) => {
    e.preventDefault();
    
    // Don't allow send if there's a JSON error and we need a body
    if (jsonError && method !== 'GET' && method !== 'DELETE') {
        return;
    }

    setIsLoading(true);
    setResponse(null);
    
    const startTime = performance.now();
    try {
        const payload = (method === 'GET' || method === 'DELETE') ? null : body;
        const res = await onTest(method, path, payload);
        const endTime = performance.now();
        
        setResponse({
            status: res.status,
            ok: res.ok,
            data: res.data,
            duration: Math.round(endTime - startTime)
        });

    } catch (error) {
        setResponse({ status: 'Error', ok: false, data: error.message, duration: 0 });
    } finally {
        setIsLoading(false);
    }
  };

  const formatJson = (data) => {
      try { return JSON.stringify(data, null, 2); } catch (e) { return String(data); }
  }

  const needsBody = method !== 'GET' && method !== 'DELETE';

  return (
    <div className="h-full flex flex-col bg-gray-950">
        {/* Header */}
        <div className="flex-shrink-0 p-4 border-b border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <Lucide.Zap className="text-yellow-500" size={20} />
                <h2 className="text-lg font-semibold text-white">Live API Tester</h2>
            </div>
            {onClose && (
                <button onClick={onClose} className="text-gray-400 hover:text-white">
                    <Lucide.X size={20} />
                </button>
            )}
        </div>

        <div className="flex-grow overflow-auto p-4 space-y-6">
            {/* Request Form */}
            <form onSubmit={handleSend} className="space-y-4">
                <div className="flex gap-2">
                    <select
                        value={method}
                        onChange={(e) => setMethod(e.target.value)}
                        className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    >
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                        <option value="PATCH">PATCH</option>
                        <option value="DELETE">DELETE</option>
                    </select>
                    <input
                        type="text"
                        value={path}
                        onChange={(e) => setPath(e.target.value)}
                        placeholder="/users/1"
                        className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0"
                    />
                    <button
                        type="submit"
                        disabled={isLoading || (needsBody && jsonError)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    >
                        {isLoading ? <Lucide.Loader2 className="animate-spin" size={16} /> : <Lucide.Send size={16} />}
                        Send
                    </button>
                </div>

                {needsBody && (
                    <div className="space-y-1">
                        <div className="flex justify-between items-center">
                             <label className="text-xs text-gray-400 font-medium ml-1">Request Body (JSON)</label>
                             {jsonError && (
                                 <span className="text-xs text-red-400 flex items-center gap-1">
                                     <Lucide.AlertCircle size={12} /> Invalid JSON
                                 </span>
                             )}
                        </div>
                        <textarea
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            placeholder='{ "name": "New Item" }'
                            className={`w-full h-32 bg-gray-900 border rounded-lg p-3 text-sm text-white font-mono resize-none focus:outline-none focus:ring-2 ${jsonError ? 'border-red-500 focus:ring-red-500' : 'border-gray-700 focus:ring-blue-500'}`}
                            spellCheck="false"
                        />
                    </div>
                )}
            </form>

            {/* Response View */}
            {response && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                     <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-gray-300">Response</h3>
                        <div className="flex items-center gap-3 text-xs">
                            <span className={`px-2 py-0.5 rounded font-bold ${response.ok ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                                {response.status}
                            </span>
                            <span className="text-gray-500">{response.duration}ms</span>
                        </div>
                     </div>
                     <div className="bg-[#1E1E1E] rounded-lg p-3 overflow-auto max-h-[400px] border border-gray-800 relative group">
                        <pre className="text-sm font-mono text-blue-300 whitespace-pre-wrap">
                            {formatJson(response.data)}
                        </pre>
                         <button 
                            onClick={() => navigator.clipboard.writeText(formatJson(response.data))}
                            className="absolute top-2 right-2 p-1.5 bg-gray-800 text-gray-400 rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:text-white hover:bg-gray-700"
                            title="Copy response"
                        >
                             <Lucide.Copy size={14} />
                         </button>
                     </div>
                </div>
            )}
        </div>
    </div>
  );
}