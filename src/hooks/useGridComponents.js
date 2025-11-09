import { loadState, saveState } from "../services/storageService";
import { clearAllImages } from "../lib/imageStorage";
import { handleExport } from "../services/exportService";
// Import 'handleCodeEdit' and alias it to 'aiHandleCodeEdit' to avoid name conflicts
import { fetchGeminiCode, handleCodeEdit as aiHandleCodeEdit, integrateComponentsWithAPI } from '../services/aiService'
import { useState, useEffect } from 'react';
import { useImageCache } from './useImageCache';
import { useSettings } from './useSettings';
import { useDrawingMode } from './useDrawingMode';
import { useComponentHistory } from './useComponentHistory';

// --- NEW HELPER FUNCTIONS for Smarter Placement ---

const TOTAL_COLS = 24;

/**
 * Checks if a rectangular area is free of components.
 */
function isSpotOpen(grid, x, y, w, h) {
  for (let j = y; j < y + h; j++) {
    for (let i = x; i < x + w; i++) {
      if (i >= TOTAL_COLS) return false; // Out of bounds horizontally
      if (grid[j] && grid[j][i]) {
        return false; // Cell is occupied
      }
    }
  }
  return true; // All cells in the rect are open
}

/**
 * Finds the first available slot (top-down, left-right) for a new component.
 */
function findNextAvailableSpot(existingComponents, w, h) {
  const grid = {}; // Use an object as a sparse 2D array
  let maxH = 0;
  
  // 1. Populate the grid with occupied cells
  existingComponents.forEach(comp => {
    const layout = comp.layout;
    maxH = Math.max(maxH, layout.y + layout.h);
    for (let y = layout.y; y < layout.y + layout.h; y++) {
      if (!grid[y]) grid[y] = {};
      for (let x = layout.x; x < layout.x + layout.w; x++) {
        grid[y][x] = true;
      }
    }
  });

  // 2. Scan row by row, then column by column, for a fit
  // Scan up to the current max height + new component height
  for (let y = 0; y < maxH + h; y++) { 
    for (let x = 0; x <= TOTAL_COLS - w; x++) {
      // Check if this (x, y) is a valid top-left corner
      if (isSpotOpen(grid, x, y, w, h)) {
        return { x, y, w, h }; // Found a spot!
      }
    }
  }
  
  // 3. If no spot is found (e.g., in a tall, sparse grid), 
  // place it at the bottom-left as a fallback.
  return { x: 0, y: maxH, w, h };
}

