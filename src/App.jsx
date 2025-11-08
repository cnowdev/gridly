import * as Lucide from 'lucide-react';

import GridContainer from './components/GridContainer';
import ChatBar from './components/ChatBar';
import CodeEditModal from './components/CodeEditModal';
import { useGridComponents } from './utils';
import ExportedGrid from './ExportedGrid';

export default function App() {

    const {
        components,
        placeholderLayout,
        chatPrompt,
        isLoading,
        isModalOpen,
        currentEditingCode,
        setPlaceholderLayout,
        setChatPrompt,
        setCurrentEditingCode,
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
    } = useGridComponents();
    
    // return (
    //     <ExportedGrid/>
    // )

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
                <header className="flex-shrink-0 p-4 bg-gray-800 border-b border-gray-700 shadow-md z-10 flex items-center justify-between">
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <Lucide.LayoutGrid /> AI Grid Builder
                    </h1>
                    <div className="flex gap-2">
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
                    </div>
                </header>

                <main className="flex-grow overflow-auto">
                    <GridContainer
                        components={components}
                        onLayoutChange={handleLayoutChange}
                        onDeleteComponent={handleDeleteComponent}
                        openEditModal={openEditModal}
                        onToggleLock={handleToggleLock}
                        placeholderLayout={placeholderLayout}
                        onPlaceholderLayoutChange={setPlaceholderLayout}
                    />
                </main>

                <ChatBar prompt={chatPrompt} setPrompt={setChatPrompt} onSubmit={handlePromptSubmit} isLoading={isLoading} />

                <CodeEditModal isOpen={isModalOpen} onClose={handleModalClose} code={currentEditingCode} setCode={setCurrentEditingCode} onSave={handleModalSave} onEditCode={handleCodeEdit} />
            </div>
        </>
    );
}