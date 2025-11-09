import JSZip from 'jszip';
import { convertComponentToRealApi } from './aiService';

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
      className="grid grid-cols-24 min-h-screen w-full"
      style={{ 
        gridTemplateColumns: 'repeat(24, minmax(0, 1fr))',
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

export const handleExport = async (components, settings) => {
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
      downloadFile(content, "gridly-export.zip");
    } catch (error) {
      console.error("Failed to generate zip file:", error);
      alert("Failed to export project. See console for details.");
    }
};

// --- NEW: Merged Export Handler ---
export const handleMergedExport = async (components, serverCode, settings, onProgress) => {
    if (components.length === 0) { alert('No components to export!'); return; }
    
    const zip = new JSZip();
    const frontend = zip.folder("frontend");
    const backend = zip.folder("backend");

    try {
        // 1. Prepare Backend
        backend.file("server.js", serverCode);
        backend.file("package.json", JSON.stringify({
            "name": "gridly-backend",
            "version": "1.0.0",
            "main": "server.js",
            "scripts": { "start": "node server.js" },
            "dependencies": { "express": "^4.18.2", "cors": "^2.8.5" }
        }, null, 2));

        // 2. Prepare Frontend (Clean up components first)
        const cleanedComponents = [];
        for (let i = 0; i < components.length; i++) {
            if (onProgress) onProgress(`Preparing component ${i + 1} of ${components.length}...`);
            // Use AI to replace window.__API_TEST__ with real fetch calls
            const cleanedCode = await convertComponentToRealApi(components[i].code);
            cleanedComponents.push({ ...components[i], code: cleanedCode });
        }

        if (onProgress) onProgress("Finalizing project files...");

        // Generate App.jsx with cleaned components
        const appJsx = generateAppJsx(cleanedComponents, settings);

        frontend.file("src/App.jsx", appJsx);
        frontend.file("package.json", getPackageJson("gridly-frontend"));
        frontend.file("tailwind.config.js", tailwindConfigContent);
        frontend.file("postcss.config.js", postcssConfigContent);
        frontend.file("index.html", indexHtmlContent);
        frontend.file("src/main.jsx", mainJsxContent);
        frontend.file("src/index.css", indexCssContent);
        frontend.file(".env", "VITE_API_URL=http://localhost:3000");

        // 3. Add README
        zip.file("README.md", `# Gridly Full-Stack Project

## Setup

1. **Backend**:
   \`\`\`bash
   cd backend
   npm install
   npm start
   \`\`\`
   Server runs on http://localhost:3000

2. **Frontend**:
   \`\`\`bash
   cd frontend
   npm install
   npm run dev
   \`\`\`
   App runs on http://localhost:5173
`);

        // 4. Generate and download
        const content = await zip.generateAsync({ type: "blob" });
        downloadFile(content, "gridly-fullstack.zip");

    } catch (error) {
        console.error("Merged export failed:", error);
        alert("Export failed. See console.");
    } finally {
        if (onProgress) onProgress(null); // Clear progress
    }
};

// package.json
const getPackageJson = (name = "gridly-export") => {
  return JSON.stringify({
    "name": name,
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
    extend: {
       gridTemplateColumns: {
        '24': 'repeat(24, minmax(0, 1fr))',
      }
    },
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