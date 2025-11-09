import { useState } from 'react';

/**
 * Custom hook for managing drawing mode on the grid
 * Handles mouse events to draw rectangular placeholders for new components
 * 
 * @param {number} gridWidth - The current width of the grid container
 * @param {Function} setPlaceholderLayout - Function to update the placeholder layout
 * @param {Function} setShowPlaceholder - Function to toggle placeholder visibility
 * @returns {Object} Drawing state and handlers
 */
export function useDrawingMode(gridWidth, setPlaceholderLayout, setShowPlaceholder) {
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState(null);
  const [drawEnd, setDrawEnd] = useState(null);

  // Grid configuration constants (matching GridContainer.jsx)
  const ROW_HEIGHT = 20;
  const COLS = 24;

  /**
   * Initiates drawing mode when user clicks on empty grid space
   * @param {MouseEvent} e - Mouse down event
   */
  const handleGridMouseDown = (e) => {
    // Only start drawing if clicking directly on the grid background
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

  /**
   * Updates the drawing rectangle as user moves mouse
   * @param {MouseEvent} e - Mouse move event
   */
  const handleGridMouseMove = (e) => {
    if (!isDrawing) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left + e.currentTarget.scrollLeft;
    const y = e.clientY - rect.top + e.currentTarget.scrollTop;
    
    setDrawEnd({ x, y });
  };

  /**
   * Completes the drawing and converts to a grid layout
   * @param {MouseEvent} e - Mouse up event
   */
  const handleGridMouseUp = (e) => {
    if (!isDrawing) return;
    setIsDrawing(false);

    const colWidth = gridWidth / COLS;

    const startX = Math.min(drawStart.x, drawEnd.x);
    const startY = Math.min(drawStart.y, drawEnd.y);
    const endX = Math.max(drawStart.x, drawEnd.x);
    const endY = Math.max(drawStart.y, drawEnd.y);

    // Convert pixel coordinates to grid coordinates
    const newLayout = {
      i: 'placeholder',
      x: Math.floor(startX / colWidth),
      y: Math.floor(startY / ROW_HEIGHT),
      w: Math.max(1, Math.round((endX - startX) / colWidth)),
      h: Math.max(1, Math.round((endY - startY) / ROW_HEIGHT)),
    };

    // Ignore very small selections
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

  /**
   * Cancels the current placeholder
   */
  const handleCancelPlaceholder = () => {
    setShowPlaceholder(false);
    setDrawStart(null);
    setDrawEnd(null);
    setPlaceholderLayout({ i: 'placeholder', x: 0, y: 0, w: 4, h: 2 });
  };

  /**
   * Calculates the style for the visual drawing rectangle overlay
   * @param {number} scrollTop - Current scroll top position
   * @param {number} scrollLeft - Current scroll left position
   * @returns {Object} Style object for the drawing rectangle
   */
  const getDrawingRect = (scrollTop = 0, scrollLeft = 0) => {
    if (!drawStart || !drawEnd) return { display: 'none' };

    const left = Math.min(drawStart.x, drawEnd.x) - scrollLeft;
    const top = Math.min(drawStart.y, drawEnd.y) - scrollTop;
    const width = Math.abs(drawStart.x - drawEnd.x);
    const height = Math.abs(drawStart.y - drawEnd.y);

    return {
      position: 'absolute',
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
      backgroundColor: 'rgba(71, 85, 105, 0.5)',
      border: '2px dashed #94a3b8',
      borderRadius: '0.5rem',
      zIndex: 40,
    };
  };

  return {
    isDrawing,
    drawStart,
    drawEnd,
    handleGridMouseDown,
    handleGridMouseMove,
    handleGridMouseUp,
    handleCancelPlaceholder,
    getDrawingRect,
  };
}