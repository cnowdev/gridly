import { useRef, useEffect, useState } from 'react';
import Header from './components/Header';

import GridContainer from './components/GridContainer';
import ChatBar from './components/ChatBar';
import CodeEditModal from './components/CodeEditModal';
import SettingsModal from './components/SettingsModal';
import ApiView from './components/ApiView';
import { useGridComponents } from './hooks/useGridComponents'
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
  const {
    components,
    placeholderLayout,
    chatPrompt,
    isLoading,
    isModalOpen,
    currentEditingCode,
    currentEditingLayout,
    settings,
    isSettingsOpen,
    setIsSettingsOpen,
    handleSaveSettings,
    isDrawing,
    drawStart,
    drawEnd,
    showPlaceholder,
    isPreviewMode,
    setPlaceholderLayout,
    setChatPrompt,
    setCurrentEditingCode,
    setGridWidth,
    handlePromptSubmit,
    handleLayoutChange,
    openEditModal,
    handleModalClose,
    handleModalSave,
    handleDeleteComponent,
    handleToggleLock,
    handleCodeEdit,
    clearAllComponents,
    handleExport,
    handleGridMouseDown,
    handleGridMouseMove,
    handleGridMouseUp,
    togglePreview,
    handleCancelPlaceholder,
    handleDuplicateComponent,
    handleUndo,
    handleRedo,
    canUndo,
    canRedo,
  } = useGridComponents();

  const [isFirstTime, setIsFirstTime] = useState(false);
  const [activeMode, setActiveMode] = useState('frontend');
  const [isApiViewOpen, setIsApiViewOpen] = useState(false);

  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem('hasSeenSettingsWelcome');
    if (!hasSeenWelcome) {
      setIsFirstTime(true);
      setIsSettingsOpen(true);
    }

    if (!settings) {
      handleSaveSettings(DEFAULT_SETTINGS);
    }
  }, [setIsSettingsOpen, settings, handleSaveSettings]);

  const handleSaveSettingsWrapper = (newSettings) => {
    handleSaveSettings(newSettings);
    if (isFirstTime) {
      localStorage.setItem('hasSeenSettingsWelcome', 'true');
      setIsFirstTime(false);
    }
    setIsSettingsOpen(false);
  };

  const mainRef = useRef(null);
  const [currentGridWidth, setCurrentGridWidth] = useState(1200);

  useEffect(() => {
    if (!mainRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        const width = entries[0].target.clientWidth;
        setGridWidth(width);
        setCurrentGridWidth(width);
      }
    });
    observer.observe(mainRef.current);
    const initialWidth = mainRef.current.clientWidth;
    setGridWidth(initialWidth);
    setCurrentGridWidth(initialWidth);
    return () => observer.disconnect();
  }, [setGridWidth]);

  return (
    <>
      <style>{`
        .layout {
          background-color: #111827;
          background-image: linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
          background-size: 8.333333% 20px;
        }
      `}</style>

      <div className="h-screen w-screen flex flex-col bg-gray-900 text-white">
        {/* ===== Header ===== */}
        <Header 
            activeMode={activeMode}
            setActiveMode={setActiveMode}
            togglePreview={togglePreview}
            isPreviewMode={isPreviewMode}
            components={components}
            clearAllComponents={clearAllComponents}
            handleExport={handleExport}
            handleUndo={handleUndo}
            canUndo={canUndo}
            handleRedo={handleRedo}
            canRedo={canRedo}
            setIsSettingsOpen={setIsSettingsOpen}
            setIsApiViewOpen={setIsApiViewOpen}
        />

        {/* ===== Main Grid ===== */}
        <main
          ref={mainRef}
          onMouseDown={handleGridMouseDown}
          onMouseMove={handleGridMouseMove}
          onMouseUp={handleGridMouseUp}
          onMouseLeave={handleGridMouseUp}
          className="flex-grow overflow-auto relative"
        >
          {isPreviewMode ? (
            <PreviewGrid components={components} />
          ) : (
            <>
              <GridContainer
                components={components}
                onLayoutChange={handleLayoutChange}
                onDeleteComponent={handleDeleteComponent}
                openEditModal={openEditModal}
                onToggleLock={handleToggleLock}
                placeholderLayout={placeholderLayout}
                onPlaceholderLayoutChange={setPlaceholderLayout}
                showPlaceholder={showPlaceholder}
                onCancelPlaceholder={handleCancelPlaceholder}
                onDuplicateComponent={handleDuplicateComponent}
              />
              {isDrawing && mainRef.current && (
                <div
                  style={getDrawingRect(
                    drawStart,
                    drawEnd,
                    mainRef.current?.scrollTop ?? 0,
                    mainRef.current?.scrollLeft ?? 0
                  )}
                />
              )}
            </>
          )}
        </main>

        {!isPreviewMode && (
          <ChatBar
            prompt={chatPrompt}
            setPrompt={setChatPrompt}
            onSubmit={handlePromptSubmit}
            isLoading={isLoading}
          />
        )}

        <CodeEditModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          code={currentEditingCode}
          setCode={setCurrentEditingCode}
          onSave={handleModalSave}
          onEditCode={handleCodeEdit}
          layout={currentEditingLayout}
          gridWidth={currentGridWidth}
        />

        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          settings={settings || DEFAULT_SETTINGS}
          onSave={handleSaveSettingsWrapper}
          isFirstTime={isFirstTime}
        />

        <ApiView isOpen={isApiViewOpen} onClose={() => setIsApiViewOpen(false)} />
      </div>
    </>
  );
}
