import * as Lucide from 'lucide-react';
import { motion } from 'framer-motion';

export default function Header({activeMode, setActiveMode, togglePreview, isPreviewMode, components, clearAllComponents, handleExport, handleUndo, canUndo, handleRedo, canRedo, setIsSettingsOpen, setIsApiViewOpen}) {
    return (
        <header className="flex-shrink-0 p-4 bg-gray-800 border-b border-gray-700 shadow-md z-10 flex items-center justify-between">
            {/* ===== Title + Mode Toggle ===== */}
            <div className="flex items-center gap-4">
                <img src="/gridly.svg" alt="Gridly Logo" className="h-7" />

                {/* <h1 className="text-xl font-bold flex items-center gap-2"> gridly </h1> */}

                {/* ===== Animated Mode Toggle (3 options) ===== */}
                <div className="relative flex items-center bg-gray-700 rounded-full px-1 py-1 text-sm font-medium w-[270px]">
                    <motion.div
                        className="absolute top-1 bottom-1 rounded-full bg-blue-600"
                        initial={false}
                        animate={{
                            left: activeMode === 'frontend' ? '4px' : 
                                  activeMode === 'backend' ? 'calc(33.333% + 2px)' : 
                                  'calc(66.666% + 0px)',
                            width: 'calc(33.333% - 6px)',
                        }}
                        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    />
                    <button
                        onClick={() => setActiveMode('frontend')}
                        className={`relative z-10 w-1/3 py-1.5 rounded-full transition-colors ${
                            activeMode === 'frontend' ? 'text-white' : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        Frontend
                    </button>
                    <button
                        onClick={() => setActiveMode('backend')}
                        className={`relative z-10 w-1/3 py-1.5 rounded-full transition-colors ${
                            activeMode === 'backend' ? 'text-white' : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        Backend
                    </button>
                    <button
                        onClick={() => setActiveMode('merged')}
                        className={`relative z-10 w-1/3 py-1.5 rounded-full transition-colors ${
                            activeMode === 'merged' ? 'text-white' : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        Merged
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
                ) : activeMode === 'merged' ? (
                    <>
                        <button
                            onClick={handleExport}
                            disabled={components.length === 0}
                            className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed text-white font-medium text-sm flex items-center gap-2 transition-colors"
                            title="Export Merged Project (Coming Soon)"
                        >
                            <Lucide.PackageOpen size={16} />
                            Export Full Project
                        </button>
                    </>
                ) : (
                    <></>
                )}
            </div>
        </header>
    )
}
