import { useState, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';

const API_KEY = import.meta.env.VITE_API_KEY;
const genAI = new GoogleGenAI({ apiKey: API_KEY });

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
  // ...existing code...
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
  const [currentEditingCode, setCurrentEditingCode] = useState('');
  const [currentEditingId, setCurrentEditingId] = useState(null);

  // ...existing code...

  useEffect(() => {
    saveState(components, placeholderLayout);
  }, [components, placeholderLayout]);

  const fetchGeminiCode = async (prompt) => {
    // ...existing code...
    if (!API_KEY) {
      alert('Please add your Gemini API Key to .env');
      return '() => <div className="text-red-500 p-4">Error: Please set your API key in .env</div>';
    }

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
    `;

    const fullPrompt = `${systemPrompt}\n\nUser prompt: ${prompt}`;

    try {
      const result = await genAI.models.generateContent({ 
        model: 'gemini-2.5-flash', 
        contents: fullPrompt 
      });
      let code = result.text;

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
    // ...existing code...
    const currentComponent = components.find((c) => c.id === currentEditingId);
    let layoutContext = '';

    if (currentComponent) {
      const { w, h } = currentComponent.layout;
      layoutContext = `The component's container on the grid has a width of ${w} units and a height of ${h} units.`;
    }

    const editPrompt = `
      You are an expert React and Tailwind CSS component editor.
      Return the entire new component function only. DO NOT include exports, imports, or code fences.
      Use Tailwind CSS for styling. Hooks and lucide icons are available in scope. When using Lucide icons, use
      Lucide.IconName (e.g., <Lucide.User />).

      Layout context: ${layoutContext}

      Current code:
      ${currentCode}

      User request: ${userPrompt}
    `;

    try {
      const result = await genAI.models.generateContent({ 
        model: 'gemini-2.5-flash', 
        contents: editPrompt 
      });
      let newCode = result.text;

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
      setPlaceholderLayout({ i: 'placeholder', x: 0, y: 0, w: 4, h: 2 });
    }

    setChatPrompt('');
    setIsLoading(false);
  };

  const handleLayoutChange = (newLayouts) => {
    // ...existing code...
    setComponents((prevComps) =>
      prevComps.map((comp) => {
        const newLayout = newLayouts.find((l) => l.i === comp.id);
        return newLayout ? { ...comp, layout: newLayout } : comp;
      })
    );
  };

  const handleModalClose = () => {
    // ...existing code...
    setIsModalOpen(false);
    setCurrentEditingId(null);
    setCurrentEditingCode('');
  };

  const handleModalSave = () => {
    // ...existing code...
    setComponents((prev) => 
      prev.map((c) => 
        c.id === currentEditingId 
          ? { ...c, code: currentEditingCode } 
          : c
      )
    );
    handleModalClose();
  };

  const handleDeleteComponent = (id) => {
    // ...existing code...
    setComponents((prev) => prev.filter((c) => c.id !== id));
  };

  const handleToggleLock = (id) => {
    // ...existing code...
    setComponents((prev) => 
      prev.map((c) => 
        c.id === id 
          ? { ...c, isLocked: !c.isLocked } 
          : c
      )
    );
  };

  const openEditModal = (component) => {
    // ...existing code...
    setCurrentEditingId(component.id);
    setCurrentEditingCode(component.code);
    setIsModalOpen(true);
  }

  const clearAllComponents = () => {
    // ...existing code...
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

  return {
    // State
    components,
    placeholderLayout,
    chatPrompt,
    isLoading,
    isModalOpen,
    currentEditingCode,
    currentEditingId,
    
    // Setters
    setPlaceholderLayout,
    setChatPrompt,
    setCurrentEditingCode,
    
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
  };
}