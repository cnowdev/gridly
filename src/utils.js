import { useState, useEffect } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_API_KEY;

let genAI;
let model;
if (API_KEY) {
  genAI = new GoogleGenerativeAI(API_KEY);
  model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); 
} 

if (!API_KEY) {
  console.error("VITE_API_KEY is not set. Please add it to your .env file.");
}

// LocalStorage key
const STORAGE_KEY = 'gridly-state';

// Load state from localStorage
const loadState = () => {
  try {
    const savedState = localStorage.getItem(STORAGE_KEY);
    if (savedState) {
      return JSON.parse(savedState);
    }
  } catch (error) {
    console.error('Failed to load state from localStorage:', error);
  }
  return null;
};

// Save state to localStorage
const saveState = (components, placeholderLayout) => {
  try {
    const state = {
      components,
      placeholderLayout,
      timestamp: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Failed to save state to localStorage:', error);
  }
};

// Export grid as JSX component
export const exportGridAsJSX = (components) => {
  const jsx = `import React, { useState, useEffect, useRef } from 'react';
import * as Lucide from 'lucide-react';

${components.map((comp, idx) => `// Component ${idx + 1}
const Component${idx} = ${comp.code};
`).join('\n')}

export default function ExportedGrid() {
  return (
    <div className="grid grid-cols-12 min-h-screen bg-gray-900">
${components.map((comp, idx) => {
      const { x, y, w, h } = comp.layout;
      return `      <div 
        style={{ 
          gridColumn: '${x + 1} / span ${w}',
          gridRow: '${y + 1} / span ${h}'
        }}
      >
        <Component${idx} />
      </div>`;
    }).join('\n')}
    </div>
  );
}
`;

  return jsx;
};

// Download JSX file
export const downloadJSX = (jsxContent, filename = 'ExportedGrid.jsx') => {
  const blob = new Blob([jsxContent], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export function useGridComponents() {
  const savedState = loadState();
  
  const [history, setHistory] = useState([savedState?.components || []]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const components = history[historyIndex];

  const [placeholderLayout, setPlaceholderLayout] = useState(
    savedState?.placeholderLayout || { 
      i: 'placeholder', 
      x: 0, 
      y: 0, 
      w: 4, 
      h: 2 
    }
  );
  const [chatPrompt, setChatPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [currentEditingCode, setCurrentEditingCode] = useState('');
  const [currentEditingId, setCurrentEditingId] = useState(null);
  const [currentEditingLayout, setCurrentEditingLayout] = useState(null); 
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  useEffect(() => {
    saveState(components, placeholderLayout);
  }, [components, placeholderLayout]);

  const [gridWidth, setGridWidth] = useState(1200);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState(null);
  const [drawEnd, setDrawEnd] = useState(null);
  const [showPlaceholder, setShowPlaceholder] = useState(false);
  const [ignoreNextLayoutChange, setIgnoreNextLayoutChange] = useState(false);

  // This function wraps our state setting to manage the history array.
  const setComponentsWithHistory = (newComponentsOrFn) => {
    const currentComponents = history[historyIndex];

    // Resolve the new state (whether it's a value or a function)
    const newComponents = typeof newComponentsOrFn === 'function' 
      ? newComponentsOrFn(currentComponents)
      : newComponentsOrFn;

    // Deep-compare the new state with the current state.
    // If they are the same, don't create a new history entry.
    if (JSON.stringify(newComponents) === JSON.stringify(currentComponents)) {
      return;
    }

    // Cut off the 'future' history if we've undone
    const currentHistory = history.slice(0, historyIndex + 1);
    
    const newHistory = [...currentHistory, newComponents];
    
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('gridly_settings');
      if (!saved) {
        const legacy = localStorage.getItem('gridly_design_system');
        return {
          colors: { background: '', secondary: '', text: '' },
          fonts: { primary: '', secondary: '' },
          customRules: legacy || '',
        };
      }
      return JSON.parse(saved);
    } catch (error) {
      console.warn('Failed to parse settings, resetting to defaults.', error);
      return {
        colors: { background: '', secondary: '', text: '' },
        fonts: { primary: '', secondary: '' },
        customRules: '',
      };
    }
  });

  useEffect(() => {
    const hasVisited = localStorage.getItem('gridly_has_visited');
    if (!hasVisited) {
      setIsSettingsOpen(true);
      localStorage.setItem('gridly_has_visited', 'true');
    }
  }, []);

  const handleSaveSettings = (newSettings) => {
    setSettings(newSettings);
    localStorage.setItem('gridly_settings', JSON.stringify(newSettings));
    setIsSettingsOpen(false);
  };

  const getDesignSystemPrompt = () => {
    const { colors, fonts, customRules } = settings;
    const parts = [
      colors.background && `- Preferred background color: ${colors.background}`,
      colors.secondary && `- Secondary color: ${colors.secondary}`,
      colors.text && `- Text color: ${colors.text}`,
      fonts.primary && `- Primary font family: ${fonts.primary}`,
      fonts.secondary && `- Secondary font family: ${fonts.secondary}`,
    ].filter(Boolean);

    if (customRules && customRules.trim()) {
      parts.push(customRules.trim());
    }

    return parts.length > 0 ? parts.join('\n') : '';
  };

  const fetchGeminiCode = async (prompt) => {
    if (!model) {
      alert('Gemini API Key is not set in .env file.');
      return '() => <div className="text-red-500 p-4">Error: Please set your API key in .env</div>';
    }

    const designSystem = getDesignSystemPrompt();

    const systemPrompt = `
      You are an expert React and Tailwind CSS component generator.
      You only respond with a single, pure, functional React component.
      - DO NOT include 'export default'.
      - DO NOT include 'React.createElement'.
      - DO NOT include code fences (\`\`\`).
      - DO NOT include any imports.
      - DO use Tailwind CSS for all styling.
      - The component should be self-contained and responsive, filling its container (use 'h-full w-full').
      - React hooks like 'useState', 'useEffect', and 'useRef' are available in scope.
      - Assume 'lucide-react' icons are available in scope.
      - When using Lucide icons, use Lucide.IconName (e.g., <Lucide.User />).
      - Respond ONLY with the raw component function:
        () => <div ... />  or  () => { const [s, setS] = useState(); return <div .../> }

      ${designSystem ? `IMPORTANT GLOBAL DESIGN CONTEXT:\n${designSystem}\n` : ''}

      If the user specifically asks for something different from the global design context, prioritize their request. If you feel like a color or font choice from the design system doesn't fit the component being generated, you can deviate from it as needed.
    `;

    const fullPrompt = `${systemPrompt}\n\nUser prompt: ${prompt}`;

    try {
      const result = await model.generateContent(fullPrompt);
      const response = await result.response;
      let code = response.text();

      const match = code.match(/```(?:jsx|javascript|js)?\n([\s\S]*?)\n```/);
      if (match) code = match[1];
      else code = code.replace(/```jsx|```/g, '');

      return code.trim();
    } catch (error) {
      console.error('Gemini API call failed:', error);
      return `() => <div className="text-red-500 p-4">Error: ${error.message}</div>`;
    }
  };

  const handleCodeEdit = async (currentCode, userPrompt) => {
    if (!model) {
      alert('Gemini API Key is not set in .env file.');
      return currentCode;
    }

    let currentComponentContext = ''; 
    const currentComponent = components.find((c) => c.id === currentEditingId);

    if (currentComponent) {
      const { w, h } = currentComponent.layout;
      currentComponentContext = `The component you are editing (ID: "${currentEditingId}") is in a container with grid width ${w} and grid height ${h}.`;
    }

    const otherComponentsContext = components
      .filter(c => c.id !== currentEditingId) // Get all *other* components
      .map(c => `  - Component ID: "${c.id}" (Layout: x: ${c.layout.x}, y: ${c.layout.y}, w: ${c.layout.w}, h: ${c.layout.h})`)
      .join('\n');
    
    // Combine all grid context into one block
    const gridContext = `
GRID CONTEXT:
${currentComponentContext}
${otherComponentsContext.length > 0 ? `
Here are the other components on the grid (the user may refer to them by ID):
${otherComponentsContext}
` : ''}
    `;

    const designSystem = getDesignSystemPrompt();

    const editPrompt = `
      You are an expert React and Tailwind CSS component editor.
      Return the entire new component function only. DO NOT include exports, imports, or code fences.
      Use Tailwind CSS for styling. Hooks and lucide icons are available in scope. When using Lucide icons, use
      Lucide.IconName (e.g., <Lucide.User />).

      ${designSystem ? `IMPORTANT GLOBAL DESIGN CONTEXT:\n${designSystem}\n` : ''}

      ${gridContext} 

      Current code (for component "${currentEditingId}"):
      ${currentCode}

      User request: ${userPrompt}
    `;

    try {
      const result = await model.generateContent(editPrompt);
      const response = await result.response;
      let newCode = response.text();

      const match = newCode.match(/```(?:jsx|javascript|js)?\n([\s\S]*?)\n```/);
      if (match) newCode = match[1];
      else newCode = newCode.replace(/```jsx|```/g, '');

      return newCode.trim();
    } catch (error) {
      console.error('Gemini API edit call failed:', error);
      return currentCode;
    }
  };

  const handlePromptSubmit = async (e) => {
    e.preventDefault();
    if (!chatPrompt || isLoading) return;

    if (!showPlaceholder) {
      alert("Please draw a box on the grid first to set the component's position and size.");
      return;
    }

    setIsLoading(true);
    const generatedCode = await fetchGeminiCode(chatPrompt);

    if (generatedCode) {
      const newId = `comp-${Date.now()}`;
      const newComponent = {
        id: newId,
        code: generatedCode,
        isLocked: false,
        layout: { ...placeholderLayout, i: newId },
      };

      setComponentsWithHistory((prev) => [...prev, newComponent]);
      setShowPlaceholder(false);
      // Ignore the next layout change from React Grid Layout's automatic positioning
      setIgnoreNextLayoutChange(true);
    }

    setChatPrompt('');
    setIsLoading(false);
  };

  const handleLayoutChange = (newLayouts) => {
    const placeholder = newLayouts.find((l) => l.i === 'placeholder');
    if (placeholder) {
      setPlaceholderLayout(placeholder);
    }
    
    // If we should ignore this layout change (e.g., right after adding a component)
    if (ignoreNextLayoutChange) {
      setIgnoreNextLayoutChange(false);
      
      // Still update the components array, but don't create history entry
      const updatedComps = components.map((comp) => {
        const newLayout = newLayouts.find((l) => l.i === comp.id);
        if (newLayout) {
          return { 
            ...comp, 
            layout: {
              i: newLayout.i,
              x: newLayout.x,
              y: newLayout.y,
              w: newLayout.w,
              h: newLayout.h,
            }
          };
        }
        return comp;
      });
      
      // Update the state directly without going through history
      setHistory(prev => {
        const newHistory = [...prev];
        newHistory[historyIndex] = updatedComps;
        return newHistory;
      });
      return;
    }
    
    // Check if anything actually changed before calling setComponentsWithHistory
    let hasChanges = false;
    
    const updatedComps = components.map((comp) => {
      const newLayout = newLayouts.find((l) => l.i === comp.id);

      if (newLayout) {
        // Normalize the layout object to only the properties we use.
        const newNormalizedLayout = {
          i: newLayout.i,
          x: newLayout.x,
          y: newLayout.y,
          w: newLayout.w,
          h: newLayout.h,
        };

        // Check if the layout actually changed
        if (JSON.stringify(comp.layout) !== JSON.stringify(newNormalizedLayout)) {
          hasChanges = true;
          return { ...comp, layout: newNormalizedLayout };
        }
      }
      return comp;
    });

    // Only update history if something actually changed
    if (hasChanges) {
      setComponentsWithHistory(updatedComps);
    }
  };

  const handleGridMouseDown = (e) => {
    if (e.target.classList.contains('react-grid-layout') || e.target.classList.contains('layout')) {
      setIsDrawing(true);
      setShowPlaceholder(false);
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left + e.currentTarget.scrollLeft;
      const y = e.clientY - rect.top + e.currentTarget.scrollTop; 
      setDrawStart({ x, y });
      setDrawEnd({ x, y });
    }
  };

  const handleGridMouseMove = (e) => {
    if (!isDrawing) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left + e.currentTarget.scrollLeft;
    const y = e.clientY - rect.top + e.currentTarget.scrollTop;
    setDrawEnd({ x, y });
  };

  const handleGridMouseUp = (e) => {
    if (!isDrawing) return;
    setIsDrawing(false);

    const rowHeight = 20;
    const cols = 12;
    const colWidth = gridWidth / cols;

    const startX = Math.min(drawStart.x, drawEnd.x);
    const startY = Math.min(drawStart.y, drawEnd.y);
    const endX = Math.max(drawStart.x, drawEnd.x);
    const endY = Math.max(drawStart.y, drawEnd.y);

    const newLayout = {
      i: 'placeholder',
      x: Math.floor(startX / colWidth),
      y: Math.floor(startY / rowHeight),
      w: Math.max(1, Math.round((endX - startX) / colWidth)),
      h: Math.max(1, Math.round((endY - startY) / rowHeight)),
    };

    if (newLayout.w < 1 && newLayout.h < 1) {
      setDrawStart(null);
      setDrawEnd(null);
      return;
    }

    setPlaceholderLayout(newLayout);
    setShowPlaceholder(true);
    setDrawStart(null);
    setDrawEnd(null);
  };

  const handleCancelPlaceholder = () => {
    setShowPlaceholder(false);
    setDrawStart(null);
    setDrawEnd(null);
    setPlaceholderLayout({ i: 'placeholder', x: 0, y: 0, w: 4, h: 2 });
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setCurrentEditingId(null);
    setCurrentEditingCode('');
    setCurrentEditingLayout(null); // Clear layout on close
  };

  const handleModalSave = () => {
    setComponentsWithHistory((prev) =>
      prev.map((c) =>
        c.id === currentEditingId ? { ...c, code: currentEditingCode } : c
      )
    );
    handleModalClose();
  };

  const handleDeleteComponent = (id) => {
    setComponentsWithHistory((prev) => prev.filter((c) => c.id !== id));
  };

  const handleDuplicateComponent = (id) => {
    const componentToDuplicate = components.find((c) => c.id === id);
    if (!componentToDuplicate) return;

    const newId = `comp-${Date.now()}`;
    const newComponent = {
      id: newId,
      code: componentToDuplicate.code,
      isLocked: false,
      layout: {
        ...componentToDuplicate.layout, // Copes w, h, etc.
        i: newId, // Set new unique ID for the layout
        // Place it just below the original. RGL will handle collisions.
        y: componentToDuplicate.layout.y + componentToDuplicate.layout.h,
      },
    };

    setComponentsWithHistory((prev) => [...prev, newComponent]);
  };

  const handleToggleLock = (id) => {
    setComponentsWithHistory((prev) =>
      prev.map((c) => (c.id === id ? { ...c, isLocked: !c.isLocked } : c))
    );
  };

  const openEditModal = (component) => {
    setCurrentEditingId(component.id);
    setCurrentEditingCode(component.code);
    setCurrentEditingLayout(component.layout); // Set the layout when opening modal
    setIsModalOpen(true);
  }

  const clearAllComponents = () => {
    setComponentsWithHistory([]);
    setPlaceholderLayout({ i: 'placeholder', x: 0, y: 0, w: 4, h: 2 });
  };

  const handleUndo = () => {
    setHistoryIndex(prevIndex => Math.max(0, prevIndex - 1));
  };

  const handleRedo = () => {
    setHistoryIndex(prevIndex => Math.min(history.length - 1, prevIndex + 1));
  };

  const handleExport = () => {
    if (components.length === 0) {
      alert('No components to export!');
      return;
    }
    const jsx = exportGridAsJSX(components);
    downloadJSX(jsx);
  };

  const togglePreview = () => {
    setIsPreviewMode(!isPreviewMode);
  };

  return {
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
    currentEditingId,
    currentEditingLayout, // Export this NEW state
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
    handleDuplicateComponent,
    handleToggleLock,
    handleCodeEdit,
    clearAllComponents,
    handleExport,
    handleGridMouseDown,
    handleGridMouseMove,
    handleGridMouseUp,
    handleCancelPlaceholder,
    togglePreview,
    handleUndo,
    handleRedo,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
  };
}