
import { loadState, saveState } from "../services/storageService";
import { clearAllImages } from "../lib/imageStorage";
import { handleExport } from "../services/exportService";
import { fetchGeminiCode, handleCodeEdit, integrateComponentsWithAPI } from '../services/aiService'
import { useState, useEffect } from 'react';
import { useImageCache } from './useImageCache';
import { useSettings } from './useSettings';
import { useDrawingMode } from './useDrawingMode';
import { useComponentHistory } from './useComponentHistory';

export function useGridComponents() {
  const savedState = loadState();
  
  // Use the component history hook
  const {
    components,
    setComponentsWithHistory,
    updateComponentsSilently,
    handleUndo,
    handleRedo,
    canUndo,
    canRedo,
  } = useComponentHistory(savedState?.components || []);

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
  
  const [isMergedIntegrating, setIsMergedIntegrating] = useState(false);
  const [mergedComponents, setMergedComponents] = useState(() => {
    try {
      const saved = localStorage.getItem('gridly-merged-components');
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('Failed to load merged components:', error);
      return [];
    }
  });
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentEditingCode, setCurrentEditingCode] = useState('');
  const [currentEditingId, setCurrentEditingId] = useState(null);
  const [currentEditingLayout, setCurrentEditingLayout] = useState(null); 
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  // Use the image cache hook
  const {
    imageCache,
    imagesLoaded,
    cleanupImageCache,
    updateComponentsWithRestoredImages,
    cacheImageAsURL,
  } = useImageCache();

  // Use the settings hook
  const {
    settings,
    isSettingsOpen,
    setIsSettingsOpen,
    handleSaveSettings,
  } = useSettings();

  useEffect(() => {
    saveState(components, placeholderLayout);
  }, [components, placeholderLayout]);

  // Save merged components to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('gridly-merged-components', JSON.stringify(mergedComponents));
    } catch (error) {
      console.error('Failed to save merged components:', error);
    }
  }, [mergedComponents]);

  const [gridWidth, setGridWidth] = useState(1200);
  const [showPlaceholder, setShowPlaceholder] = useState(false);
  const [ignoreNextLayoutChange, setIgnoreNextLayoutChange] = useState(false);

  // Use the drawing mode hook
  const {
    isDrawing,
    drawStart,
    drawEnd,
    handleGridMouseDown,
    handleGridMouseMove,
    handleGridMouseUp,
    handleCancelPlaceholder,
  } = useDrawingMode(gridWidth, setPlaceholderLayout, setShowPlaceholder);

  // Restore blob URLs after images are loaded from IndexedDB
  useEffect(() => {
    if (imagesLoaded) {
      setComponentsWithHistory(prevComps => 
        updateComponentsWithRestoredImages(prevComps)
      );
    }
  }, [imagesLoaded, updateComponentsWithRestoredImages]);



  const handlePromptSubmit = async (e) => {
    e.preventDefault();
    if (!chatPrompt || isLoading) return;

    if (!showPlaceholder) {
      alert("Please draw a box on the grid first to set the component's position and size.");
      return;
    }

    setIsLoading(true);
    const result = await fetchGeminiCode(chatPrompt, settings, cacheImageAsURL, imageCache);

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
      updateComponentsSilently(updatedComps);
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
    
    // Also update merged components if they exist
    setMergedComponents((prev) =>
      prev.map((c) => {
        if (c.id === currentEditingId) {
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
    setMergedComponents([]); // Also clear merged components
    setPlaceholderLayout({ i: 'placeholder', x: 0, y: 0, w: 4, h: 2 });
  };

  // Wrapper for handleCodeEdit that includes necessary context
  const handleCodeEditWithContext = async (currentCode, userPrompt) => {
    return await handleCodeEdit(
      currentCode, 
      userPrompt, 
      components, 
      currentEditingId,
      settings,
      cacheImageAsURL
    );
  };

  const togglePreview = () => {
    setIsPreviewMode(!isPreviewMode);
  };

  const handleIntegrateWithAPI = async (endpoints) => {
    if (components.length === 0) {
      alert('No components to integrate!');
      return;
    }

    if (endpoints.length === 0) {
      alert('No API endpoints available to integrate!');
      return;
    }

    setIsMergedIntegrating(true);
    try {
      const integrated = await integrateComponentsWithAPI(components, endpoints, settings);
      setMergedComponents(integrated);
    } catch (error) {
      console.error('Integration failed:', error);
      alert('Failed to integrate components with API. Check console for details.');
    } finally {
      setIsMergedIntegrating(false);
    }
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
    handleCodeEdit: handleCodeEditWithContext,
    clearAllComponents,
    handleExport,
    handleGridMouseDown,
    handleGridMouseMove,
    handleGridMouseUp,
    handleCancelPlaceholder,
    togglePreview,
    handleUndo,
    handleRedo,
    canUndo,
    canRedo,
    isMergedIntegrating,
    mergedComponents,
    handleIntegrateWithAPI,
  };
}