// --- END of NEW HELPER FUNCTIONS ---


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


  /**
   * MODIFIED: Handles the submission from the main chat bar.
   * If a placeholder is drawn, it creates the component in that box.
   * If no placeholder is drawn, it now asks the AI for a suggested size
   * and uses the `findNextAvailableSpot` algorithm to place it.
   */
  const handlePromptSubmit = async (e) => {
    e.preventDefault();
    if (!chatPrompt || isLoading) return;

    setIsLoading(true);
    // Fetch the component code from the AI. `result` now includes `layout`.
    const result = await fetchGeminiCode(chatPrompt, settings, cacheImageAsURL, imageCache);
    
    if (result && result.code) {
      let layoutToUse;
      // Get the AI's suggested layout, or use a default
      const suggestedLayout = result.layout || { w: 6, h: 4 };

      if (showPlaceholder) {
        // Use the user-drawn placeholder
        layoutToUse = { ...placeholderLayout };
      } else {
        // Auto-calculate a layout using the new algorithm
        // Find the next available spot based on AI's suggested size
        const newLayout = findNextAvailableSpot(components, suggestedLayout.w, suggestedLayout.h);
        layoutToUse = newLayout;
      }

      // Create the new component
      const newComponent = {
        id: result.componentId,
        code: result.code,
        isLocked: false,
        layout: { ...layoutToUse, i: result.componentId }, // Assign the determined layout
        imageKeys: result.imageKeys, // Use the imageKeys from the result
      };

      // Add component to history
      setComponentsWithHistory((prev) => [...prev, newComponent]);
      // Hide placeholder (if it was visible)
      setShowPlaceholder(false);
      // Ignore the next layout change from RGL's automatic positioning
      setIgnoreNextLayoutChange(true);
    }

    setChatPrompt('');
    setIsLoading(false);
  };

  /**
   * NEW: Handles a "global" prompt (e.g., "make all components dark mode").
   * Iterates over all components and calls the AI to edit each one.
   */
  const handleGlobalPromptSubmit = async (e) => {
    e.preventDefault();
    if (!chatPrompt || isLoading) return;
    
    setIsLoading(true);
    const promptToRun = chatPrompt; // Store prompt before clearing
    setChatPrompt('');
    
    try {
      // Create an array of promises, one for each component edit
      const promises = components.map(comp => 
        aiHandleCodeEdit( // Call the aliased AI edit function
          comp.code,
          promptToRun,
          components, // Pass full component list for context
          comp.id,    // Pass the specific ID of the component to edit
          settings,
          cacheImageAsURL
          // Note: This simple version doesn't handle AI-added images during global edit.
          // The logic in `handleModalSave` is better for that, but this works for style changes.
        )
      );
      
      // Wait for all AI edits to complete
      const newCodes = await Promise.all(promises);
      
      // Map the results back to a new components array
      const updatedComponents = components.map((comp, index) => {
        const newCode = newCodes[index];
        if (newCode && newCode !== comp.code) {
          // Logic from handleModalSave to find image keys in new code
          const imageKeys = [];
          for (const [key, data] of imageCache.entries()) {
              if (newCode.includes(data.url)) {
                  imageKeys.push(key);
              }
          }
          return { ...comp, code: newCode, imageKeys };
        }
        return comp; // No change for this component
      });
      
      // Save the new state to history
      setComponentsWithHistory(updatedComponents);
      
    } catch (error) {
       console.error("Global edit failed:", error);
       // You could add a user-facing alert here
    } finally {
       setIsLoading(false);
    }
  };


  const handleLayoutChange = (newLayouts) => {
    const placeholder = newLayouts.find((l) => l.i === 'placeholder');
    if (placeholder) {
      setPlaceholderLayout(placeholder);
    }
    
    if (ignoreNextLayoutChange) {
      setIgnoreNextLayoutChange(false);
      
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
      
      updateComponentsSilently(updatedComps);
      return;
    }
    
    let hasChanges = false;
    
    const updatedComps = components.map((comp) => {
      const newLayout = newLayouts.find((l) => l.i === comp.id);

      if (newLayout) {
        const newNormalizedLayout = {
          i: newLayout.i,
          x: newLayout.x,
          y: newLayout.y,
          w: newLayout.w,
          h: newLayout.h,
        };

        if (JSON.stringify(comp.layout) !== JSON.stringify(newNormalizedLayout)) {
          hasChanges = true;
          return { ...comp, layout: newNormalizedLayout };
        }
      }
      return comp;
    });

    if (hasChanges) {
      setComponentsWithHistory(updatedComps);
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setCurrentEditingId(null);
    setCurrentEditingCode('');
    setCurrentEditingLayout(null);
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
        ...componentToDuplicate.layout,
        i: newId,
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
    setCurrentEditingLayout(component.layout);
    setIsModalOpen(true);
  }

  const clearAllComponents = async () => {
    for (const comp of components) {
      await cleanupImageCache(comp.id);
    }
    await clearAllImages();
    setComponentsWithHistory([]);
    setMergedComponents([]);
    handleCancelPlaceholder();
  };

  /**
   * It calls the AI function using the `currentEditingId` from state.
   */
  const handleModalCodeEdit = async (currentCode, userPrompt) => {
    return await aiHandleCodeEdit(
      currentCode, 
      userPrompt, 
      components, 
      currentEditingId, // Use the ID from state
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
    currentEditingLayout,
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
    handleGlobalPromptSubmit, // <-- NEWLY EXPORTED
    handleLayoutChange,
    openEditModal,
    handleModalClose,
    handleModalSave,
    handleDeleteComponent,
    handleDuplicateComponent,
    handleToggleLock,
    handleCodeEdit: handleModalCodeEdit, // <-- Renamed wrapper
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