import React from 'react';
import { LiveProvider, LivePreview, LiveError } from 'react-live';
import * as Lucide from 'lucide-react';

const scope = {
  React,
  useState: React.useState,
  useEffect: React.useEffect,
  useCallback: React.useCallback,
  useRef: React.useRef,
  Lucide,
};

export default function DynamicComponent({ code }) {
  // Transform the code so react-live can render complex components with hooks.
  // We wrap the user's code (which is usually () => { ... }) into a named component
  // and explicitly call render(<App />).
  const transformCode = (inputCode) => {
    try {
      // Heuristic: If it looks like a function/component definition, wrap it.
      if (inputCode.includes('=>') || inputCode.includes('function')) {
        return `const App = ${inputCode}; render(<App />);`;
      }
      // Fallback for simple JSX expressions like <div />
      return `render(${inputCode});`;
    } catch (e) {
      return inputCode;
    }
  };

  return (
    <LiveProvider 
      code={code} 
      scope={scope} 
      noInline={true} 
      transformCode={transformCode}
    >
      <div className="h-full w-full">
        <div className="h-full w-full overflow-auto live-preview-wrapper">
          <LivePreview style={{ height: '100%', width: '100%' }} />
        </div>
      </div>
      <LiveError className="hidden" />
    </LiveProvider>
  );
}