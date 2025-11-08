import { useRef, useEffect, useState } from 'react';
import * as Lucide from 'lucide-react';

import GridContainer from './components/GridContainer';
import ChatBar from './components/ChatBar';
import CodeEditModal from './components/CodeEditModal';
import SettingsModal from './components/SettingsModal';
import { useGridComponents } from './utils';
import { DEFAULT_SETTINGS } from './settings';
import PreviewGrid from './components/PreviewGrid';

// ... (getDrawingRect helper remains the same) ...
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
    } = useGridComponents();
    
    // ... (rest of the component hooks remain the same) ...
    const [isFirstTime, setIsFirstTime] = useState(false);

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
    
    // We need to capture the actual current gridWidth to pass it down
    const [currentGridWidth, setCurrentGridWidth] = useState(1200);

    useEffect(() => {
        if (!mainRef.current) return;

        const observer = new ResizeObserver(entries => {
            if (entries[0]) {
                const width = entries[0].target.clientWidth;
                setGridWidth(width);
                setCurrentGridWidth(width); // Keep local state updated too
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
          background-color: #111827; /* gray-900 */
          background-image: linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
          background-size: 8.333333% 20px;
        }
        /* ... other styles ... */
        .react-grid-item > .react-resizable-handle {
          z-index: 20;
        }

        .react-draggable-dragging .live-preview-wrapper {
          pointer-events: none;
        }
      `}</style>

            <div className="h-screen w-screen flex flex-col bg-gray-900 text-white">
                {/* ... Header ... */}
                <header className="flex-shrink-0 p-4 bg-gray-800 border-b border-gray-700 shadow-md z-10 flex items-center justify-between">
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <Lucide.LayoutGrid /> AI Grid Builder
                    </h1>
                    <div className="flex gap-2">
                        <button
                            onClick={togglePreview}
                            disabled={components.length === 0}
                            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium text-sm flex items-center gap-2 transition-colors"
                            title={isPreviewMode ? "Exit Preview" : "Preview"}
                        >
                            {isPreviewMode ? <Lucide.Edit size={16} /> : <Lucide.Eye size={16} />}
                            {isPreviewMode ? 'Edit Mode' : 'Preview'}
                        </button>
                        <button
                            onClick={clearAllComponents}
                            className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium text-sm flex items-center gap-2 transition-colors"
                            title="Clear all components"
                        >
                            <Lucide.Trash2 size={16} />
                            Clear All
                        </button>
                        <button
                            onClick={handleExport}
                            disabled={components.length === 0}
                            className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium text-sm flex items-center gap-2 transition-colors"
                            title="Export as JSX"
                        >
                            <Lucide.Download size={16} />
                            Export JSX
                        </button>

                        <button
                          onClick={() => setIsSettingsOpen(true)}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm font-medium hover:bg-gray-700"
                        >
                        <Lucide.Settings size={18} />
                        Settings
                    </button>
                    </div>
                </header>

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
                        />

                        {isDrawing && mainRef.current && (
                            <div style={getDrawingRect(
                                drawStart, 
                                drawEnd, 
                                mainRef.current?.scrollTop ?? 0, 
                                mainRef.current?.scrollLeft ?? 0
                            )} />
                        )}
                        </>
                    )}
                </main>

                {!isPreviewMode && (
                    <ChatBar prompt={chatPrompt} setPrompt={setChatPrompt} onSubmit={handlePromptSubmit} isLoading={isLoading} />
                )}

                <CodeEditModal
                    isOpen={isModalOpen}
                    onClose={handleModalClose}
                    code={currentEditingCode}
                    setCode={setCurrentEditingCode}
                    onSave={handleModalSave}
                    onEditCode={handleCodeEdit}
                    layout={currentEditingLayout}
                    gridWidth={currentGridWidth} // NEW: Pass the actual grid width
                />

                <SettingsModal
                    isOpen={isSettingsOpen}
                    onClose={() => setIsSettingsOpen(false)}
                    settings={settings || DEFAULT_SETTINGS}
                    onSave={handleSaveSettingsWrapper} 
                    isFirstTime={isFirstTime} 
                />
            </div>
        </>
    );
}