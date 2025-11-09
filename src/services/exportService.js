// Now generates a full App.jsx file and accepts settings for styling.
const generateAppJsx = (components, settings) => {
  const backgroundColor = settings?.colors?.background || '#111827'; // Default to gray-900
  
  // Calculate minimum rows needed
  const maxRow = components.reduce((max, comp) => {
    return Math.max(max, comp.layout.y + comp.layout.h);
  }, 1);
  const minRows = Math.max(maxRow, 50);

  const jsx = `import React, { useState, useEffect, useRef } from 'react';
import * as Lucide from 'lucide-react';

${components.map((comp, idx) => `// Component ${idx + 1}
const Component${idx} = ${comp.code};
`).join('\n')}

export default function App() {
  return (
    <div 
      className="grid grid-cols-12 min-h-screen w-full"
      style={{ 
        gridTemplateRows: 'repeat(${minRows}, 20px)',
        gridAutoRows: '20px',
        backgroundColor: '${backgroundColor}'
      }}
    >
${components.map((comp, idx) => {
      const { x, y, w, h } = comp.layout;
      return `      <div 
        key="${comp.id}"
        style={{ 
          gridColumn: '${x + 1} / span ${w}',
          gridRow: '${y + 1} / span ${h}',
          height: '100%',
          width: '100%'
        }}
      >
        <Component${idx} />
      </div>`;
    }).join('\n')}
    </div>
  );
}
`;

  return jsx;
};

// Helper for downloading any blob.
const downloadFile = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const handleExport = async () => {
    if (components.length === 0) {
      alert('No components to export!');
      return;
    }

    const zip = new JSZip();

    // Create App.jsx
    const appJsx = generateAppJsx(components, settings); // Pass settings
    zip.file("src/App.jsx", appJsx);
    
    // Add all other files
    zip.file("package.json", getPackageJson());
    zip.file("tailwind.config.js", tailwindConfigContent);
    zip.file("postcss.config.js", postcssConfigContent);
    zip.file("index.html", indexHtmlContent);
    zip.file("src/main.jsx", mainJsxContent);
    zip.file("src/index.css", indexCssContent);
    
    // Generate and download zip
    try {
      const content = await zip.generateAsync({ type: "blob" });
      downloadFile(content, "gridly-export.zip"); // Use the new helper
    } catch (error) {
      console.error("Failed to generate zip file:", error);
      alert("Failed to export project. See console for details.");
    }
};

// package.json
const getPackageJson = () => {
  return JSON.stringify({
    "name": "gridly-export",
    "private": true,
    "version": "0.0.0",
    "type": "module",
    "scripts": {
      "dev": "vite",
      "build": "vite build",
      "preview": "vite preview"
    },
    "dependencies": {
      "lucide-react": "^0.553.0",
      "react": "^19.1.1",
      "react-dom": "^19.1.1"
    },
    "devDependencies": {
      "@vitejs/plugin-react": "^5.0.4",
      "autoprefixer": "^10.4.21",
      "postcss": "^8.5.6",
      "tailwindcss": "^3.4.17",
      "vite": "^7.1.7"
    }
  }, null, 2);
};

// tailwind.config.js
const tailwindConfigContent = `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}`;

// postcss.config.js
const postcssConfigContent = `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}`;

// index.html
const indexHtmlContent = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Gridly Export</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`;

// main.jsx
const mainJsxContent = `import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)`;

// index.css
const indexCssContent = `@tailwind base;
@tailwind components;
@tailwind utilities;`;
