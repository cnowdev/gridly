import React from 'react';
import DynamicComponent from './DynamicComponent';

export default function PreviewGrid({ components, settings }) {
  // Get background color from settings, if it exists.
  const backgroundColor = settings?.colors?.background;

  // Calculate the last row to ensure grid fills the space
  const maxRow = components.reduce((max, comp) => {
    return Math.max(max, comp.layout.y + comp.layout.h);
  }, 1);

  // Calculate rows needed to fill viewport
  // Account for header (60px) and ensure we fill the remaining space
  const viewportRows = Math.ceil((window.innerHeight - 60) / 20);
  const minRows = Math.max(maxRow, viewportRows);

  return (
    <div 
      className={`grid w-full min-h-full ${backgroundColor ? '' : 'bg-gray-900'}`}
      style={{ 
        // Explicitly set 24 columns
        gridTemplateColumns: 'repeat(24, minmax(0, 1fr))',
        gridTemplateRows: `repeat(${minRows}, 20px)`,
        gridAutoRows: '20px',
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