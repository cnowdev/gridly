import genAI from "../lib/genai";

// Regex to remove import/export lines
const importExportRegex = /^\s*(import|export).*;?\s*$/gm;

// Helper function to clean code from markdown, imports, and exports
const cleanAICode = (code) => {
  let cleanedCode = code.trim();
  
  // 1. Extract from markdown fences
  const match = cleanedCode.match(/```(?:jsx|javascript|js)?\n([\s\S]*?)\n```/);
  if (match) {
    cleanedCode = match[1];
  } else {
    // Fallback: remove fences if no match
    cleanedCode = cleanedCode.replace(/```jsx|```/g, "");
  }

  // 2. Remove import/export lines
  cleanedCode = cleanedCode.replace(importExportRegex, '').trim();

  return cleanedCode;
};

const getDesignSystemPrompt = (settings) => {
  const { colors, fonts, customRules } = settings;
  const parts = [
    colors.background && `- Preferred background color: ${colors.background}`,
    colors.secondary && `- Secondary color: ${colors.secondary}`,
    colors.text && `- Text color: ${colors.text}`,
    fonts.primary && `- Primary font family: ${fonts.primary}`,
    fonts.secondary && `- Secondary font family: ${fonts.secondary}`,
  ].filter(Boolean);

  if (customRules && customRules.trim()) {
    parts.push(customRules.trim());
  }

  return parts.length > 0 ? parts.join("\n") : "";
};

// Helper function to generate AI images
const generateImage = async (imagePrompt) => {
  try {
    const response = await genAI.models.generateImages({
      model: "imagen-3.0-generate-002",
      prompt: imagePrompt,
      config: {
        numberOfImages: 1,
        includeRaiReason: true,
      },
    });

    const imageBase64 = response?.generatedImages?.[0]?.image?.imageBytes;

    if (!imageBase64) {
      console.error("No image data returned from Imagen API");
      return null;
    }

    return imageBase64;
  } catch (error) {
    console.error("Image generation failed:", error);
    return null;
  }
};

export const generateText = async (prompt) => {
    try {
        const response = await genAI.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        return response.text.trim();
    } catch (error) {
        console.error('Text generation failed:', error);
        return null;
    }
}

const fetchGeminiCode = async (
  prompt,
  settings,
  cacheImageAsURL,
  imageCache
) => {
  if (!genAI) {
    alert("Gemini API Key is not set in .env file.");
    const errorId = `comp-${Date.now()}`;
    return {
      code: '() => <div className="text-red-500 p-4">Error: Please set your API key in .env</div>',
      componentId: errorId,
      imageKeys: [],
    };
  }

  const designSystem = getDesignSystemPrompt(settings);

  const systemPrompt = `
    You are an expert React and Tailwind CSS component generator.

    IMAGE GENERATION MODE IF REQUESTED explicitly.
    OTHERWISE REACT COMPONENT MODE:
    - Return ONLY a single, pure, functional React component.
    - NO 'export default', imports, or code fences.
    - Component must fill container ('h-full w-full').

    UI BEHAVIOR RULES:
    - All essential navigation MUST be visible.
    - NO conditionally hidden core elements.
    - Hooks ('useState', 'useEffect') are available.
    - Lucide icons available as 'Lucide.IconName'.
    - **CRITICAL: ALWAYS ensure text inputs (<input>, <textarea>, <select>) have readable text color (e.g., 'text-gray-900' or 'text-black') so they are visible against white backgrounds, even in dark mode containers.**

    ${designSystem ? `IMPORTANT GLOBAL DESIGN CONTEXT:\n${designSystem}\n` : ""}
`;

  const fullPrompt = `${systemPrompt}\n\nUser prompt: ${prompt}`;
  const newComponentId = `comp-${Date.now()}`;
  let imageKeys = [];

  try {
    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: fullPrompt,
    });
    let code = response.text.trim();

    if (code.startsWith("IMAGE_REQUEST:")) {
       const imagePrompt = code.replace("IMAGE_REQUEST:", "").trim();
       console.log("Generating image with prompt:", imagePrompt);

       const imageBase64 = await generateImage(imagePrompt);

       if (imageBase64) {
           const imageURL = await cacheImageAsURL(imageBase64, newComponentId);
           for (const [key, data] of imageCache.entries()) {
                if (data.url === imageURL && key.startsWith(newComponentId)) {
                    imageKeys.push(key);
                    break;
                }
           }
           const componentPrompt = `
            Create React component using this image URL: ${imageURL}
            Image description: ${imagePrompt}
            Rules: Fill container (h-full w-full), use object-contain for images.
            **CRITICAL: Ensure <input>, <textarea>, <select> have readable 'text-gray-900' or 'text-black' color.**
            ${designSystem ? `DESIGN CONTEXT:\n${designSystem}\n` : ""}
            Original request: ${prompt}
           `;
           const componentResponse = await genAI.models.generateContent({
             model: "gemini-2.5-flash",
             contents: componentPrompt,
           });
           code = componentResponse.text.trim();
       } else {
           const fallbackPrompt = `Create React component for: ${prompt}. Image generation failed, use placeholder/icon. **Ensure inputs have readable black/dark text.**`;
           const fallbackResponse = await genAI.models.generateContent({
             model: "gemini-2.5-flash",
             contents: fallbackPrompt,
           });
           code = fallbackResponse.text.trim();
       }
    }

    code = cleanAICode(code);

    return {
      code: code,
      componentId: newComponentId,
      imageKeys,
    };
  } catch (error) {
    console.error("Gemini API call failed:", error);
    return {
      code: `() => <div className="text-red-500 p-4">Error: ${error.message}</div>`,
      componentId: newComponentId,
      imageKeys: [],
    };
  }
};

