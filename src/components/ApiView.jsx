import React, { useState } from 'react';
import * as Lucide from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import ApiTester from './ApiTester';

export default function ApiView({ apiState }) {
  const {
    baseServerCode,
    endpoints,
    deleteEndpoint,
    openEditModal,
    testEndpoint,
    // New props for base server
    openBaseEditModal,
    resetBaseServerCode,
    isApiLoading,
  } = apiState;

  const [expandedId, setExpandedId] = useState('base');
  const [isTesterOpen, setIsTesterOpen] = useState(false);

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const MethodBadge = ({ method }) => {
    const colors = {
      GET: 'bg-green-900/50 text-green-300 border-green-700',
      POST: 'bg-blue-900/50 text-blue-300 border-blue-700',
      PUT: 'bg-yellow-900/50 text-yellow-300 border-yellow-700',
      DELETE: 'bg-red-900/50 text-red-300 border-red-700',
      PATCH: 'bg-purple-900/50 text-purple-300 border-purple-700',
    };
    return (
      <span className={`px-2 py-0.5 border rounded text-xs font-bold flex-shrink-0 ${colors[method.toUpperCase()] || 'bg-gray-700 text-gray-300'}`}>
        {method.toUpperCase()}
      </span>
    );
  };

  return (
    <div className="h-full w-full flex overflow-hidden relative">
        {/* Main Content - Endpoints List */}
        <div className="flex-1 bg-gray-900 text-white p-6 overflow-auto">
            <div className="max-w-3xl mx-auto space-y-6">
                
                {/* Header Actions */}
                <div className="flex justify-end">
                    <button
                        onClick={() => setIsTesterOpen(!isTesterOpen)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isTesterOpen ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
                    >
                        <Lucide.Zap size={16} />
                        {isTesterOpen ? 'Hide Tester' : 'Test API'}
                    </button>
                </div>

                {endpoints.length === 0 && !baseServerCode && (
                    <div className="text-center text-gray-400 py-12 border-2 border-dashed border-gray-700 rounded-xl">
                        <Lucide.Server size={48} className="mx-auto mb-4 opacity-50" />
                        <h2 className="text-xl font-semibold mb-2">No Endpoints Yet</h2>
                        <p>Use the chat bar below to generate your first Node.js/Express API endpoint.</p>
                        <p className="text-sm mt-4">You can also ask to "reset base server code" to get started.</p>
                    </div>
                )}

                {/* --- Base Server Setup Card --- */}
                <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
                    <div
                        className="w-full flex items-center justify-between p-4 hover:bg-gray-750/50 transition-colors text-left"
                    >
                        <button 
                            onClick={() => toggleExpand('base')}
                            // --- FIX: Changed items-center to items-start ---
                            className="flex-1 flex items-start gap-3 min-w-0" 
                        >
                            {/* Added mt-0.5 to nudge icon down slightly for optical alignment */}
                            <Lucide.Box size={20} className="text-blue-400 flex-shrink-0 mt-0.5" />
                            <div className="min-w-0">
                                <h3 className="font-semibold">Base Server Setup</h3>
                                <p className="text-sm text-gray-400 truncate">
                                    {baseServerCode ? 'Imports, middleware, and app config' : 'Click Reset to generate base code'}
                                </p>
                            </div>
                        </button>

                        {/* Base Server Action Buttons */}
                        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                            <button
                                onClick={openBaseEditModal}
                                className="p-2 text-gray-400 hover:text-blue-400 transition-colors"
                                title="Edit Base Code"
                            >
                                <Lucide.Pencil size={18} />
                            </button>
                            <button
                                onClick={resetBaseServerCode}
                                disabled={isApiLoading}
                                className="p-2 text-gray-400 hover:text-yellow-400 transition-colors disabled:opacity-50"
                                title="Reset Base Code (AI)"
                            >
                                {isApiLoading ? <Lucide.Loader2 size={18} className="animate-spin" /> : <Lucide.RotateCcw size={18} />}
                            </button>
                            <button
                                onClick={() => toggleExpand('base')}
                                className="p-2 text-gray-400 hover:text-white transition-colors"
                            >
                                {expandedId === 'base' ? <Lucide.ChevronUp size={20} /> : <Lucide.ChevronDown size={20} />}
                            </button>
                        </div>
                    </div>
                    
                    {expandedId === 'base' && (
                    <div className="border-t border-gray-700">
                        {baseServerCode ? (
                            <SyntaxHighlighter 
                                language="javascript" 
                                style={vscDarkPlus}
                                customStyle={{ margin: 0, borderRadius: 0, fontSize: '14px', background: '#1E1E1E' }}
                            >
                                {baseServerCode}
                            </SyntaxHighlighter>
                        ) : (
                            <div className="p-4 text-center text-gray-500 text-sm">
                                No base server code defined. Click the "Reset" button to generate it.
                            </div>
                        )}
                    </div>
                    )}
                </div>

                {/* --- Endpoints List --- */}
                {endpoints.map((ep) => (
                <div key={ep.id} className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden hover:border-gray-600 transition-colors">
                    <div className="flex items-center justify-between p-4 gap-4">
                        <button 
                            onClick={() => toggleExpand(ep.id)}
                            className="flex-1 flex items-center gap-4 text-left min-w-0"
                        >
                            <MethodBadge method={ep.method} />
                            <code className="text-sm bg-gray-900 px-2 py-1 rounded text-blue-300 font-mono flex-shrink-0">
                                {ep.path}
                            </code>
                            <span className="text-gray-400 text-sm truncate" title={ep.description}>
                                {ep.description}
                            </span>
                        </button>
                        
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                                onClick={() => openEditModal(ep)}
                                className="p-2 text-gray-400 hover:text-blue-400 transition-colors"
                                title="Edit Endpoint"
                            >
                                <Lucide.Pencil size={18} />
                            </button>
                            <button
                                onClick={() => deleteEndpoint(ep.id)}
                                className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                title="Delete Endpoint"
                            >
                                <Lucide.Trash2 size={18} />
                            </button>
                            <button
                                onClick={() => toggleExpand(ep.id)}
                                className="p-2 text-gray-400 hover:text-white transition-colors"
                            >
                                {expandedId === ep.id ? <Lucide.ChevronUp size={20} /> : <Lucide.ChevronDown size={20} />}
                            </button>
                        </div>
                    </div>

                    {expandedId === ep.id && (
                    <div className="border-t border-gray-700">
                        <SyntaxHighlighter 
                            language="javascript" 
                            style={vscDarkPlus}
                            customStyle={{ margin: 0, borderRadius: 0, fontSize: '14px', background: '#1E1E1E' }}
                        >
                        {ep.code}
                        </SyntaxHighlighter>
                    </div>
                    )}
                </div>
                ))}

            </div>
        </div>
        
        {/* Right Pane: API Tester (Toggleable) */}
        {isTesterOpen && (
            <div className="w-[400px] flex-shrink-0 border-l border-gray-800 bg-gray-950 shadow-2xl z-10">
                 <ApiTester onTest={testEndpoint} endpoints={endpoints} onClose={() => setIsTesterOpen(false)} />
            </div>
        )}
    </div>
  );
}