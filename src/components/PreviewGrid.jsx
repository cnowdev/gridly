import React from 'react';
import DynamicComponent from './DynamicComponent';

export default function PreviewGrid({ components, settings }) {
  // Get background color from settings, if it exists.
  const backgroundColor = settings?.colors?.background;

  return (
    <div 
      // Use bg-gray-900 only if no background color is defined in settings.
      className={`grid grid-cols-12 min-h-screen content-start ${backgroundColor ? '' : 'bg-gray-900'}`}
      style={{ 
        gridAutoRows: '20px',
        // Apply the background color if it exists
        ...(backgroundColor ? { backgroundColor } : {})
      }}
    >
      {components.map((comp) => {
        const { x, y, w, h } = comp.layout;
        return (
          <div
            key={comp.id}
            style={{
              gridColumn: `${x + 1} / span ${w}`,
              gridRow: `${y + 1} / span ${h}`,
            }}
            className="h-full w-full"
          >
            <DynamicComponent code={comp.code} />
          </div>
        );
      })}
    </div>
  );
}