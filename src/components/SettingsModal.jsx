import React, { useState, useEffect } from 'react';
import * as Lucide from 'lucide-react';
// Import defaults from the new shared file
import { DEFAULT_SETTINGS } from './../settings';

// --- Helper Function ---
// Checks if a string is a valid 3, 4, 6, or 8-digit hex color
const isValidHex = (color) => {
  if (!color || typeof color !== 'string') return false;
  // Regex for #rgb, #rgba, #rrggbb, #rrggbbaa
  const hexRegex = /^#([0-9a-fA-F]{3,4}){1,2}$/;
  return hexRegex.test(color);
};

// --- ColorInput Component ---
const ColorInput = ({ label, value, onChange, placeholder = '#000000' }) => {
  // Only apply the color to the preview box if it's a valid hex code
  // Otherwise, default to transparent.
  const displayColor = isValidHex(value) ? value : 'transparent';

  const handleChange = (e) => {
    let input = e.target.value;
    // 1. Remove all non-hex characters (keep letters a-f, numbers 0-9)
    let hex = input.replace(/[^0-9a-fA-F]/gi, '');

    // 2. Truncate to max 8 chars (for rrggbbaa)
    if (hex.length > 8) {
      hex = hex.substring(0, 8);
    }

    // 3. If hex is not empty, prepend '#'.
    //    Otherwise, pass an empty string to allow clearing the field.
    const newValue = hex.length > 0 ? '#' + hex : '';

    // 4. Call the parent onChange with the formatted value
    onChange(newValue);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-300">{label}</label>
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-lg border border-gray-600 flex-shrink-0 transition-colors"
          style={{ backgroundColor: displayColor }} // Use the validated color
        />
        <input
          type="text"
          value={value || ''} // Use || '' to avoid null/undefined values
          onChange={handleChange} // Use the new smart handler
          placeholder={placeholder}
          className="flex-1 min-w-0 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  );
};

// --- Welcome Screen Component ---
const WelcomeScreen = () => (
  <div className="flex flex-col items-center justify-center text-center p-4">
    <Lucide.PartyPopper size={48} className="text-blue-500 mb-4" />
    <h3 className="text-2xl font-bold text-white mb-2">Welcome!</h3>
    <p className="text-gray-300 mb-6 max-w-md">
      This is your design settings panel. You can customize the look and feel of
      your app here, including colors, fonts, and other design rules.
    </p>
    <p className="text-gray-400 text-sm">
      You can either customize these settings now or just use the defaults to get
      started. You can always change this later by clicking the Settings icon.
    </p>
  </div>
);

// --- Main SettingsModal Component ---
export default function SettingsModal({
  isOpen,
  onClose,
  settings,
  onSave,
  isFirstTime = false,
}) {
  const [localSettings, setLocalSettings] = useState(
    settings || DEFAULT_SETTINGS
  );
  const [showWelcome, setShowWelcome] = useState(isFirstTime);

  useEffect(() => {
    if (isOpen) {
      setLocalSettings(settings || DEFAULT_SETTINGS);
      setShowWelcome(isFirstTime);
    }
  }, [settings, isOpen, isFirstTime]);

  if (!isOpen) return null;

  const handleColorChange = (key, value) => {
    setLocalSettings((prev) => ({
      ...prev,
      colors: { ...prev.colors, [key]: value },
    }));
  };

  const handleFontChange = (key, value) => {
    setLocalSettings((prev) => ({
      ...prev,
      fonts: { ...prev.fonts, [key]: value },
    }));
  };

  const renderWelcomeContent = () => (
    <div className="p-5 flex-grow overflow-y-auto flex flex-col gap-5 justify-center">
      <WelcomeScreen />
    </div>
  );

  const renderSettingsForm = () => (
    <div className="p-5 flex-grow overflow-y-auto flex flex-col gap-5">
      {/* Colors Section */}
      <div>
        <h3 className="text-md font-semibold text-white flex items-center gap-2 border-b border-gray-700 pb-2 mb-4">
          <Lucide.Palette size={18} /> Colors
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ColorInput
            label="Background"
            value={localSettings.colors.background}
            onChange={(v) => handleColorChange('background', v)}
            placeholder="#111827"
          />
          <ColorInput
            label="Secondary"
            value={localSettings.colors.secondary}
            onChange={(v) => handleColorChange('secondary', v)}
            placeholder="#374151"
          />
          <ColorInput
            label="Text"
            value={localSettings.colors.text}
            onChange={(v) => handleColorChange('text', v)}
            placeholder="#3B82F6"
          />
        </div>
      </div>

      {/* Fonts Section */}
      <div>
        <h3 className="text-md font-semibold text-white flex items-center gap-2 border-b border-gray-700 pb-2 mb-4">
          <Lucide.Type size={18} /> Typography
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-300">
              Primary Font
            </label>
            <input
              type="text"
              value={localSettings.fonts.primary}
              onChange={(e) => handleFontChange('primary', e.target.value)}
              placeholder="e.g., Inter, sans-serif"
              className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-300">
              Secondary Font
            </label>
            <input
              type="text"
              value={localSettings.fonts.secondary}
              onChange={(e) => handleFontChange('secondary', e.target.value)}
              placeholder="e.g., Merriweather, serif"
              className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Other Rules Section */}
      <div className="flex flex-col gap-1.5">
        <h3 className="text-md font-semibold text-white flex items-center gap-2 border-b border-gray-700 pb-2 mb-4">
          <Lucide.FileText size={18} /> Other Design Rules
        </h3>
        <textarea
          value={localSettings.customRules}
          onChange={(e) =>
            setLocalSettings((prev) => ({
              ...prev,
              customRules: e.target.value,
            }))
          }
          placeholder="- Use rounded-xl for all cards&#10;- Buttons should have shadow-md"
          className="h-32 bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono resize-none"
          spellCheck={false}
        />
      </div>
    </div>
  );

  const renderFooter = () => (
    <div className="flex-shrink-0 flex justify-between items-center p-4 border-t border-gray-700 bg-gray-800">
      {/* Left side: Reset button (only visible when customizing) */}
      <div>
        {!showWelcome && (
          <button
            onClick={() => setLocalSettings(DEFAULT_SETTINGS)}
            className="px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 font-medium transition-colors flex items-center gap-2 text-sm"
            title="Reset all fields to their default values"
          >
            <Lucide.RotateCcw size={16} />
            <span className="hidden sm:inline">Reset to Defaults</span>
          </button>
        )}
      </div>

      {/* Right side: Main actions */}
      <div className="flex items-center gap-3">
        {showWelcome ? (
          <>
            <button
              onClick={() => onSave(DEFAULT_SETTINGS)}
              className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-medium transition-colors"
            >
              Use Defaults & Close
            </button>
            <button
              onClick={() => setShowWelcome(false)} // Switch to settings form
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors flex items-center gap-2"
            >
              Customize <Lucide.ArrowRight size={16} />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => {
                if (isFirstTime) {
                  onSave(settings || DEFAULT_SETTINGS);
                } else {
                  onClose();
                }
              }}
              className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onSave(localSettings)}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors flex items-center gap-2"
            >
              <Lucide.Save size={16} />
              Save Settings
            </button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col ring-1 ring-gray-700 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 flex justify-between items-center p-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Lucide.Settings size={20} />
            {showWelcome ? 'Welcome!' : 'Design Settings'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <Lucide.X size={20} />
          </button>
        </div>

        {/* Content: Welcome or Settings */}
        {showWelcome ? renderWelcomeContent() : renderSettingsForm()}

        {/* Footer: Conditional Buttons */}
        {renderFooter()}
      </div>
    </div>
  );
}