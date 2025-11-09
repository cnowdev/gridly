import { useRef, useEffect, useState } from 'react';
import * as Lucide from 'lucide-react';
import { motion } from 'framer-motion'; // 👈 NEW for animation

import GridContainer from './components/GridContainer';
import ChatBar from './components/ChatBar';
import CodeEditModal from './components/CodeEditModal';
import SettingsModal from './components/SettingsModal';
import ApiView from './components/ApiView';
import { useGridComponents } from './utils';
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
        <header className="flex-shrink-0 p-4 bg-gray-800 border-b border-gray-700 shadow-md z-10 flex items-center justify-between">
          {/* ===== Title + Mode Toggle ===== */}
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Lucide.LayoutGrid className="text-blue-500" /> AI Grid Builder
            </h1>

            {/* ===== Animated Mode Toggle ===== */}
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

          {/* ===== Buttons Area ===== */}
          <div className="flex gap-2 items-center min-w-[460px] justify-end">
            {activeMode === 'frontend' ? (
              <>
                <button
                  onClick={togglePreview}
                  disabled={components.length === 0}
                  className="px-3 py-1.5 rounded-lg hover:bg-blue-500 text-white font-medium text-sm flex items-center gap-2 transition-colors disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed"
                  title={isPreviewMode ? 'Exit Preview' : 'Preview'}
                >
                  {isPreviewMode ? <Lucide.Edit size={16} /> : <Lucide.Eye size={16} />}
                  {isPreviewMode ? 'Edit Mode' : 'Preview'}
                </button>

                {!isPreviewMode && (
                  <button
                    onClick={clearAllComponents}
                    className="px-3 py-1.5 rounded-lg hover:bg-red-600 text-gray-200 hover:text-white font-medium text-sm flex items-center gap-2 transition-colors"
                    title="Clear all components"
                  >
                    <Lucide.Trash2 size={16} />
                    Clear All
                  </button>
                )}

                <button
                  onClick={handleExport}
                  disabled={components.length === 0}
                  className="px-3 py-1.5 rounded-lg hover:bg-green-600 text-gray-200 hover:text-white font-medium text-sm flex items-center gap-2 transition-colors disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed"
                  title="Export as JSX"
                >
                    {isPreviewMode ? (
                        <PreviewGrid components={components} settings={settings} />
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
                  <Lucide.Download size={16} />
                  Export JSX
                </button>

                <div className="flex items-center gap-px rounded-lg overflow-hidden bg-gray-700 ring-1 ring-gray-600">
                  <button
                    onClick={handleUndo}
                    disabled={!canUndo}
                    className="p-2 text-white hover:bg-gray-600 disabled:text-gray-500 disabled:cursor-not-allowed"
                    title="Undo (Ctrl+Z)"
                  >
                    <Lucide.Undo size={18} />
                  </button>
                  <button
                    onClick={handleRedo}
                    disabled={!canRedo}
                    className="p-2 text-white hover:bg-gray-600 disabled:text-gray-500 disabled:cursor-not-allowed"
                    title="Redo (Ctrl+Y)"
                  >
                    <Lucide.Redo size={18} />
                  </button>
                </div>

                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="px-3 py-1.5 rounded-lg hover:bg-gray-600 text-gray-200 hover:text-white font-medium text-sm flex items-center gap-2 transition-colors"
                >
                  <Lucide.Settings size={16} />
                  Settings
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsApiViewOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm flex items-center gap-2 transition-colors"
              >
                <Lucide.Server size={16} />
                API View
              </button>
            )}
          </div>
        </header>

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
