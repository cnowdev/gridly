import React from 'react';
import { LiveProvider, LivePreview, LiveError } from 'react-live';
import * as Lucide from 'lucide-react';
import { generateText } from '../services/aiService';

const scope = {
  React,
  useState: React.useState,
  useEffect: React.useEffect,
  useCallback: React.useCallback,
  useRef: React.useRef,
  Lucide: Lucide,
  generateText: generateText,
};

export default function DynamicComponent({ code }) {
  return (
    <LiveProvider code={code} scope={scope}>
      {/* Robust trapping container:
        - relative: establishes new positioning context for absolute children.
        - w-full h-full: fills the React-Grid-Layout item exactly.
        - overflow-hidden: clips any children that try to escape.
      */}
      <div className="relative w-full h-full overflow-hidden">
        <LivePreview style={{ height: '100%', width: '100%' }} />
        <LiveError 
          className="absolute bottom-0 left-0 right-0 max-h-[50%] overflow-auto bg-red-900/90 text-red-200 p-2 text-xs font-mono z-50" 
        />
      </div>
    </LiveProvider>
  );
}