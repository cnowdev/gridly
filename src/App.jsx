// --- FIX 1: Import all the hooks we want to support ---
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import { LiveProvider, LiveEditor, LivePreview, LiveError } from 'react-live';
import * as Lucide from 'lucide-react';
import { GoogleGenerativeAI } from "@google/generative-ai";

// Make RGL responsive
const ResponsiveGridLayout = WidthProvider(Responsive);

// ⚠️ IMPORTANT: Use your .env file
const API_KEY = import.meta.env.VITE_API_KEY;

// Initialize the Google AI Client
const genAI = new GoogleGenerativeAI(API_KEY);
// Note: Using the model you specified in memory
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });


// --- Components ---

/**
 * 1. The main grid component
 * -- THIS SECTION IS UPDATED --
 */
function GridContainer({
  components,
  onLayoutChange,
  onComponentClick,
  onDeleteComponent,
  onToggleLock,
  placeholderLayout,
  onPlaceholderLayoutChange,
}) {
  const renderPlaceholder = () => (
    <div
      key="placeholder"
      className="bg-slate-800 rounded-lg border-2 border-dashed border-slate-500
                 flex items-center justify-center text-slate-500 cursor-move h-full w-full"
    >
      <div className="text-center">
        <Lucide.PlusCircle size={24} className="mx-auto" />
        <p className="font-medium">New Component</p>
        <p className="text-xs">Drag and resize me</p>
      </div>
    </div>
  );

  return (
    <ResponsiveGridLayout
      className="layout h-full min-h-full"
      layouts={{ lg: [...components.map(c => c.layout), placeholderLayout] }}
      breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
      cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
      rowHeight={100}
      onLayoutChange={(layout) => {
        const realComponentLayouts = layout.filter((l) => l.i !== 'placeholder');
        const placeholder = layout.find((l) => l.i === 'placeholder');
        
        onLayoutChange(realComponentLayouts);
        onPlaceholderLayoutChange(placeholder);
      }}
      draggableCancel=".no-drag"
      compactType={null}

      // --- THIS IS THE FIX ---
      // This stops components from moving over or pushing other components
      preventCollision={true}
    >
      {/* Render real components */}
      {components.map((comp) => (
        <div
          key={comp.id}
          data-grid={{
            ...comp.layout,
            isDraggable: !comp.isLocked,
            isResizable: !comp.isLocked,
          }}
          className={`relative group bg-gray-700 rounded-lg ring-1 ring-gray-600 shadow-lg
                      ${comp.isLocked ? 'ring-2 ring-blue-500' : ''}`}
        >
          <div className="h-full w-full">
            <DynamicComponent code={comp.code} />
          </div>

          <div
            className="absolute top-2 right-2 z-10
                       opacity-0 group-hover:opacity-100
                       transition-opacity"
          >
            <div className="flex gap-1 no-drag pointer-events-auto">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleLock(comp.id);
                }}
                className={`p-1.5 bg-gray-800/70 text-white rounded-md
                           hover:text-white transition-colors
                           ${comp.isLocked ? 'hover:bg-blue-500' : 'hover:bg-yellow-600'}`}
                title={comp.isLocked ? "Unlock" : "Lock"}
              >
                {comp.isLocked ? <Lucide.Unlock size={16} /> : <Lucide.Lock size={16} />}
              </button>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onComponentClick(comp);
                }}
                className="p-1.5 bg-gray-800/70 text-white rounded-md
                           hover:bg-blue-600 hover:text-white transition-colors"
                title="Edit Component"
              >
                <Lucide.Pencil size={16} />
              </button>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteComponent(comp.id);
                }}
                className="p-1.5 bg-gray-800/70 text-white rounded-md
                           hover:bg-red-600 hover:text-white transition-colors"
                title="Delete Component"
              >
                <Lucide.Trash2 size={16} />
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* Render placeholder */}
      <div key="placeholder" data-grid={placeholderLayout}>
        {renderPlaceholder()}
      </div>
    </ResponsiveGridLayout>
  );
}

