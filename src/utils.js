import { useState } from 'react';
import { GoogleGenAI } from '@google/genai';

const API_KEY = import.meta.env.VITE_API_KEY;
const genAI = new GoogleGenAI({ apiKey: API_KEY });

export function useGridComponents() {
  const [components, setComponents] = useState([]);
  const [placeholderLayout, setPlaceholderLayout] = useState({ 
    i: 'placeholder', 
    x: 0, 
    y: 0, 
    w: 4, 
    h: 2 
  });
  const [chatPrompt, setChatPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentEditingCode, setCurrentEditingCode] = useState('');
  const [currentEditingId, setCurrentEditingId] = useState(null);

  const fetchGeminiCode = async (prompt) => {
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
    const currentComponent = components.find((c) => c.id === currentEditingId);
    let layoutContext = '';

    if (currentComponent) {
      const { w, h } = currentComponent.layout;
      layoutContext = `The component's container on the grid has a width of ${w} units and a height of ${h} units.`;
    }

    const editPrompt = `
      You are an expert React and Tailwind CSS component editor.
      Return the entire new component function only. DO NOT include exports, imports, or code fences.
      Use Tailwind CSS for styling. Hooks and lucide icons are available in scope.

      Layout context: ${layoutContext}

      Current code:
      ${currentCode}

      User request: ${userPrompt}
    `;

    try {
      const result = await genAI.models.generateContent({ 
        model: 'gemini-2.5-flash', 
        prompt: editPrompt 
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
    setComponents((prevComps) =>
      prevComps.map((comp) => {
        const newLayout = newLayouts.find((l) => l.i === comp.id);
        return newLayout ? { ...comp, layout: newLayout } : comp;
      })
    );
  };

  const handleComponentClick = (component) => {
    setCurrentEditingId(component.id);
    setCurrentEditingCode(component.code);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setCurrentEditingId(null);
    setCurrentEditingCode('');
  };

  const handleModalSave = () => {
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
    setComponents((prev) => prev.filter((c) => c.id !== id));
  };

  const handleToggleLock = (id) => {
    setComponents((prev) => 
      prev.map((c) => 
        c.id === id 
          ? { ...c, isLocked: !c.isLocked } 
          : c
      )
    );
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
    handleComponentClick,
    handleModalClose,
    handleModalSave,
    handleDeleteComponent,
    handleToggleLock,
    handleCodeEdit,
  };
}