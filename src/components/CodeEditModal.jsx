import React, { useState } from 'react';
import { LiveProvider, LiveEditor, LivePreview, LiveError } from 'react-live';
import * as Lucide from 'lucide-react';

export default function CodeEditModal({ isOpen, onClose, code, setCode, onSave, onEditCode }) {
  const [chatPrompt, setChatPrompt] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  if (!isOpen) return null;

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatPrompt || isEditing) return;

    setIsEditing(true);
    try {
      const newCode = await onEditCode(code, chatPrompt);
      if (newCode) {
        setCode(newCode);
      }
      setChatPrompt('');
    } catch (error) {
      console.error('Failed to edit code:', error);
    }
    setIsEditing(false);
  };

  const scope = {
    React,
    useState: React.useState,
    useEffect: React.useEffect,
    useCallback: React.useCallback,
    useRef: React.useRef,
    ...Lucide,
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-10">
      <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl h-full max-h-[80vh] flex flex-col overflow-hidden ring-1 ring-gray-700">
        <div className="flex-shrink-0 flex justify-between items-center p-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">Edit Component Code</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <Lucide.X size={24} />
          </button>
        </div>

        <LiveProvider code={code} scope={scope}>
          <div className="flex-grow grid grid-cols-2 gap-px bg-gray-700 overflow-hidden">
            <div className="flex flex-col h-full overflow-hidden bg-gray-900">
              <div className="flex-shrink-0 p-2 text-xs font-mono text-gray-400 border-b border-gray-700">Live Editor</div>
              <div className="flex-grow overflow-auto">
                <LiveEditor onChange={setCode} className="text-sm !bg-gray-900" style={{fontFamily: '"Fira code", "Fira Mono", monospace', minHeight: '100%'}} padding={16} />
              </div>
            </div>

            <div className="flex flex-col h-full overflow-hidden bg-white">
              <div className="flex-shrink-0 p-2 text-xs font-mono text-gray-500 bg-gray-100 border-b border-gray-300">Live Preview</div>
              <div className="flex-grow overflow-auto">
                <LivePreview className="h-full w-full" />
              </div>
              <div className="flex-shrink-0 p-2 border-t border-gray-300 bg-gray-100 min-h-[50px]">
                <LiveError className="text-xs text-red-600 bg-red-100 p-2 rounded" />
              </div>
            </div>
          </div>
        </LiveProvider>

        <div className="flex-shrink-0 flex justify-between items-center gap-4 p-4 border-t border-gray-700">
          <form onSubmit={handleChatSubmit} className="flex-grow flex items-center gap-2">
            <input
              type="text"
              value={chatPrompt}
              onChange={(e) => setChatPrompt(e.target.value)}
              placeholder="e.g., 'Make the button red' or 'Add an email icon'"
              className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isEditing}
            />
            <button type="submit" disabled={isEditing} className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-medium px-3 py-1.5 rounded-lg text-sm flex items-center gap-2">
              {isEditing ? <Lucide.Loader2 className="animate-spin" size={16} /> : <Lucide.Sparkles size={16} />} Edit
            </button>
          </form>

          <div className="flex-shrink-0 flex gap-4">
            <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-500 text-white font-medium">Cancel</button>
            <button onClick={onSave} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium">Save Changes</button>
          </div>
        </div>
      </div>
    </div>
  );
}
