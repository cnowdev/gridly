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

export { loadState, saveState };