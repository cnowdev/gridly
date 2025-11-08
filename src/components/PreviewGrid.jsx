import React from 'react';
import DynamicComponent from './DynamicComponent';
import * as Lucide from 'lucide-react';

export default function PreviewGrid({ components }) {
  return (
    <div className="grid grid-cols-12 min-h-screen bg-gray-900">
      {components.map((comp, idx) => {
        const { x, y, w, h } = comp.layout;
        return (
          <div
            key={comp.id}
            style={{
              gridColumn: `${x + 1} / span ${w}`,
              gridRow: `${y + 1} / span ${h}`,
            }}
          >
            <DynamicComponent code={comp.code} />
          </div>
        );
      })}
    </div>
  );
}
