import React from 'react';
import * as Lucide from 'lucide-react';

export default function ChatBar({ prompt, setPrompt, onSubmit, isLoading }) {
  return (
    <form
      onSubmit={onSubmit}
      className="flex-shrink-0 p-4 bg-gray-800 border-t border-gray-700 flex items-center gap-4"
    >
      <Lucide.MessageSquare className="text-gray-400" />
      <input
        type="text"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="e.g., 'A modern login form with a blue login button'"
        className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        disabled={isLoading}
      />
      <button
        type="submit"
        disabled={isLoading}
        className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
      >
        {isLoading ? (
          <Lucide.Loader2 className="animate-spin" size={20} />
        ) : (
          <Lucide.Send size={20} />
        )}
        Generate
      </button>
    </form>
  );
}
