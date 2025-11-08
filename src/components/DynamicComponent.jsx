import React from 'react';
import { LiveProvider, LivePreview, LiveError } from 'react-live';
import * as Lucide from 'lucide-react';

const scope = {
  React,
  useState: React.useState,
  useEffect: React.useEffect,
  useCallback: React.useCallback,
  useRef: React.useRef,
  ...Lucide,
};

export default function DynamicComponent({ code }) {
  return (
    <LiveProvider code={code} scope={scope}>
      <div className="h-full w-full">
        <div className="h-full w-full overflow-auto live-preview-wrapper">
          <LivePreview className="h-full w-full" />
        </div>
      </div>
      <LiveError className="hidden" />
    </LiveProvider>
  );
}