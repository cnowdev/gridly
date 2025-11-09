import { useRef, useEffect, useState } from 'react';
import Header from './components/Header';

import GridContainer from './components/GridContainer';
import ChatBar from './components/ChatBar';
import CodeEditModal from './components/CodeEditModal';
import SettingsModal from './components/SettingsModal';
import ApiView from './components/ApiView';
import ApiEndpointEditModal from './components/ApiEndpointEditModal';
import BaseServerEditModal from './components/BaseServerEditModal';
import MergedPreview from './components/MergedPreview';
import { useGridComponents } from './hooks/useGridComponents'
import { useApiBuilder } from './hooks/useApiBuilder';
import { DEFAULT_SETTINGS } from './settings';
import PreviewGrid from './components/PreviewGrid';
// Import the new merged export handler
import { handleMergedExport } from './services/exportService';
import * as Lucide from 'lucide-react';

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
  const [activeMode, setActiveMode] = useState('frontend');
  const [isApiViewOpen, setIsApiViewOpen] = useState(false);
  // NEW: State for tracking merged export progress
  const [exportProgress, setExportProgress] = useState(null);

  // Auto-integrate when entering merged mode
  useEffect(() => {
    if (activeMode === 'merged' && grid.components.length > 0 && apiBuilder.endpoints.length > 0) {
      if (grid.mergedComponents.length === 0) {
        grid.handleIntegrateWithAPI(apiBuilder.endpoints);
      }
    }
  }, [activeMode]);

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
  const [currentGridWidth, setCurrentGridWidth] = useState(1200);

  useEffect(() => {
    if (!mainRef.current) return;
    if (activeMode !== 'frontend') return;

    const observer = new ResizeObserver(entries => {
        if (entries[0]) {
            const width = entries[0].target.clientWidth;
            grid.setGridWidth(width);
            setCurrentGridWidth(width);
        }
    });

    observer.observe(mainRef.current);
    if (mainRef.current) {
       const initialWidth = mainRef.current.clientWidth;
       grid.setGridWidth(initialWidth);
       setCurrentGridWidth(initialWidth);
    }

    return () => observer.disconnect();
  }, [grid.setGridWidth, activeMode]);

  // --- Unified Submit Handler ---
  const handleUnifiedSubmit = (e) => {
      if (activeMode === 'frontend') {
          grid.handlePromptSubmit(e);
      } else if (activeMode === 'backend') {
          e.preventDefault();
          if (!grid.chatPrompt.trim()) return;
          apiBuilder.generateEndpoint(grid.chatPrompt);
          grid.setChatPrompt('');
      }
  };

  // --- Unified Export Handler ---
  const handleUnifiedExport = async () => {
      if (activeMode === 'frontend') {
          grid.handleExport(grid.components, grid.settings);
      } else if (activeMode === 'backend') {
          apiBuilder.exportApiCode();
      } else if (activeMode === 'merged') {
          // Use the latest merged components if available, otherwise fallback to standard
          const componentsToExport = grid.mergedComponents.length > 0 ? grid.mergedComponents : grid.components;
          
          // Get fresh server code
          const serverCode = apiBuilder.generateServerCode();

          // Run the merged export
          await handleMergedExport(
              componentsToExport, 
              serverCode, 
              grid.settings, 
              setExportProgress // Pass setter to update progress UI
          );
      }
  };

  const isAnyLoading = grid.isLoading || apiBuilder.isApiLoading || grid.isMergedIntegrating;

  return (
    <>
       <style>{`
        .layout {
          background-color: #111827;
          background-image: linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
          background-size: 4.1666667% 20px;
        }
        .react-grid-item > .react-resizable-handle { z-index: 20; }
        .react-draggable-dragging .live-preview-wrapper { pointer-events: none; }
      `}</style>

      {/* --- EXPORT PROGRESS OVERLAY --- */}
      {exportProgress && (
          <div className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center flex-col gap-4">
              <Lucide.Loader2 size={48} className="text-blue-500 animate-spin" />
              <p className="text-xl font-semibold text-white">{exportProgress}</p>
              <p className="text-sm text-gray-400">This may take a minute...</p>
          </div>
      )}

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
            isExporting={!!exportProgress} // Pass down loading state
        />

        {/* ===== Main Content Area ===== */}
        <main
          ref={mainRef}
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
          ) : activeMode === 'backend' ? (
             <ApiView apiState={apiBuilder} />
          ) : activeMode === 'merged' ? (
             <MergedPreview 
               components={grid.mergedComponents.length > 0 ? grid.mergedComponents : grid.components}
               settings={grid.settings}
               endpoints={apiBuilder.endpoints}
               onUpdateComponents={() => grid.handleIntegrateWithAPI(apiBuilder.endpoints)}
               isUpdating={grid.isMergedIntegrating}
               testEndpoint={apiBuilder.testEndpoint}
               onEditComponent={grid.openEditModal}
             />
          ) : null}
        </main>

        {/* Chat Bar */}
        {!(activeMode === 'frontend' && grid.isPreviewMode) && activeMode !== 'merged' && (
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
        <ApiEndpointEditModal 
            isOpen={apiBuilder.isEditModalOpen}
            onClose={apiBuilder.closeEditModal}
            code={apiBuilder.currentEditingCode}
            setCode={apiBuilder.setCurrentEditingCode}
            onSave={apiBuilder.saveAndValidateEndpoint}
            onChatEdit={apiBuilder.editEndpointAi}
            isAiLoading={apiBuilder.isApiLoading}
        />
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