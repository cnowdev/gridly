import React, { useState, useEffect } from 'react';
import * as Lucide from 'lucide-react';

import GridContainer from './components/GridContainer';
import ChatBar from './components/ChatBar';
import CodeEditModal from './components/CodeEditModal';
import SettingsModal from './components/SettingsModal';
import { useGridComponents } from './utils';
import { DEFAULT_SETTINGS } from './settings'; // Import the new defaults file

export default function App() {
    const {
        components,
        placeholderLayout,
        chatPrompt,
        isLoading,
        isModalOpen,
        currentEditingCode,
        settings,
        isSettingsOpen,
        setIsSettingsOpen,
        handleSaveSettings,
        setPlaceholderLayout,
        setChatPrompt,
        setCurrentEditingCode,
        handlePromptSubmit,
        handleLayoutChange,
        handleComponentClick,
        handleModalClose,
        handleModalSave,
        handleDeleteComponent,
        handleToggleLock,
        handleCodeEdit,
    } = useGridComponents();

    const [isFirstTime, setIsFirstTime] = useState(false);

    useEffect(() => {
        const hasSeenWelcome = localStorage.getItem('hasSeenSettingsWelcome');
        if (!hasSeenWelcome) {
            setIsFirstTime(true);
            setIsSettingsOpen(true);
        }

        // --- NEW LOGIC HERE ---
        // If the settings from the hook are falsy (null, undefined, etc.),
        // it means they haven't been set yet. Let's save the defaults.
        // This will update the `settings` state within your useGridComponents hook.
        if (!settings) {
            handleSaveSettings(DEFAULT_SETTINGS);
        }
        
        // We only want this effect to check for settings on the *initial* load.
        // Adding `settings` to the dependency array would cause a re-check
        // *after* saving, which is unnecessary.
        // We also add the functions from the hook to satisfy the linter,
        // assuming they are stable (e.g., wrapped in useCallback).
    }, [setIsSettingsOpen, settings, handleSaveSettings]);

    const handleSaveSettingsWrapper = (newSettings) => {
        handleSaveSettings(newSettings);

        if (isFirstTime) {
            localStorage.setItem('hasSeenSettingsWelcome', 'true');
            setIsFirstTime(false);
        }
        setIsSettingsOpen(false);
    };

    return (
        <>
            <style>{`
        .layout {
          background-color: #111827; /* gray-900 */
          background-image: linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
          background-size: 20px 20px;
        }

        .react-grid-item > .react-resizable-handle {
          z-index: 20;
        }

        .react-draggable-dragging .live-preview-wrapper {
          pointer-events: none;
        }
      `}</style>

            <div className="h-screen w-screen flex flex-col bg-gray-900 text-white">
                <header className="flex-shrink-0 px-6 py-4 bg-gray-800 border-b border-gray-700 shadow-md z-10 flex justify-between items-center">
                    <h1 className="text-xl font-bold flex items-center gap-3">
                        <div className="p-2 bg-blue-600 rounded-lg">
                            <Lucide.LayoutGrid size={24} />
                        </div>
                        AI Grid Builder
                    </h1>
                    <button
                        onClick={() => setIsSettingsOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm font-medium hover:bg-gray-700"
                    >
                        <Lucide.Settings size={18} />
                        Settings
                    </button>
                </header>

                <main className="flex-grow overflow-auto">
                    <GridContainer
                        components={components}
                        onLayoutChange={handleLayoutChange}
                        onComponentClick={handleComponentClick}
                        onDeleteComponent={handleDeleteComponent}
                        onToggleLock={handleToggleLock}
                        placeholderLayout={placeholderLayout}
                        onPlaceholderLayoutChange={setPlaceholderLayout}
                    />
                </main>

                <ChatBar prompt={chatPrompt} setPrompt={setChatPrompt} onSubmit={handlePromptSubmit} isLoading={isLoading} />

                <CodeEditModal
                    isOpen={isModalOpen}
                    onClose={handleModalClose}
                    code={currentEditingCode}
                    setCode={setCurrentEditingCode}
                    onSave={handleModalSave}
                    onEditCode={handleCodeEdit}
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