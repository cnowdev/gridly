import { useState, useEffect } from 'react'; // Added useEffect import
import genai from './lib/genai';



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
  
  const [components, setComponents] = useState(savedState?.components || []);
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
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  useEffect(() => {
    saveState(components, placeholderLayout);
  }, [components, placeholderLayout]);

  const [gridWidth, setGridWidth] = useState(1200);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState(null);
  const [drawEnd, setDrawEnd] = useState(null);
  const [showPlaceholder, setShowPlaceholder] = useState(false);


  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('gridly_settings');
      if (!saved) {
        const legacy = localStorage.getItem('gridly_design_system');
        return {
          colors: { background: '', secondary: '', text: '' }, // Highlight changed to text here too just in case
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

  // NEW: Onboarding Effect
  useEffect(() => {
    const hasVisited = localStorage.getItem('gridly_has_visited');
    if (!hasVisited) {
      setIsSettingsOpen(true);
      localStorage.setItem('gridly_has_visited', 'true');
    }
  }, []);

  // ...Tvst of the file remains exactly as you provided in your prompt
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
      colors.text && `- Text color: ${colors.text}`, // Highlight changed to text
      fonts.primary && `- Primary font family: ${fonts.primary}`,
      fonts.secondary && `- Secondary font family: ${fonts.secondary}`,
    ].filter(Boolean);

    if (customRules && customRules.trim()) {
      parts.push(customRules.trim());
    }

    return parts.length > 0 ? parts.join('\n') : '';
  };

  const fetchGeminiCode = async (prompt) => {
    if (!genai) {
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
      const response = await genai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: fullPrompt,
      });
      let code = response.text;

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
    const currentComponent = components.find((c) => c.id === currentEditingId);
    let layoutContext = '';

    if (currentComponent) {
      const { w, h } = currentComponent.layout;
      layoutContext = `The component's container on the grid has a width of ${w} units and a height of ${h} units.`;
    }

    const designSystem = getDesignSystemPrompt();

    const editPrompt = `
      You are an expert React and Tailwind CSS component editor.
      Return the entire new component function only. DO NOT include exports, imports, or code fences.
      Use Tailwind CSS for styling. Hooks and lucide icons are available in scope. When using Lucide icons, use
      Lucide.IconName (e.g., <Lucide.User />).

      ${designSystem ? `IMPORTANT GLOBAL DESIGN CONTEXT:\n${designSystem}\n` : ''}

      Layout context: ${layoutContext}
      Current code:
      ${currentCode}
      User request: ${userPrompt}
    `;

    try {
      const response = await genai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: editPrompt,
      });
      let newCode = response.text;

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
    // ...existing code...
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

      setComponents((prev) => [...prev, newComponent]);
      setShowPlaceholder(false);
    }

    setChatPrompt('');
    setIsLoading(false);
  };

  const handleLayoutChange = (newLayouts) => {
    const placeholder = newLayouts.find((l) => l.i === 'placeholder');
    if (placeholder) {
      setPlaceholderLayout(placeholder);
    }
    
    setComponents((prevComps) =>
      prevComps.map((comp) => {
        const newLayout = newLayouts.find((l) => l.i === comp.id);
        return newLayout ? { ...comp, layout: newLayout } : comp;
      })
    );
  };

  const handleGridMouseDown = (e) => {
    // Only start drawing if the click is on the grid background itself
    if (e.target.classList.contains('react-grid-layout') || e.target.classList.contains('layout')) {
      setIsDrawing(true);
      setShowPlaceholder(false);
      const rect = e.currentTarget.getBoundingClientRect();
      
      // Add scroll offsets for correct coordinates
      const x = e.clientX - rect.left + e.currentTarget.scrollLeft;
      const y = e.clientY - rect.top + e.currentTarget.scrollTop; 
      
      setDrawStart({ x, y });
      setDrawEnd({ x, y });
    }
  };

  const handleGridMouseMove = (e) => {
    if (!isDrawing) return;
    const rect = e.currentTarget.getBoundingClientRect();
    
    // Add scroll offsets for correct coordinates
    const x = e.clientX - rect.left + e.currentTarget.scrollLeft;
    const y = e.clientY - rect.top + e.currentTarget.scrollTop;

    setDrawEnd({ x, y });
  };

  const handleGridMouseUp = (e) => {
    if (!isDrawing) return;
    setIsDrawing(false);

    const rowHeight = 20; // Must match rowHeight in GridContainer
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
  };

  const handleModalSave = () => {
    setComponents((prev) =>
      prev.map((c) =>
        c.id === currentEditingId ? { ...c, code: currentEditingCode } : c
      )
    );
    handleModalClose();
  };

  const handleDeleteComponent = (id) => {
    setComponents((prev) => prev.filter((c) => c.id !== id));
  };

  const handleToggleLock = (id) => {
    setComponents((prev) =>
      prev.map((c) => (c.id === id ? { ...c, isLocked: !c.isLocked } : c))
    );
  };

  const openEditModal = (component) => {
    setCurrentEditingId(component.id);
    setCurrentEditingCode(component.code);
    setIsModalOpen(true);
  }

  const clearAllComponents = () => {
    setComponents([]);
    setPlaceholderLayout({ i: 'placeholder', x: 0, y: 0, w: 4, h: 2 });
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
    isDrawing,
    drawStart,
    drawEnd,
    showPlaceholder,
    isPreviewMode,
    
    // Setters
    setPlaceholderLayout,
    setChatPrompt,
    setCurrentEditingCode,
    setGridWidth,
    
    // Handlers
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
    handleCancelPlaceholder,
    togglePreview,
  };
}