/**
 * 2. The Chat Bar
 */
function ChatBar({ prompt, setPrompt, onSubmit, isLoading }) {
  // ... (This component is unchanged)
  return (
    <form
      onSubmit={onSubmit}
      className="flex-shrink-0 p-4 bg-gray-800 border-t border-gray-700 flex items-center gap-4"
    >
      <Lucide.MessageSquare className="text-gray-400" />
      <input
        type="text"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="e.g., 'A modern login form with a blue login button'"
        className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        disabled={isLoading}
      />
      <button
        type="submit"
        disabled={isLoading}
        className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
      >
        {isLoading ? (
          <Lucide.Loader2 className="animate-spin" size={20} />
        ) : (
          <Lucide.Send size={20} />
        )}
        Generate
      </button>
    </form>
  );
}


/**
 * 3. The Code Editor Modal
 */
function CodeEditModal({ isOpen, onClose, code, setCode, onSave, onEditCode }) {
  const [chatPrompt, setChatPrompt] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  if (!isOpen) return null;

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatPrompt || isEditing) return;

    setIsEditing(true);
    try {
      const newCode = await onEditCode(code, chatPrompt);
      if (newCode) {
        setCode(newCode); 
      }
      setChatPrompt('');
    } catch (error) {
      console.error("Failed to edit code:", error);
    }
    setIsEditing(false);
  };

  const scope = {
    React,
    useState,
    useEffect,
    useCallback,
    useRef,
    ...Lucide,
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-10">
      <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl h-full max-h-[80vh] flex flex-col overflow-hidden ring-1 ring-gray-700">
        {/* Header */}
        <div className="flex-shrink-0 flex justify-between items-center p-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">Edit Component Code</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <Lucide.X size={24} />
          </button>
        </div>

        {/* Editor & Preview */}
        <LiveProvider code={code} scope={scope}>
          <div className="flex-grow grid grid-cols-2 gap-px bg-gray-700 overflow-hidden">
            {/* Editor */}
            <div className="flex flex-col h-full overflow-hidden bg-gray-900">
              <div className="flex-shrink-0 p-2 text-xs font-mono text-gray-400 border-b border-gray-700">
                Live Editor
              </div>
              <div className="flex-grow overflow-auto">
                <LiveEditor
                  onChange={setCode}
                  className="text-sm !bg-gray-900"
                  style={{
                    fontFamily: '"Fira code", "Fira Mono", monospace',
                    minHeight: '100%',
                  }}
                  padding={16}
                />
              </div>
            </div>
            {/* Preview */}
            <div className="flex flex-col h-full overflow-hidden bg-white">
              <div className="flex-shrink-0 p-2 text-xs font-mono text-gray-500 bg-gray-100 border-b border-gray-300">
                Live Preview
              </div>
              {/* --- FIX: Removed 'p-4' from this div --- */}
              <div className="flex-grow overflow-auto">
                <LivePreview className="h-full w-full" />
              </div>
              <div className="flex-shrink-0 p-2 border-t border-gray-300 bg-gray-100 min-h-[50px]">
                <LiveError className="text-xs text-red-600 bg-red-100 p-2 rounded" />
              </div>
            </div>
          </div>
        </LiveProvider>

        {/* Updated Footer */}
        <div className="flex-shrink-0 flex justify-between items-center gap-4 p-4 border-t border-gray-700">
          {/* Chat bar on the left */}
          <form onSubmit={handleChatSubmit} className="flex-grow flex items-center gap-2">
            <input
              type="text"
              value={chatPrompt}
              onChange={(e) => setChatPrompt(e.target.value)}
              placeholder="e.g., 'Make the button red' or 'Add an email icon'"
              className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isEditing}
            />
            <button
              type="submit"
              disabled={isEditing}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-medium px-3 py-1.5 rounded-lg text-sm flex items-center gap-2"
            >
              {isEditing ? (
                <Lucide.Loader2 className="animate-spin" size={16} />
              ) : (
                <Lucide.Sparkles size={16} />
              )}
              Edit
            </button>
          </form>
          
          {/* Existing buttons on the right */}
          <div className="flex-shrink-0 flex gap-4">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-500 text-white font-medium"
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 4. The Dynamic Component Renderer
 */
