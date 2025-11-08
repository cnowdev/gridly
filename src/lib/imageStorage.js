// IndexedDB wrapper for storing images
const DB_NAME = 'gridly-images-db';
const STORE_NAME = 'images';
const DB_VERSION = 1;

let dbInstance = null;

// Initialize IndexedDB
const initDB = () => {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Failed to open IndexedDB:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

// Save an image to IndexedDB
export const saveImage = async (id, base64Data) => {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const imageData = {
      id,
      base64: base64Data,
      timestamp: Date.now(),
    };
    
    await new Promise((resolve, reject) => {
      const request = store.put(imageData);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    
    return true;
  } catch (error) {
    console.error('Failed to save image to IndexedDB:', error);
    return false;
  }
};

// Load an image from IndexedDB
export const loadImage = async (id) => {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    return await new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result.base64);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to load image from IndexedDB:', error);
    return null;
  }
};

// Load all images from IndexedDB
export const loadAllImages = async () => {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    return await new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const images = {};
        request.result.forEach(item => {
          images[item.id] = item.base64;
        });
        resolve(images);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to load all images from IndexedDB:', error);
    return {};
  }
};

// Delete an image from IndexedDB
export const deleteImage = async (id) => {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    await new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    
    return true;
  } catch (error) {
    console.error('Failed to delete image from IndexedDB:', error);
    return false;
  }
};

// Delete all images from IndexedDB
export const clearAllImages = async () => {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    await new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    
    return true;
  } catch (error) {
    console.error('Failed to clear all images from IndexedDB:', error);
    return false;
  }
};

// Get all image IDs
export const getAllImageIds = async () => {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    return await new Promise((resolve, reject) => {
      const request = store.getAllKeys();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to get all image IDs from IndexedDB:', error);
    return [];
  }
};
