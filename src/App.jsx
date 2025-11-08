import * as Lucide from 'lucide-react';

import GridContainer from './components/GridContainer';
import ChatBar from './components/ChatBar';
import CodeEditModal from './components/CodeEditModal';
import { useGridComponents } from './utils';

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
        handleComponentClick,
        handleModalClose,
        handleModalSave,
        handleDeleteComponent,
        handleToggleLock,
        handleCodeEdit,
    } = useGridComponents();

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
                <header className="flex-shrink-0 p-4 bg-gray-800 border-b border-gray-700 shadow-md z-10">
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <Lucide.LayoutGrid /> AI Grid Builder
                    </h1>
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

                <CodeEditModal isOpen={isModalOpen} onClose={handleModalClose} code={currentEditingCode} setCode={setCurrentEditingCode} onSave={handleModalSave} onEditCode={handleCodeEdit} />
            </div>
        </>
    );
}