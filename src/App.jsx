import { useRef, useEffect, useState } from 'react';
import Header from './components/Header';

import GridContainer from './components/GridContainer';
import ChatBar from './components/ChatBar';
import CodeEditModal from './components/CodeEditModal';
import SettingsModal from './components/SettingsModal';
import ApiView from './components/ApiView';
import ApiEndpointEditModal from './components/ApiEndpointEditModal';
import BaseServerEditModal from './components/BaseServerEditModal'; // 👈 Make sure this is imported
import { useGridComponents } from './hooks/useGridComponents'
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
  const [isApiViewOpen, setIsApiViewOpen] = useState(false);

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
          background-size: 4.1666667% 20px;
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
        <Header 
            activeMode={activeMode}
            setActiveMode={setActiveMode}
            togglePreview={grid.togglePreview}
            isPreviewMode={grid.isPreviewMode}
            components={grid.components}
            clearAllComponents={grid.clearAllComponents}
            handleExport={handleUnifiedExport}
            handleUndo={grid.handleUndo}
            canUndo={grid.canUndo}
            handleRedo={grid.handleRedo}
            canRedo={grid.canRedo}
            setIsSettingsOpen={grid.setIsSettingsOpen}
            setIsApiViewOpen={setIsApiViewOpen}
        />

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

        {/* API ENDPOINT EDIT MODAL */}
        <ApiEndpointEditModal 
            isOpen={apiBuilder.isEditModalOpen}
            onClose={apiBuilder.closeEditModal}
            code={apiBuilder.currentEditingCode}
            setCode={apiBuilder.setCurrentEditingCode}
            onSave={apiBuilder.saveAndValidateEndpoint}
            onChatEdit={apiBuilder.editEndpointAi}
            isAiLoading={apiBuilder.isApiLoading}
        />

        {/* --- FIX: ADDED MISSING BASE SERVER MODAL --- */}
        <BaseServerEditModal 
            isOpen={apiBuilder.isBaseEditModalOpen}
            onClose={apiBuilder.closeBaseEditModal}
            code={apiBuilder.currentEditingBaseCode}
            setCode={apiBuilder.setCurrentEditingBaseCode}
            onSave={apiBuilder.saveBaseEditModal}
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