const handleCodeEdit = async (
  currentCode,
  userPrompt,
  components,
  currentEditingId,
  settings,
  cacheImageAsURL
) => {
  let currentComponentContext = "";
  const currentComponent = components.find((c) => c.id === currentEditingId);

  if (currentComponent) {
    const { w, h } = currentComponent.layout;
    currentComponentContext = `The component you are editing (ID: "${currentEditingId}") is in a container with grid width ${w} and grid height ${h}.`;
  }

  const otherComponentsContext = components
    .filter((c) => c.id !== currentEditingId)
    .map((c) => `  - Component ID: "${c.id}"`)
    .join("\n");

  const gridContext = `
GRID CONTEXT:
${currentComponentContext}
${otherComponentsContext.length > 0 ? `\nOther components:\n${otherComponentsContext}\n` : ""}
`;

  const designSystem = getDesignSystemPrompt(settings);

  const editPrompt = `
    You are an expert React component editor.
    If image requested explicitly: respond IMAGE_REQUEST: [prompt]
    OTHERWISE: Return ONLY updated component function body.
    **CRITICAL: ALWAYS ensure text inputs (<input>, <textarea>, <select>) have readable text color (e.g., 'text-gray-900' or 'text-black').**

    ${designSystem ? `DESIGN CONTEXT:\n${designSystem}\n` : ""}
    ${gridContext} 

    Current code:
    ${currentCode}

    User request: ${userPrompt}
`;

  try {
    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: editPrompt,
    });
    let newCode = response.text.trim();

    if (newCode.startsWith("IMAGE_REQUEST:")) {
      const imagePrompt = newCode.replace("IMAGE_REQUEST:", "").trim();
      const imageBase64 = await generateImage(imagePrompt);

      if (imageBase64) {
        const imageURL = await cacheImageAsURL(imageBase64, currentEditingId);
        const componentPrompt = `
        Update component with image URL: ${imageURL} (Description: ${imagePrompt})
        User request: ${userPrompt}
        **CRITICAL: Ensure inputs have readable black/dark text.**
        Current code:
        ${currentCode}
        `;
        const componentResponse = await genAI.models.generateContent({
          model: "gemini-2.5-flash",
          contents: componentPrompt,
        });
        newCode = componentResponse.text.trim();
      }
    }

    return cleanAICode(newCode);
  } catch (error) {
    console.error("Gemini API edit call failed:", error);
    return currentCode;
  }
};

const integrateComponentsWithAPI = async (components, endpoints, settings) => {
  if (!genAI) {
    console.error("Gemini API Key is not set");
    return components;
  }

  if (endpoints.length === 0) {
    console.log("No endpoints to integrate");
    return components;
  }

  const designSystem = getDesignSystemPrompt(settings);

  const endpointsContext = endpoints.map(ep => 
    `- ${ep.method} ${ep.path}: ${ep.description}`
  ).join('\n');

  const systemPrompt = `
You are an expert React developer integrating frontend components with backend APIs. 

AVAILABLE API ENDPOINTS:
${endpointsContext}

API TESTING FUNCTION:
Use \`window.__API_TEST__(method, path, body)\` to call endpoints.
Returns: { status: number, ok: boolean, data: any }

INTEGRATION RULES:
1. Keep ALL existing UI/UX intact - only add API functionality.
2. Use window.__API_TEST__() (NOT fetch).
3. Add try/catch and loading states.
4. **CRITICAL: Ensure all <input>, <textarea>, <select> elements have readable 'text-gray-900' or 'text-black' color.**
5. Return ONLY the complete component function code.

${designSystem ? `DESIGN CONTEXT:\n${designSystem}\n` : ""}
`;

  try {
    const updatedComponents = [];

    for (const comp of components) {
      const prompt = `
${systemPrompt}

CURRENT COMPONENT CODE:
${comp.code}

Task: Integrate with API if relevant. Return complete component code.
`;

      const response = await genAI.models.generateContent({
        model: "gemini-2.5-pro",
        contents: prompt,
      });

      let newCode = response.text.trim();
      newCode = cleanAICode(newCode);

      updatedComponents.push({
        ...comp,
        code: newCode
      });
    }

    return updatedComponents;
  } catch (error) {
    console.error("API integration failed:", error);
    return components;
  }
};

const convertComponentToRealApi = async (componentCode) => {
    if (!genAI) return componentCode;
    if (!componentCode.includes('window.__API_TEST__')) return componentCode;

    const prompt = `
You are an expert React developer.
Convert this component's API calls from a testing harness to real, modern \`fetch\` calls.
TARGET: http://localhost:3000
RULES:
1. Replace \`window.__API_TEST__\` with \`fetch\` to http://localhost:3000 + path.
2. Handle response: \`const data = await res.json();\` and check \`res.ok\`.
3. Maintain identical logic and UI.
4. Return ONLY component function body.

CURRENT CODE:
${componentCode}
`;

    try {
        const response = await genAI.models.generateContent({
             model: "gemini-2.5-flash",
             contents: prompt,
        });
        
        let newCode = response.text.trim();
        return cleanAICode(newCode);
    } catch (error) {
        console.error("Failed to convert component to real API:", error);
        return componentCode;
    }
};

export { fetchGeminiCode, handleCodeEdit, integrateComponentsWithAPI, convertComponentToRealApi };