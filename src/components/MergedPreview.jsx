import React, { useState, useEffect } from 'react';
import DynamicComponent from './DynamicComponent';
import * as Lucide from 'lucide-react';

export default function MergedPreview({ components, settings, endpoints, onUpdateComponents, isUpdating, testEndpoint, onEditComponent }) {
  const backgroundColor = settings?.colors?.background;
  const [hoveredId, setHoveredId] = useState(null);

  // Make testEndpoint available globally for components to use
  useEffect(() => {
    if (testEndpoint) {
      window.__API_TEST__ = testEndpoint;
    }
    return () => {
      delete window.__API_TEST__;
    };
  }, [testEndpoint]);

  const maxRow = components.reduce((max, comp) => {
    return Math.max(max, comp.layout.y + comp.layout.h);
  }, 1);

  const viewportRows = Math.ceil((window.innerHeight - 60) / 20);
  const minRows = Math.max(maxRow, viewportRows);

  return (
    <div className="h-full w-full flex flex-col">
      {/* Integration Status Banner */}
      <div className="flex-shrink-0 bg-gradient-to-r from-purple-900/50 to-blue-900/50 border-b border-purple-700/50 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Lucide.Zap className="text-purple-400" size={20} />
          <div>
            <h3 className="text-sm font-semibold text-white">Merged Preview Mode</h3>
            <p className="text-xs text-gray-300">
              Frontend integrated with {endpoints.length} API endpoint{endpoints.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        
        {endpoints.length > 0 && (
          <button
            onClick={onUpdateComponents}
            disabled={isUpdating}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium text-sm flex items-center gap-2 transition-colors"
          >
            {isUpdating ? (
              <>
                <Lucide.Loader2 className="animate-spin" size={16} />
                Integrating...
              </>
            ) : (
              <>
                <Lucide.RefreshCw size={16} />
                Re-integrate APIs
              </>
            )}
          </button>
        )}
      </div>

      {/* Preview Grid */}
      <div 
        className={`flex-grow grid grid-cols-12 w-full overflow-auto ${backgroundColor ? '' : 'bg-gray-900'}`}
        style={{ 
          gridTemplateRows: `repeat(${minRows}, 20px)`,
          gridAutoRows: '20px',
          ...(backgroundColor ? { backgroundColor } : {})
        }}
      >
        {components.length === 0 ? (
          <div className="col-span-12 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <Lucide.Layers size={48} className="mx-auto mb-4 opacity-50" />
              <h2 className="text-xl font-semibold mb-2">No Components Yet</h2>
              <p>Switch to Frontend mode to create components first</p>
            </div>
          </div>
        ) : (
          components.map((comp) => {
            const { x, y, w, h } = comp.layout;
            return (
              <div
                key={comp.id}
                style={{
                  gridColumn: `${x + 1} / span ${w}`,
                  gridRow: `${y + 1} / span ${h}`,
                }}
                className="h-full w-full relative group"
                onMouseEnter={() => setHoveredId(comp.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <DynamicComponent code={comp.code} />
                {hoveredId === comp.id && (
                  <button
                    onClick={() => onEditComponent(comp)}
                    className="absolute top-2 right-2 p-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg shadow-lg transition-colors z-50 flex items-center gap-1"
                    title="Edit Component Code"
                  >
                    <Lucide.Code size={16} />
                    <span className="text-xs font-medium">Edit</span>
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* API Endpoints Reference Panel (Collapsible) */}
      {endpoints.length > 0 && (
        <details className="flex-shrink-0 bg-gray-800 border-t border-gray-700">
          <summary className="px-4 py-2 cursor-pointer hover:bg-gray-750 text-sm font-medium text-gray-300 flex items-center gap-2">
            <Lucide.Database size={16} />
            Available API Endpoints ({endpoints.length})
          </summary>
          <div className="px-4 pb-3 space-y-1 max-h-32 overflow-auto">
            {endpoints.map((ep) => (
              <div key={ep.id} className="flex items-center gap-2 text-xs">
                <span className={`px-2 py-0.5 rounded font-mono font-bold ${
                  ep.method === 'GET' ? 'bg-green-900/50 text-green-300' :
                  ep.method === 'POST' ? 'bg-blue-900/50 text-blue-300' :
                  ep.method === 'PUT' ? 'bg-yellow-900/50 text-yellow-300' :
                  ep.method === 'DELETE' ? 'bg-red-900/50 text-red-300' :
                  'bg-purple-900/50 text-purple-300'
                }`}>
                  {ep.method}
                </span>
                <code className="text-gray-400">{ep.path}</code>
                <span className="text-gray-500">- {ep.description}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
