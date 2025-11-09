import React, { useState } from 'react';
import * as Lucide from 'lucide-react';

export default function ApiEndpointEditModal({
  isOpen,
  onClose,
  code,
  setCode,
  onSave,
  onChatEdit,
  isAiLoading
}) {
  const [chatPrompt, setChatPrompt] = useState('');

  if (!isOpen) return null;

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatPrompt.trim() || isAiLoading) return;
    await onChatEdit(chatPrompt);
    setChatPrompt('');
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-10">
      <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl h-full max-h-[80vh] flex flex-col overflow-hidden ring-1 ring-gray-700">
        
        {/* Header */}
        <div className="flex-shrink-0 flex justify-between items-center p-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Lucide.ServerCog size={24} className="text-blue-400" />
            Edit Endpoint
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <Lucide.X size={24} />
          </button>
        </div>

        {/* Main Content: Code Editor */}
        <div className="flex-grow bg-gray-950 overflow-hidden relative flex flex-col">
            <div className="flex-shrink-0 bg-gray-900 text-xs text-gray-400 px-4 py-2 border-b border-gray-800 font-mono flex justify-between items-center">
                <span>Endpoint Code (Express.js)</span>
                <span className="text-gray-500">server.js snippet</span>
            </div>
            <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="flex-grow w-full h-full bg-[#1E1E1E] text-blue-300 p-4 font-mono text-sm resize-none focus:outline-none"
                spellCheck="false"
                style={{ tabSize: 2 }}
            />
        </div>

        {/* Footer: Chat & Actions */}
        <div className="flex-shrink-0 flex flex-col gap-4 p-4 border-t border-gray-700 bg-gray-800">
          
          {/* AI Chat Bar */}
          <form onSubmit={handleChatSubmit} className="flex items-center gap-2">
            <div className="flex-grow relative">
                <Lucide.Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                type="text"
                value={chatPrompt}
                onChange={(e) => setChatPrompt(e.target.value)}
                placeholder="e.g., 'Change the method to POST', 'Add validation for email field'"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isAiLoading}
                />
            </div>
            <button 
                type="submit" 
                disabled={isAiLoading || !chatPrompt.trim()} 
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors"
            >
              {isAiLoading ? <Lucide.Loader2 className="animate-spin" size={16} /> : <Lucide.Wand2 size={16} />}
              AI Edit
            </button>
          </form>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-3 border-t border-gray-700/50">
            <button 
                onClick={onClose} 
                className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-medium transition-colors"
            >
                Cancel
            </button>
            <button 
                onClick={onSave} 
                disabled={isAiLoading}
                className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition-colors flex items-center gap-2"
            >
                <Lucide.Save size={18} />
                Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}