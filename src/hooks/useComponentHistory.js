import { useState } from 'react';

/**
 * Custom hook for managing component history with undo/redo functionality
 * Tracks state changes and provides time-travel debugging capabilities
 * 
 * @param {Array} initialComponents - Initial components array
 * @returns {Object} History state and management functions
 */
export function useComponentHistory(initialComponents = []) {
  const [history, setHistory] = useState([initialComponents]);
  const [historyIndex, setHistoryIndex] = useState(0);
  
  // Current components is the component array at the current history index
  const components = history[historyIndex];

  /**
   * Updates components with history tracking
   * Supports both direct values and updater functions
   * Performs deep comparison to avoid duplicate history entries
   * 
   * @param {Array|Function} newComponentsOrFn - New components or updater function
   */
  const setComponentsWithHistory = (newComponentsOrFn) => {
    const currentComponents = history[historyIndex];

    // Resolve the new state (whether it's a value or a function)
    const newComponents = typeof newComponentsOrFn === 'function' 
      ? newComponentsOrFn(currentComponents)
      : newComponentsOrFn;

    // Deep-compare the new state with the current state
    // If they are the same, don't create a new history entry
    if (JSON.stringify(newComponents) === JSON.stringify(currentComponents)) {
      return;
    }

    // Cut off the 'future' history if we've undone
    const currentHistory = history.slice(0, historyIndex + 1);
    
    const newHistory = [...currentHistory, newComponents];
    
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  /**
   * Updates components without creating a history entry
   * Useful for programmatic updates that shouldn't be undoable
   * 
   * @param {Array} updatedComponents - New components array
   */
  const updateComponentsSilently = (updatedComponents) => {
    setHistory(prev => {
      const newHistory = [...prev];
      newHistory[historyIndex] = updatedComponents;
      return newHistory;
    });
  };

  /**
   * Moves back one step in history
   */
  const handleUndo = () => {
    setHistoryIndex(prevIndex => Math.max(0, prevIndex - 1));
  };

  /**
   * Moves forward one step in history
   */
  const handleRedo = () => {
    setHistoryIndex(prevIndex => Math.min(history.length - 1, prevIndex + 1));
  };

  /**
   * Clears all history and resets to empty state
   */
  const clearHistory = () => {
    setHistory([[]]);
    setHistoryIndex(0);
  };

  /**
   * Resets history to a specific state
   * 
   * @param {Array} newComponents - New component array to set
   */
  const resetHistory = (newComponents) => {
    setHistory([newComponents]);
    setHistoryIndex(0);
  };

  return {
    components,
    history,
    historyIndex,
    setComponentsWithHistory,
    updateComponentsSilently,
    handleUndo,
    handleRedo,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
    clearHistory,
    resetHistory,
  };
}
