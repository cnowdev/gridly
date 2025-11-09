// @ts-check
import { useState, useEffect } from 'react';

/**
 * Default settings structure
 */
const DEFAULT_SETTINGS = {
  colors: { background: '', secondary: '', text: '' },
  fonts: { primary: '', secondary: '' },
  customRules: '',
};

/**
 * Custom hook for managing application settings
 * Handles loading from localStorage, saving, and first-visit modal
 * 
 * @returns {Object} Settings state and handlers
 */
export function useSettings() {
  // Load settings from localStorage with fallback to legacy design system
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('gridly_settings');
      if (!saved) {
        // Check for legacy design system settings
        const legacy = localStorage.getItem('gridly_design_system');
        return {
          ...DEFAULT_SETTINGS,
          customRules: legacy || '',
        };
      }
      return JSON.parse(saved);
    } catch (error) {
      console.warn('Failed to parse settings, resetting to defaults.', error);
      return DEFAULT_SETTINGS;
    }
  });

  // Track if settings modal should be open
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Show settings modal on first visit
  useEffect(() => {
    const hasVisited = localStorage.getItem('gridly_has_visited');
    if (!hasVisited) {
      setIsSettingsOpen(true);
      localStorage.setItem('gridly_has_visited', 'true');
    }
  }, []);

  /**
   * Save new settings to state and localStorage
   * @param {Object} newSettings - The new settings object to save
   */
  const handleSaveSettings = (newSettings) => {
    setSettings(newSettings);
    localStorage.setItem('gridly_settings', JSON.stringify(newSettings));
    setIsSettingsOpen(false);
  };



  /**
   * Open the settings modal
   */
  const openSettings = () => {
    setIsSettingsOpen(true);
  };

  /**
   * Close the settings modal without saving
   */
  const closeSettings = () => {
    setIsSettingsOpen(false);
  };

  return {
    settings,
    isSettingsOpen,
    setIsSettingsOpen,
    handleSaveSettings,
    openSettings,
    closeSettings,
  };
}
