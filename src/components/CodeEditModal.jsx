import React, { useState, useMemo, useRef, useEffect } from 'react';
import { LiveProvider, LiveEditor, LivePreview, LiveError } from 'react-live';
import * as Lucide from 'lucide-react';

// Default constants matching GridContainer.jsx
const TOTAL_COLS = 12;
const ROW_HEIGHT = 20;

export default function CodeEditModal({ isOpen, onClose, code, setCode, onSave, onEditCode, layout, gridWidth }) {
  const [chatPrompt, setChatPrompt] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [scale, setScale] = useState(1);
  const [autoFit, setAutoFit] = useState(true);
  
  // Panning State
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  // Calculate REAL pixel dimensions
  const { trueWidth, trueHeight } = useMemo(() => {
    if (!layout || !gridWidth) return { trueWidth: null, trueHeight: null };
    const colWidth = gridWidth / TOTAL_COLS;
    return {
      trueWidth: colWidth * layout.w,
      trueHeight: ROW_HEIGHT * layout.h
    };
  }, [layout, gridWidth]);

  // Auto-fit effect
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !trueWidth || !trueHeight) return;

    const updateScale = () => {
      if (!autoFit) return;
      const availableWidth = container.clientWidth - 32; 
      const availableHeight = container.clientHeight - 32;
      const scaleX = availableWidth / trueWidth;
      const scaleY = availableHeight / trueHeight;
      setScale(Math.min(scaleX, scaleY)); 
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(container);
    return () => observer.disconnect();
  }, [isOpen, trueWidth, trueHeight, autoFit]);

  useEffect(() => {
      if (isOpen) setAutoFit(true);
  }, [isOpen]);

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

  const zoomIn = () => {
      setAutoFit(false);
      setScale(prev => Math.min(prev + 0.1, 5));
  };

  const zoomOut = () => {
      setAutoFit(false);
      setScale(prev => Math.max(prev - 0.1, 0.1));
  };

  // Panning Handlers
  const handleMouseDown = (e) => {
    if (autoFit) return;
    setIsPanning(true);
    setPanStart({
      x: e.clientX,
      y: e.clientY,
      scrollLeft: containerRef.current.scrollLeft,
      scrollTop: containerRef.current.scrollTop,
    });
    e.preventDefault();
  };

  const handleMouseMove = (e) => {
    if (!isPanning || !containerRef.current) return;
    const dx = e.clientX - panStart.x;
    const dy = e.clientY - panStart.y;
    containerRef.current.scrollLeft = panStart.scrollLeft - dx;
    containerRef.current.scrollTop = panStart.scrollTop - dy;
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const scope = {
    React,
    useState: React.useState,
    useEffect: React.useEffect,
    useCallback: React.useCallback,
    useRef: React.useRef,
    Lucide: Lucide,
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

            <div className="flex flex-col h-full overflow-hidden bg-white relative">
              <div className="flex-shrink-0 p-2 text-xs font-mono text-gray-500 bg-gray-100 border-b border-gray-300 flex justify-between items-center">
                 <span>Live Preview</span>
                 <div className="flex items-center gap-2">
                    <div className="flex items-center bg-white border border-gray-300 rounded-md overflow-hidden shadow-sm">
                        <button onClick={zoomOut} className="p-1 hover:bg-gray-100 text-gray-600 transition-colors border-r border-gray-200" title="Zoom Out">
                            <Lucide.Minus size={14} />
                        </button>
                        <span className="px-2 min-w-[3rem] text-center text-gray-700 font-medium">
                            {(scale * 100).toFixed(0)}%
                        </span>
                        <button onClick={zoomIn} className="p-1 hover:bg-gray-100 text-gray-600 transition-colors border-l border-gray-200" title="Zoom In">
                            <Lucide.Plus size={14} />
                        </button>
                    </div>
                    <button 
                        onClick={() => setAutoFit(true)}
                        className={`px-2 py-1 rounded-md text-xs font-medium transition-colors 
                            ${autoFit ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'}`}
                        title="Fit to container"
                    >
                        Fit
                    </button>
                 </div>
              </div>
              
              <div 
                ref={containerRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                // Use 'flex' and 'justify-center'/'items-center' only when autoFitting or when content is smaller than container.
                // Actually, standard flex centering works well if we use 'margin: auto' on the child for overflow safety.
                className={`flex-grow relative overflow-auto bg-gray-100 flex
                    ${!autoFit ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : ''}
                `}
              >
                 {trueWidth && trueHeight ? (
                    /* Sizer Div: Physically takes up the scaled space to force correct scrollbars */
                    <div 
                      style={{
                        width: trueWidth * scale,
                        height: trueHeight * scale,
                        margin: 'auto', // Keeps it centered if smaller than container
                        flexShrink: 0,  // Prevents it from being squished
                        position: 'relative',
                        backgroundColor: 'white',
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                        overflow: 'hidden'
                      }}
                      className={isPanning ? 'pointer-events-none' : ''}
                    >
                      {/* Scaled Content Div: sits at 0,0 of sizer and scales down/up from top-left */}
                      <div style={{
                         width: trueWidth,
                         height: trueHeight,
                         transform: `scale(${scale})`,
                         transformOrigin: 'top left', // CRITICAL fix for clipping
                         position: 'absolute',
                         top: 0, left: 0,
                      }}>
                         <LivePreview 
                           style={{ 
                             position: 'relative',
                             width: '100%', 
                             height: '100%', 
                             overflow: 'hidden'
                           }} 
                         />
                      </div>
                    </div>
                 ) : (
                   <div className="w-full h-full relative overflow-auto p-4">
                      <LivePreview style={{ width: '100%', height: '100%' }} />
                   </div>
                 )}
              </div>

              <LiveError 
                className="flex-shrink-0 max-h-[50%] overflow-auto text-xs text-red-600 bg-red-100 p-2 border-t border-red-200" 
              />
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