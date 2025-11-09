import React from 'react';
import * as Lucide from 'lucide-react';

export default function BaseServerEditModal({
  isOpen,
  onClose,
  code,
  setCode,
  onSave,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-10">
      <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl h-full max-h-[80vh] flex flex-col overflow-hidden ring-1 ring-gray-700 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex-shrink-0 flex justify-between items-center p-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Lucide.Box size={24} className="text-blue-400" />
            Edit Base Server Code
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <Lucide.X size={24} />
          </button>
        </div>

        {/* Main Content: Code Editor */}
        <div className="flex-grow bg-gray-950 overflow-hidden relative flex flex-col">
            <div className="flex-shrink-0 bg-gray-900 text-xs text-gray-400 px-4 py-2 border-b border-gray-800 font-mono flex justify-between items-center">
                <span>Base Code (Express.js)</span>
                <span className="text-gray-500">server.js setup</span>
            </div>
            <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="flex-grow w-full h-full bg-[#1E1E1E] text-blue-300 p-4 font-mono text-sm resize-none focus:outline-none"
                spellCheck="false"
                style={{ tabSize: 2 }}
                placeholder={`const express = require("express");\nconst cors = require("cors");\nconst app = express();\n\napp.use(cors());\napp.use(express.json());\n\n// In-memory database shared across endpoints\napp.db = {};\n\n// Your endpoints will be added after this...\n`}
            />
        </div>

        {/* Footer: Actions */}
        <div className="flex-shrink-0 flex justify-end gap-3 p-4 border-t border-gray-700 bg-gray-800">
            <button 
                onClick={onClose} 
                className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-medium transition-colors"
            >
                Cancel
            </button>
            <button 
                onClick={onSave} 
                className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition-colors flex items-center gap-2"
            >
                <Lucide.Save size={18} />
                Save Changes
            </button>
        </div>
      </div>
    </div>
  );
}