const DynamicComponent = ({ code, onClick }) => {
  // --- FIX 3: Add all hooks to the LiveProvider scope ---
  const scope = {
    React,
    useState,
    useEffect,
    useCallback,
    useRef,
    ...Lucide,
  };
  
  return (
    <LiveProvider code={code} scope={scope}>
      <div onClick={onClick} className="h-full w-full">
        <div className="h-full w-full overflow-auto live-preview-wrapper">
          <LivePreview className="h-full w-full" />
        </div>
      </div>
      <LiveError className="hidden" />
    </LiveProvider>
  );
};


// --- Main App Component ---

export default function App() {
  const [components, setComponents] = useState([]);
  const [placeholderLayout, setPlaceholderLayout] = useState({
    i: 'placeholder',
    x: 0,
    y: 0,
    w: 4,
    h: 2,
  });
  const [chatPrompt, setChatPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentEditingCode, setCurrentEditingCode] = useState('');
  const [currentEditingId, setCurrentEditingId] = useState(null);

  /**
   * Fetches component code from the Gemini API using the SDK
   */
  const fetchGeminiCode = async (prompt) => {
    // ...
    if (API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
      alert('Please add your Gemini API Key to App.jsx');
      return '() => <div className="text-red-500 p-4">Error: Please set your API key in App.jsx</div>';
    }

    // --- FIX 4: Update the system prompt ---
    const systemPrompt = `
      You are an expert React and Tailwind CSS component generator.
      You only respond with a single, pure, functional React component.
      - DO NOT include 'export default'.
      - DO NOT include 'React.createElement'.
      - DO NOT include \`\`\`jsx or \`\`\` wrappers.
      - DO NOT include any imports.
      - DO use Tailwind CSS for all styling.
      - The component should be self-contained.
      - The component should be designed to be responsive and fill its container (e.g., use 'h-full w-full' and flex).
      - React hooks like 'useState', 'useEffect', and 'useRef' are available in scope and should be used directly.
      - Assume 'lucide-react' icons are available in scope (e.g., <CheckCircle />).
      - Respond ONLY with the raw component function: () => <div ... >...</div> or () => { const [hook, setHook] = useState...; return <div ... >...</div> }
    `;

    const fullPrompt = `${systemPrompt}\n\nUser prompt: ${prompt}`;

    try {
      const result = await model.generateContent(fullPrompt);
      const response = await result.response;
      let code = response.text();

      const match = code.match(/```(?:jsx|javascript|js)?\n([\s\S]*?)\n```/);
      if (match) {
        code = match[1]; 
      } else {
        code = code.replace(/```jsx|```/g, ''); 
      }
      
      return code.trim();

    } catch (error) {
      console.error('Gemini API call failed:', error);
      return `() => <div className="text-red-500 p-4">Error: ${error.message}</div>`;
    }
  };

  /**
   * Handles editing code via AI
   */
  const handleCodeEdit = async (currentCode, userPrompt) => {
    
    const currentComponent = components.find(c => c.id === currentEditingId);
    let layoutContext = "";

    if (currentComponent) {
      const { w, h } = currentComponent.layout;
      layoutContext = `
The component's container on the grid has a width of ${w} units and a height of ${h} units.
Please ensure the new code is appropriately styled for this container size (e.g., if it's small, don't use large fonts or margins).
      `;
    }

    // --- FIX 5: Update the edit prompt ---
    const editPrompt = `
      You are an expert React and Tailwind CSS component editor.
      You will be given the current component code, its grid layout context, and a user request.
      You must return the *entire*, *new*, *complete* component code based on the user's request.
      - DO NOT include 'export default'.
      - DO NOT include \`\`\`jsx or \`\`\` wrappers.
      - DO NOT include any imports.
      - DO use Tailwind CSS for all styling.
      - React hooks like 'useState', 'useEffect', and 'useRef' are available in scope and should be used directly.
      - Respond ONLY with the raw component function.

      Here is the component's layout context:
      ${layoutContext}

      Here is the current code:
      \`\`\`jsx
      ${currentCode}
      \`\`\`

      Here is the user's edit request:
      "${userPrompt}"
    `;

    try {
      const result = await model.generateContent(editPrompt);
      const response = await result.response;
      let newCode = response.text();

      // Clean the response
      const match = newCode.match(/```(?:jsx|javascript|js)?\n([\s\S]*?)\n```/);
      if (match) {
        newCode = match[1]; 
      } else {
        newCode = newCode.replace(/```jsx|```/g, ''); 
      }
      
      return newCode.trim();

    } catch (error) {
      console.error('Gemini API edit call failed:', error);
      return currentCode;
    }
  };

  /**
   * Handles the submission of the chat prompt
   */
  const handlePromptSubmit = async (e) => {
    // ... (This function is unchanged)
    e.preventDefault();
    if (!chatPrompt || isLoading) return;

    setIsLoading(true);

    const generatedCode = await fetchGeminiCode(chatPrompt);

    if (generatedCode) {
      const newId = `comp-${Date.now()}`;
      const newComponent = {
        id: newId,
        code: generatedCode,
        isLocked: false, 
        layout: {
          ...placeholderLayout, 
          i: newId, 
        },
      };

      setComponents((prev) => [...prev, newComponent]);
      setPlaceholderLayout({ i: 'placeholder', x: 0, y: 0, w: 4, h: 2 });
    }

    setChatPrompt('');
    setIsLoading(false);
  };

  /**
   * Updates component layouts when they are dragged or resized
   */
  const handleLayoutChange = (newLayouts) => {
    // ... (This function is unchanged)
    setComponents((prevComps) =>
      prevComps.map((comp) => {
        const newLayout = newLayouts.find((l) => l.i === comp.id);
        return newLayout ? { ...comp, layout: newLayout } : comp;
      })
    );
  };

  /**
   * Opens the modal for editing a component
   */
  const handleComponentClick = (component) => {
    // ... (This function is unchanged)
    setCurrentEditingId(component.id);
    setCurrentEditingCode(component.code);
    setIsModalOpen(true);
  };

  /**
   * Closes the modal
   */
  const handleModalClose = () => {
    // ... (This function is unchanged)
    setIsModalOpen(false);
    setCurrentEditingId(null);
    setCurrentEditingCode('');
  };

  /**
   * Saves the edited code from the modal
   */
  const handleModalSave = () => {
    // ... (This function is unchanged)
    setComponents((prev) =>
      prev.map((c) =>
        c.id === currentEditingId ? { ...c, code: currentEditingCode } : c
      )
    );
    handleModalClose();
  };
  
  /**
   * Deletes a component
   */
  const handleDeleteComponent = (id) => {
    // ... (This function is unchanged)
    setComponents((prev) => prev.filter((c) => c.id !== id));
  };

  /**
   * Toggles lock state
   */
  const handleToggleLock = (id) => {
    // ... (This function is unchanged)
    setComponents((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, isLocked: !c.isLocked } : c
      )
    );
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
        {/* Header */}
        <header className="flex-shrink-0 p-4 bg-gray-800 border-b border-gray-700 shadow-md z-10">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Lucide.LayoutGrid /> AI Grid Builder
          </h1>
        </header>

        {/* Main Content (Grid) */}
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

        {/* Chat Bar */}
        <ChatBar
          prompt={chatPrompt}
          setPrompt={setChatPrompt}
          onSubmit={handlePromptSubmit}
          isLoading={isLoading}
        />

        {/* Modal */}
        <CodeEditModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          code={currentEditingCode}
          setCode={setCurrentEditingCode}
          onSave={handleModalSave}
          onEditCode={handleCodeEdit}
        />
      </div>
    </>
  );
}