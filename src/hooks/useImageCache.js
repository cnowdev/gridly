import { useState, useEffect } from 'react';
import { saveImage, loadImage, loadAllImages, deleteImage } from '../lib/imageStorage';

/**
 * Custom hook for managing image caching with IndexedDB persistence
 * Handles conversion between base64 and blob URLs, and maintains runtime cache
 * 
 * @returns {Object} Image cache utilities and state
 */
export function useImageCache() {
  // Runtime cache for blob URLs (Map<string, {url: string, key: string}>)
  const [imageCache] = useState(() => new Map());
  
  // Track if images have been loaded from IndexedDB on mount
  const [imagesLoaded, setImagesLoaded] = useState(false);

  /**
   * Converts base64 image data to a blob URL and stores it in both
   * IndexedDB (for persistence) and runtime cache (for quick access)
   * 
   * @param {string} imageBase64 - Base64 encoded image data
   * @param {string} componentId - ID of the component using this image
   * @returns {Promise<string>} The blob URL for the image
   */
  const cacheImageAsURL = async (imageBase64, componentId) => {
    const timestamp = Date.now();
    const key = `${componentId}-${timestamp}`;
    
    try {
      // Save base64 to IndexedDB for persistence across sessions
      await saveImage(key, imageBase64);
      
      // Convert base64 to blob for runtime use
      const byteCharacters = atob(imageBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/png' });
      
      // Create object URL for blob
      const objectURL = URL.createObjectURL(blob);
      
      // Store in runtime cache
      imageCache.set(key, { url: objectURL, key });
      
      return objectURL;
    } catch (error) {
      console.error('Failed to create blob URL:', error);
      // Fallback to data URL if blob creation fails
      return `data:image/png;base64,${imageBase64}`;
    }
  };

  /**
   * Restores a blob URL from IndexedDB using the image key
   * Useful for loading persisted images on app restart
   * 
   * @param {string} imageKey - The unique key for the stored image
   * @returns {Promise<string|null>} The restored blob URL or null if not found
   */
  const restoreBlobURL = async (imageKey) => {
    try {
      // Check if already cached in memory
      if (imageCache.has(imageKey)) {
        return imageCache.get(imageKey).url;
      }
      
      // Load base64 from IndexedDB
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
      
      // Cache it for future access
      imageCache.set(imageKey, { url: newURL, key: imageKey });
      
      return newURL;
    } catch (error) {
      console.error('Failed to restore blob URL:', error);
      return null;
    }
  };

  /**
   * Cleans up all cached images for a specific component
   * Revokes blob URLs and removes from both runtime cache and IndexedDB
   * 
   * @param {string} componentId - ID of the component whose images should be cleaned up
   */
  const cleanupImageCache = async (componentId) => {
    for (const [key, data] of imageCache.entries()) {
      if (key.startsWith(componentId)) {
        // Revoke the blob URL to free memory
        URL.revokeObjectURL(data.url);
        imageCache.delete(key);
        // Remove from IndexedDB
        await deleteImage(key);
      }
    }
  };

  /**
   * Restores all images from IndexedDB on component mount
   * This ensures images persist across browser sessions
   */
  useEffect(() => {
    const restoreImages = async () => {
      if (imagesLoaded) return;
      
      try {
        // Load all images from IndexedDB
        const allImages = await loadAllImages();
        
        // Convert each stored image to a blob URL
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
      } catch (error) {
        console.error('Failed to restore images:', error);
      }
    };
    
    restoreImages();
  }, [imagesLoaded, imageCache]);

  /**
   * Updates component code with restored blob URLs after images are loaded
   * This is a helper that returns updated components with fresh blob URLs
   * 
   * @param {Array} components - Array of components to update
   * @returns {Array} Updated components with restored image URLs
   */
  const updateComponentsWithRestoredImages = (components) => {
    if (!imagesLoaded) return components;

    return components.map(comp => {
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
          
          // Replace the first old URL with our restored URL
          if (oldUrls.length > 0) {
            updatedCode = updatedCode.replace(oldUrls[0], url);
            hasChanges = true;
          }
        }
      });
      
      return hasChanges ? { ...comp, code: updatedCode } : comp;
    });
  };

  return {
    imageCache,
    imagesLoaded,
    cacheImageAsURL,
    restoreBlobURL,
    cleanupImageCache,
    updateComponentsWithRestoredImages,
  };
}
