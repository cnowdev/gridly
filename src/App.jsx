import { useRef, useEffect, useState } from 'react';
import * as Lucide from 'lucide-react';
import { motion } from 'framer-motion';

import GridContainer from './components/GridContainer';
import ChatBar from './components/ChatBar';
import CodeEditModal from './components/CodeEditModal';
import SettingsModal from './components/SettingsModal';
import ApiView from './components/ApiView';
import ApiEndpointEditModal from './components/ApiEndpointEditModal'; // 👈 NEW IMPORT
import { useGridComponents } from './utils';
import { useApiBuilder } from './hooks/useApiBuilder';
import { DEFAULT_SETTINGS } from './settings';
import PreviewGrid from './components/PreviewGrid';

function getDrawingRect(start, end, scrollTop = 0, scrollLeft = 0) {
    if (!start || !end) return { display: 'none' };
    
    const left = Math.min(start.x, end.x) - scrollLeft;
    const top = Math.min(start.y, end.y) - scrollTop;
    const width = Math.abs(start.x - end.x);
    const height = Math.abs(start.y - end.y);

    return {
        position: 'absolute',
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${height}px`,
        backgroundColor: 'rgba(71, 85, 105, 0.5)', 
        border: '2px dashed #94a3b8', 
        borderRadius: '0.5rem',
        zIndex: 40,
    };
}

export default function App() {
  // --- Frontend State ---
  const grid = useGridComponents();
  
  // --- Backend State ---
  const apiBuilder = useApiBuilder();

  const [isFirstTime, setIsFirstTime] = useState(false);
  const [activeMode, setActiveMode] = useState('frontend'); // 'frontend' | 'backend'

  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem('hasSeenSettingsWelcome');
    if (!hasSeenWelcome) {
      setIsFirstTime(true);
      grid.setIsSettingsOpen(true);
    }

    if (!grid.settings) {
      grid.handleSaveSettings(DEFAULT_SETTINGS);
    }
  }, [grid.setIsSettingsOpen, grid.settings, grid.handleSaveSettings]);

  const handleSaveSettingsWrapper = (newSettings) => {
    grid.handleSaveSettings(newSettings);
    if (isFirstTime) {
      localStorage.setItem('hasSeenSettingsWelcome', 'true');
      setIsFirstTime(false);
    }
    grid.setIsSettingsOpen(false);
  };

  const mainRef = useRef(null);
  // State to track the actual grid width for the modal
  const [currentGridWidth, setCurrentGridWidth] = useState(1200);

  useEffect(() => {
    if (!mainRef.current) return;
    // Only observe resize if we are in frontend mode to avoid errors if mainRef changes
    if (activeMode !== 'frontend') return;

    const observer = new ResizeObserver(entries => {
        if (entries[0]) {
            const width = entries[0].target.clientWidth;
            grid.setGridWidth(width);
            setCurrentGridWidth(width);
        }
    });

    observer.observe(mainRef.current);
    // Initial set
    if (mainRef.current) {
       const initialWidth = mainRef.current.clientWidth;
       grid.setGridWidth(initialWidth);
       setCurrentGridWidth(initialWidth);
    }

    return () => observer.disconnect();
  }, [grid.setGridWidth, activeMode]); // Re-run when mode changes

  // --- Unified Submit Handler ---
  const handleUnifiedSubmit = (e) => {
      if (activeMode === 'frontend') {
          grid.handlePromptSubmit(e);
      } else {
          e.preventDefault();
          if (!grid.chatPrompt.trim()) return;
          apiBuilder.generateEndpoint(grid.chatPrompt);
          grid.setChatPrompt('');
      }
  };

  // --- Unified Export Handler ---
  const handleUnifiedExport = () => {
      if (activeMode === 'frontend') {
          grid.handleExport();
      } else {
          apiBuilder.exportApiCode();
      }
  };

  const isAnyLoading = grid.isLoading || apiBuilder.isApiLoading;

  return (
    <>
       <style>{`
        .layout {
          background-color: #111827; /* gray-900 */
          background-image: linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
          background-size: 8.333333% 20px;
        }

        .react-grid-item > .react-resizable-handle {
          z-index: 20;
        }

        .react-draggable-dragging .live-preview-wrapper {
          pointer-events: none;
        }
      `}</style>

      <div className="h-screen w-screen flex flex-col bg-gray-900 text-white">
        {/* ===== Header ===== */}
        <header className="flex-shrink-0 p-4 bg-gray-800 border-b border-gray-700 shadow-md z-10 flex items-center justify-between">
          {/* Title + Mode Toggle */}
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Lucide.LayoutGrid className="text-blue-500" /> AI Grid Builder
            </h1>

            {/* Mode Toggle */}
            <div className="relative flex items-center bg-gray-700 rounded-full px-1 py-1 text-sm font-medium w-[180px]">
              <motion.div
                className="absolute top-1 bottom-1 rounded-full bg-blue-600"
                initial={false}
                animate={{
                  left: activeMode === 'frontend' ? '4px' : 'calc(50% + 2px)',
                  width: 'calc(50% - 6px)',
                }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              />
              <button
                onClick={() => setActiveMode('frontend')}
                className={`relative z-10 w-1/2 py-1.5 rounded-full transition-colors ${
                  activeMode === 'frontend' ? 'text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Frontend
              </button>
              <button
                onClick={() => setActiveMode('backend')}
                className={`relative z-10 w-1/2 py-1.5 rounded-full transition-colors ${
                  activeMode === 'backend' ? 'text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Backend
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 items-center min-w-[460px] justify-end">
            {activeMode === 'frontend' ? (
              <>
                <button
                  onClick={grid.togglePreview}
                  disabled={grid.components.length === 0}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm flex items-center gap-2 transition-colors disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed"
                  title={grid.isPreviewMode ? 'Exit Preview' : 'Preview'}
                >
                  {grid.isPreviewMode ? <Lucide.Edit size={16} /> : <Lucide.Eye size={16} />}
                  {grid.isPreviewMode ? 'Edit Mode' : 'Preview'}
                </button>

                {!grid.isPreviewMode && (
                  <button
                    onClick={grid.clearAllComponents}
                    className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-red-600 text-gray-200 hover:text-white font-medium text-sm flex items-center gap-2 transition-colors"
                    title="Clear all components"
                  >
                    <Lucide.Trash2 size={16} />
                    Clear All
                  </button>
                )}
                 
                 {/* Undo/Redo */}
                 <div className="flex items-center gap-px rounded-lg overflow-hidden bg-gray-700 ring-1 ring-gray-600 ml-2 mr-2">
                    <button
                        onClick={grid.handleUndo}
                        disabled={!grid.canUndo}
                        className="p-2 text-white hover:bg-gray-600 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
                        title="Undo (Ctrl+Z)"
                    >
                        <Lucide.Undo size={16} />
                    </button>
                    <button
                        onClick={grid.handleRedo}
                        disabled={!grid.canRedo}
                        className="p-2 text-white hover:bg-gray-600 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
                        title="Redo (Ctrl+Y)"
                    >
                        <Lucide.Redo size={16} />
                    </button>
                </div>
              </>
            ) : (
               /* Backend specific buttons could go here if needed */
               null
            )}

            <button
              onClick={handleUnifiedExport}
              disabled={activeMode === 'frontend' ? grid.components.length === 0 : (apiBuilder.endpoints.length === 0 && !apiBuilder.baseServerCode)}
              className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-green-600 text-gray-200 hover:text-white font-medium text-sm flex items-center gap-2 transition-colors disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed"
              title={activeMode === 'frontend' ? "Export as JSX" : "Export as server.js"}
            >
              <Lucide.Download size={16} />
              {activeMode === 'frontend' ? 'Export JSX' : 'Export API'}
            </button>

            <button
              onClick={() => grid.setIsSettingsOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 hover:text-white font-medium text-sm flex items-center gap-2 transition-colors"
            >
              <Lucide.Settings size={16} />
              Settings
            </button>
          </div>
        </header>

        {/* ===== Main Content Area ===== */}
        <main
          ref={mainRef}
          // Only attach grid handlers in frontend mode
          onMouseDown={activeMode === 'frontend' ? grid.handleGridMouseDown : undefined}
          onMouseMove={activeMode === 'frontend' ? grid.handleGridMouseMove : undefined}
          onMouseUp={activeMode === 'frontend' ? grid.handleGridMouseUp : undefined}
          onMouseLeave={activeMode === 'frontend' ? grid.handleGridMouseUp : undefined}
          className="flex-grow overflow-auto relative"
        >
          {activeMode === 'frontend' ? (
             grid.isPreviewMode ? (
                <PreviewGrid components={grid.components} settings={grid.settings} />
             ) : (
                <>
                  <GridContainer
                    components={grid.components}
                    onLayoutChange={grid.handleLayoutChange}
                    onDeleteComponent={grid.handleDeleteComponent}
                    openEditModal={grid.openEditModal}
                    onToggleLock={grid.handleToggleLock}
                    placeholderLayout={grid.placeholderLayout}
                    onPlaceholderLayoutChange={grid.setPlaceholderLayout}
                    showPlaceholder={grid.showPlaceholder}
                    onCancelPlaceholder={grid.handleCancelPlaceholder}
                    onDuplicateComponent={grid.handleDuplicateComponent}
                  />
                  {grid.isDrawing && mainRef.current && (
                    <div
                      style={getDrawingRect(
                        grid.drawStart,
                        grid.drawEnd,
                        mainRef.current?.scrollTop ?? 0,
                        mainRef.current?.scrollLeft ?? 0
                      )}
                    />
                  )}
                </>
             )
          ) : (
             /* Backend Mode View */
             <ApiView apiState={apiBuilder} />
          )}
        </main>

        {/* Chat Bar - Hidden in Preview Mode, visible in both Edit Frontend & Backend */}
        {!(activeMode === 'frontend' && grid.isPreviewMode) && (
          <ChatBar
            prompt={grid.chatPrompt}
            setPrompt={grid.setChatPrompt}
            onSubmit={handleUnifiedSubmit}
            isLoading={isAnyLoading}
          />
        )}

        {/* Modals */}
        <CodeEditModal
          isOpen={grid.isModalOpen}
          onClose={grid.handleModalClose}
          code={grid.currentEditingCode}
          setCode={grid.setCurrentEditingCode}
          onSave={grid.handleModalSave}
          onEditCode={grid.handleCodeEdit}
          layout={grid.currentEditingLayout}
          gridWidth={currentGridWidth}
        />

        {/* NEW MODAL FOR API EDITING */}
        <ApiEndpointEditModal 
            isOpen={apiBuilder.isEditModalOpen}
            onClose={apiBuilder.closeEditModal}
            code={apiBuilder.currentEditingCode}
            setCode={apiBuilder.setCurrentEditingCode}
            onSave={apiBuilder.saveAndValidateEndpoint}
            onChatEdit={apiBuilder.editEndpointAi}
            isAiLoading={apiBuilder.isApiLoading}
        />

        <SettingsModal
          isOpen={grid.isSettingsOpen}
          onClose={() => grid.setIsSettingsOpen(false)}
          settings={grid.settings || DEFAULT_SETTINGS}
          onSave={handleSaveSettingsWrapper}
          isFirstTime={isFirstTime}
        />
      </div>
    </>
  );
}