import { useState, useEffect } from 'react'; // Added useEffect import
import genai from './lib/genai';
import { saveImage, loadImage, loadAllImages, deleteImage, clearAllImages } from './lib/imageStorage';



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

  // Image cache for storing blob URLs (runtime only)
  const [imageCache] = useState(() => new Map());
  // Track if images have been loaded from IndexedDB
  const [imagesLoaded, setImagesLoaded] = useState(false);

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

  // Helper function to convert base64 to blob URL and store it
  const cacheImageAsURL = async (imageBase64, componentId) => {
    const timestamp = Date.now();
    const key = `${componentId}-${timestamp}`;
    
    try {
      // Save base64 to IndexedDB for persistence
      await saveImage(key, imageBase64);
      
      // Convert base64 to blob
      const byteCharacters = atob(imageBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/png' });
      
      // Create object URL
      const objectURL = URL.createObjectURL(blob);
      
      // Store in runtime cache with the key
      imageCache.set(key, { url: objectURL, key });
      
      return objectURL;
    } catch (error) {
      console.error('Failed to create blob URL:', error);
      return `data:image/png;base64,${imageBase64}`;
    }
  };

  // Helper function to restore blob URLs from IndexedDB
  const restoreBlobURL = async (imageKey) => {
    try {
      // Check if already in cache
      if (imageCache.has(imageKey)) {
        return imageCache.get(imageKey).url;
      }
      
      // Load from IndexedDB
      const base64 = await loadImage(imageKey);
      if (!base64) {
        console.warn(`Image not found in IndexedDB: ${imageKey}`);
        return null;
      }
      
      // Convert base64 to blob URL
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/png' });
      const newURL = URL.createObjectURL(blob);
      
      // Cache it
      imageCache.set(imageKey, { url: newURL, key: imageKey });
      
      return newURL;
    } catch (error) {
      console.error('Failed to restore blob URL:', error);
      return null;
    }
  };

  // Helper function to clean up cached images
  const cleanupImageCache = async (componentId) => {
    for (const [key, data] of imageCache.entries()) {
      if (key.startsWith(componentId)) {
        URL.revokeObjectURL(data.url);
        imageCache.delete(key);
        // Also remove from IndexedDB
        await deleteImage(key);
      }
    }
  };

  // Restore blob URLs on component mount/load
  useEffect(() => {
    const restoreImages = async () => {
      if (imagesLoaded) return;
      
      try {
        // Load all images from IndexedDB
        const allImages = await loadAllImages();
        
        // Restore blob URLs for all stored images
        for (const [key, base64] of Object.entries(allImages)) {
          if (!imageCache.has(key)) {
            const byteCharacters = atob(base64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'image/png' });
            const newURL = URL.createObjectURL(blob);
            imageCache.set(key, { url: newURL, key });
          }
        }
        
        setImagesLoaded(true);
        
        // After images are loaded, update component code with restored URLs
        setComponentsWithHistory(prevComps =>
          prevComps.map(comp => {
            if (!comp.imageKeys || comp.imageKeys.length === 0) {
              return comp;
            }
            
            let updatedCode = comp.code;
            let hasChanges = false;
            
            // For each image key, restore its blob URL in the code
            comp.imageKeys.forEach(imageKey => {
              if (imageCache.has(imageKey)) {
                const { url } = imageCache.get(imageKey);
                // Find old blob URLs and replace with new ones
                const blobRegex = /blob:http[s]?:\/\/[^\s"')]+/g;
                const oldUrls = updatedCode.match(blobRegex) || [];
                
                // If there are old blob URLs, replace the first one with our restored URL
                if (oldUrls.length > 0) {
                  updatedCode = updatedCode.replace(oldUrls[0], url);
                  hasChanges = true;
                }
              }
            });
            
            return hasChanges ? { ...comp, code: updatedCode } : comp;
          })
        );
      } catch (error) {
        console.error('Failed to restore images:', error);
      }
    };
    
    restoreImages();
  }, [imagesLoaded]);

  // Helper function to generate AI images
  const generateImage = async (imagePrompt) => {
    try {
      const response = await genai.models.generateImages({
        model: 'imagen-3.0-generate-002',
        prompt: imagePrompt,
        config: {
          numberOfImages: 1,
          includeRaiReason: true,
        }
      });
      
      const imageBase64 = response?.generatedImages?.[0]?.image?.imageBytes;
      
      if (!imageBase64) {
        console.error('No image data returned from Imagen API');
        return null;
      }
      
      return imageBase64;
    } catch (error) {
      console.error('Image generation failed:', error);
      return null;
    }
  };

  const fetchGeminiCode = async (prompt) => {
    if (!genai) {
      alert('Gemini API Key is not set in .env file.');
      const errorId = `comp-${Date.now()}`;
      return { 
        code: '() => <div className="text-red-500 p-4">Error: Please set your API key in .env</div>',
        componentId: errorId,
        imageKeys: []
      };
    }

    const designSystem = getDesignSystemPrompt();

    const systemPrompt = `
      You are an expert React and Tailwind CSS component generator.

      ONLY IF the user is EXPLICITLY asking for an AI-generated image (photo, illustration, graphic, etc.):
        - Respond with exactly: IMAGE_REQUEST: [detailed, descriptive prompt for image generation]
        - Make the image prompt detailed and specific
        - ONLY do this if they need a realistic photo/illustration, NOT for icons or simple graphics
      
      OTHERWISE:
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

    // Generate component ID first
    const newComponentId = `comp-${Date.now()}`;
    let imageKeys = [];

    try {
      const response = await genai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: fullPrompt,
      });
      let code = response.text.trim();

      // Check if AI detected an image request
      if (code.startsWith('IMAGE_REQUEST:')) {
        const imagePrompt = code.replace('IMAGE_REQUEST:', '').trim();
        console.log('Generating image with prompt:', imagePrompt);
        
        const imageBase64 = await generateImage(imagePrompt);
        
        if (imageBase64) {
          // Use the component ID we already generated
          const imageURL = await cacheImageAsURL(imageBase64, newComponentId);
          
          // Extract the actual key from the cache
          for (const [key, data] of imageCache.entries()) {
            if (data.url === imageURL && key.startsWith(newComponentId)) {
              imageKeys.push(key);
              break;
            }
          }
          
          // Now re-prompt to generate the full component with the image URL
          const componentPrompt = `
            You are an expert React and Tailwind CSS component generator.
            Return the entire component function only. DO NOT include exports, imports, or code fences.
            Use Tailwind CSS for styling. Hooks and lucide icons are available in scope.

            Use this image URL in your component:
            <img src="${imageURL}" alt="${imagePrompt.replace(/"/g, '&quot;')}" className="your-tailwind-classes" />

            IMPORTANT: Size the image appropriately using Tailwind classes:
            - Use object-cover or object-contain to control aspect ratio
            - Use w-full or max-w-* to control width
            - Use h-48, h-64, h-96, or max-h-* to limit height (don't make it too tall)
            - Consider using rounded corners (rounded-lg, rounded-xl) for aesthetics
            
            Style the image appropriately with Tailwind CSS to fit the overall component design.
            Make sure the component fills its container (h-full w-full).

            ${designSystem ? `IMPORTANT GLOBAL DESIGN CONTEXT:\n${designSystem}\n` : ''}

            Original user request: ${prompt}
          `;

          const componentResponse = await genai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: componentPrompt,
          });
          
          code = componentResponse.text.trim();
        } else {
          // If image generation failed, prompt for a fallback component
          const fallbackPrompt = `
            You are an expert React and Tailwind CSS component generator.
            Return the entire component function only. DO NOT include exports, imports, or code fences.
            Use Tailwind CSS for styling. Hooks and lucide icons are available in scope.

            Image generation failed - create a component with a placeholder or Lucide icon instead.
            Make sure the component fills its container (h-full w-full).

            ${designSystem ? `IMPORTANT GLOBAL DESIGN CONTEXT:\n${designSystem}\n` : ''}

            Original user request: ${prompt}
          `;

          const fallbackResponse = await genai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: fallbackPrompt,
          });
          
          code = fallbackResponse.text.trim();
        }
      }

      // Regular code generation - clean up markdown
      const match = code.match(/```(?:jsx|javascript|js)?\n([\s\S]*?)\n```/);
      if (match) code = match[1];
      else code = code.replace(/```jsx|```/g, '');

      return { 
        code: code.trim(), 
        componentId: newComponentId,
        imageKeys 
      };
    } catch (error) {
      console.error('Gemini API call failed:', error);
      return { 
        code: `() => <div className="text-red-500 p-4">Error: ${error.message}</div>`,
        componentId: newComponentId,
        imageKeys: []
      };
    }
  };

  const handleCodeEdit = async (currentCode, userPrompt) => {
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
      ONLY IF the user is EXPLICITLY asking for an AI-generated image, photo, illustration, graphic, or visual asset to be added/changed:
        - Respond with exactly: IMAGE_REQUEST: [detailed, descriptive prompt for image generation]
        - Make the image prompt detailed and specific
      
      OTHERWISE:
      You are an expert React and Tailwind CSS component editor.
      Return the entire new component function only. DO NOT include exports, imports, or code fences.
      Use Tailwind CSS for styling. Hooks are available in scope. All Lucide icons are available under 
      the 'Lucide' namespace (e.g., <Lucide.User />, <Lucide.Bell />, etc).

      ${designSystem ? `IMPORTANT GLOBAL DESIGN CONTEXT:\n${designSystem}\n` : ''}

      ${gridContext} 

      Current code (for component "${currentEditingId}"):
      ${currentCode}

      User request: ${userPrompt}
    `;

    try {
      const response = await genai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: editPrompt,
      });
      let newCode = response.text.trim();

      // Check if AI detected an image request
      if (newCode.startsWith('IMAGE_REQUEST:')) {
        const imagePrompt = newCode.replace('IMAGE_REQUEST:', '').trim();
        console.log('Generating image for edit with prompt:', imagePrompt);
        
        const imageBase64 = await generateImage(imagePrompt);

        if (imageBase64) {
          // Convert base64 to blob URL (await it!)
          const imageURL = await cacheImageAsURL(imageBase64, currentEditingId);
          
          // Generate component code that includes the image URL
          const componentPrompt = `
            You are an expert React and Tailwind CSS component editor.
            Return the entire new component function only. DO NOT include exports, imports, or code fences.
            Use Tailwind CSS for styling. Hooks and lucide icons are available in scope.

            The user requested an image be ${currentCode.includes('blob:') || currentCode.includes('data:image') ? 'replaced' : 'added'} to the component.
            
            Use this image URL in your component:
            <img src="${imageURL}" alt="${imagePrompt.replace(/"/g, '&quot;')}" className="your-tailwind-classes" />

            IMPORTANT: Size the image appropriately using Tailwind classes:
            - Use object-cover or object-contain to control aspect ratio
            - Use w-full or max-w-* to control width
            - Use h-48, h-64, h-96, or max-h-* to limit height (don't make it too tall)
            - Consider using rounded corners (rounded-lg, rounded-xl) for aesthetics
            
            Style the image appropriately with Tailwind CSS to fit the component's design.
            Make sure the component fills its container (h-full w-full).

            ${designSystem ? `DESIGN CONTEXT:\n${designSystem}\n` : ''}
            Layout context: ${layoutContext}
            
            Current code:
            ${currentCode}
            
            User request: ${userPrompt}
          `;

          const componentResponse = await genai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: componentPrompt,
          });
          
          newCode = componentResponse.text.trim();
        } else {
          // If image generation failed, prompt for a fallback
          const fallbackPrompt = `
            You are an expert React and Tailwind CSS component editor.
            Return the entire new component function only. DO NOT include exports, imports, or code fences.
            Use Tailwind CSS for styling. Hooks and lucide icons are available in scope.

            Image generation failed - show an error message with an icon instead.
            Make sure the component fills its container (h-full w-full).

            ${designSystem ? `DESIGN CONTEXT:\n${designSystem}\n` : ''}
            Layout context: ${layoutContext}
            
            Current code:
            ${currentCode}
            
            User request: ${userPrompt}
          `;

          const fallbackResponse = await genai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: fallbackPrompt,
          });
          
          newCode = fallbackResponse.text.trim();
        }
      }

      // Clean up markdown code fences
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
    const result = await fetchGeminiCode(chatPrompt);

    if (result && result.code) {
      const newComponent = {
        id: result.componentId,
        code: result.code,
        isLocked: false,
        layout: { ...placeholderLayout, i: result.componentId },
        imageKeys: result.imageKeys, // Use the imageKeys from the result
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
      prev.map((c) => {
        if (c.id === currentEditingId) {
          // Extract any image keys from the updated code
          const imageKeys = [];
          for (const [key, data] of imageCache.entries()) {
            if (currentEditingCode.includes(data.url)) {
              imageKeys.push(key);
            }
          }
          return { ...c, code: currentEditingCode, imageKeys };
        }
        return c;
      })
    );
    handleModalClose();
  };

  const handleDeleteComponent = (id) => {
    // Clean up any cached images for this component
    cleanupImageCache(id);
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

  const clearAllComponents = async () => {
    // Clean up all cached images
    for (const comp of components) {
      await cleanupImageCache(comp.id);
    }
    await clearAllImages(); // Clear all from IndexedDB
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