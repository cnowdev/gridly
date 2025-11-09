import genAI from "../lib/genai";

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
      layout: { w: 6, h: 4 }, // Return default layout
    };
  }

  const designSystem = getDesignSystemPrompt(settings);

  const systemPrompt = `
    You are an expert React and Tailwind CSS component generator.

    ==========================
    STRICT IMAGE GENERATION MODE
    ==========================
    If the user is EXPLICITLY asking for an AI-generated image, illustration, photo, or visual asset:
    - You MUST respond with EXACTLY ONE LINE in this format:
      IMAGE_REQUEST: [detailed, specific, vivid description of the image to generate]
    - NOTHING ELSE may appear in your response.
    - DO NOT include:
      • any explanation, commentary, or markdown
      • any placeholder text or sample captions
      • any references to how the image will be used
      • any indication that you are generating or returning an image
      • any fallbacks, alt text, or component wrappers
    - DO NOT mention file formats, aspect ratios, or prompts like “this image shows.”
    - Output ONLY the raw descriptive text of the image after "IMAGE_REQUEST:".
    - Assume the image will be inserted into a React component automatically elsewhere.
    - If the user also requests text in the image, include that text inside the description (e.g., “a poster that says ‘Welcome Home’ in cursive”).
    - Otherwise, DO NOT include or reference any text within or around the image.
    - DO NOT add padding, simply the image to fill the space as appropriate.
    - If centering causes empty space or awkward composition (e.g., subject cut off or head cropped),
    then crop the image intelligently ONLY using \`object-contain\` to preserve a balanced frame.
    - Never distort the image — maintain the correct aspect ratio at all times.
    - The container should control overall sizing and shape, not the image’s intrinsic dimensions.
    - Use a flexible layout that adapts to different screen sizes while preserving composition.
    - DO NOT use a mx-width or max-height or fixed width/height that would cut off part of the image (only w-full, h-full)
    - Use object-contain to control aspect ratio
    - Use w-full to control width
    - Use h-full to ensure it fills the container height

    ==========================
    REACT COMPONENT MODE
    ==========================
    If the user is NOT explicitly asking for an AI-generated image:
    Respond ONLY with a single, pure, functional React component.
    - DO NOT include 'export default', 'React.createElement', or code fences.
    - DO NOT include imports.
    - Use Tailwind CSS for styling.
    - The component must fill its container ('h-full w-full') and be responsive.

    UI BEHAVIOR RULES:
    - All essential navigation items (Dashboard, Profile, Settings, Home, etc.) MUST be visible on initial render.
    - DO NOT hide or conditionally render any essential UI elements.
    - DO NOT use classes such as 'hidden', 'opacity-0', 'invisible', or 'sr-only'.
    - You MAY use responsive utilities (flex-wrap, justify-between, gap-x-4), but visibility must remain 100%.
    - Buttons and links must have visible text or Lucide icons.
    - Use semantic HTML (<header>, <nav>, <main>, etc.) and readable contrast.
    - Use Tailwind utilities for hierarchy, spacing, and layout.
    - Hooks ('useState', 'useEffect', 'useRef') are available.
    - Lucide icons are available as 'Lucide.IconName' (e.g., <Lucide.User />).
    - You also have access to async function generateText(prompt) for generating text content. Use this if you need to generate dynamic text content, like implementing a chatbot.

    Before returning:
    - VERIFY that all navigation or core elements are visible.
    - VERIFY that no text or component is conditionally rendered or hidden.
    - Ensure consistent design and alignment.

    ${designSystem ? `IMPORTANT GLOBAL DESIGN CONTEXT:\n${designSystem}\n` : ""}

    If the user's request conflicts with the design system, follow the user’s intent first.

    ---
    NEW: At the very end of your response, on a new line, provide a suggested layout in this *exact* format:
    // LAYOUT: {"w": 6, "h": 4}
    Choose 'w' (width) between 4 and 12 (out of 24 cols) and 'h' (height) between 3 and 10 (rows).
    Choose a size that best fits the component's content.
`;

  const fullPrompt = `${systemPrompt}\n\nUser prompt: ${prompt}`;

  // Generate component ID first
  const newComponentId = `comp-${Date.now()}`;
  let imageKeys = [];
  let layout = { w: 6, h: 4 }; // Default layout
  
  // Helper to parse layout and clean code
  const parseLayoutAndCleanCode = (rawCode) => {
      let cleanCode = rawCode;
      let parsedLayout = { ...layout }; // Start with default or already found layout
      const layoutMatch = rawCode.match(/\/\/ LAYOUT: (\{.*\})/);
      
      if (layoutMatch && layoutMatch[1]) {
          try {
              const parsed = JSON.parse(layoutMatch[1]);
              if (parsed.w && parsed.h) {
                  parsedLayout = { w: parsed.w, h: parsed.h };
              }
          } catch (e) { /* ignore parse error, use default */ }
          
          // Remove the layout comment from the code
          cleanCode = rawCode.replace(/\/\/ LAYOUT: \{.*\}/, '').trim();
      }
      return { cleanCode: cleanCode.trim(), layout: parsedLayout };
  };


  try {
    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: fullPrompt,
    });
    let code = response.text.trim();

    // Check if AI detected an image request
    if (code.startsWith("IMAGE_REQUEST:")) {
      const imagePrompt = code.replace("IMAGE_REQUEST:", "").trim();
      console.log("Generating image with prompt:", imagePrompt);

      const imageBase64 = await generateImage(imagePrompt);

      if (imageBase64) {
        // Use the component ID we already generated
        const imageURL = await cacheImageAsURL(imageBase64, newComponentId);

        // Extract the actual key from the cache
        for (const [key, data] of imageCache.entries()) {
          if (data.url === imageURL && key.startsWith(newComponentId)) {
            imageKeys.push(key);
            break;
          }
        }

        // Now re-prompt to generate the full component with the image URL
        const componentPrompt = `
        You are an expert React and Tailwind CSS component generator.
        Return the entire component function only. DO NOT include exports, imports, or code fences.
        Use Tailwind CSS for styling. Hooks and lucide icons are available in scope.

        Use this image URL in your component:
        <img src="${imageURL}" alt="${imagePrompt.replace(
          /"/g,
          "&quot;"
        )}" className="your-tailwind-classes" />

        Rules:
        - DO NOT add titles, captions, or descriptive text of any kind.
        - DO NOT add buttons, labels, or other UI elements unless explicitly requested.
        - DO NOT add padding, simply the image to fill the space as appropriate.
        - If centering causes empty space or awkward composition (e.g., subject cut off or head cropped),
        then crop the image intelligently ONLY using \`object-contain\` to preserve a balanced frame.
        - Never distort the image — maintain the correct aspect ratio at all times.
        - The container should control overall sizing and shape, not the image’s intrinsic dimensions.
        - Use a flexible layout that adapts to different screen sizes while preserving composition.
        - DO NOT use a mx-width or max-height or fixed width/height that would cut off part of the image (only w-full, h-full)
        IMPORTANT: Size the image appropriately using Tailwind classes:
        - Use object-contain to control aspect ratio
        - Use w-full to control width
        - Use h-full to ensure it fills the container height
        - Consider using rounded corners (rounded-lg, rounded-xl) for aesthetics
        
        Style the image appropriately with Tailwind CSS to fit the overall component design.
        Make sure the component fills its container (h-full w-full).

        ${
          designSystem
            ? `IMPORTANT GLOBAL DESIGN CONTEXT:\n${designSystem}\n`
            : ""
        }

        Original user request: ${prompt}

        ---
        NEW: At the very end of your response, on a new line, provide a suggested layout in this *exact* format:
        // LAYOUT: {"w": 6, "h": 4}
        Choose 'w' (width) between 4 and 12 and 'h' (height) between 3 and 10.
        `;

        const componentResponse = await genAI.models.generateContent({
          model: "gemini-2.5-flash",
          contents: componentPrompt,
        });
        
        // Parse layout and code from the second prompt
        const parsedResult = parseLayoutAndCleanCode(componentResponse.text.trim());
        code = parsedResult.cleanCode;
        layout = parsedResult.layout;

      } else {
        // If image generation failed, prompt for a fallback component
        const fallbackPrompt = `
        You are an expert React and Tailwind CSS component generator.
        Return the entire component function only. DO NOT include exports, imports, or code fences.
        Use Tailwind CSS for styling. Hooks and lucide icons are available in scope.

        Image generation failed - create a component with a placeholder or Lucide icon instead.
        Make sure the component fills its container (h-full w-full).

        ${
          designSystem
            ? `IMPORTANT GLOBAL DESIGN CONTEXT:\n${designSystem}\n`
            : ""
        }

        Original user request: ${prompt}

        ---
        NEW: At the very end of your response, on a new line, provide a suggested layout in this *exact* format:
        // LAYOUT: {"w": 4, "h": 3}
        `;

        const fallbackResponse = await genAI.models.generateContent({
          model: "gemini-2.5-flash",
          contents: fallbackPrompt,
        });

        // Parse layout and code from the fallback prompt
        const parsedResult = parseLayoutAndCleanCode(fallbackResponse.text.trim());
        code = parsedResult.cleanCode;
        layout = parsedResult.layout;
      }
    } else {
      // Regular code generation - parse layout and clean code
      const parsedResult = parseLayoutAndCleanCode(code);
      code = parsedResult.cleanCode;
      layout = parsedResult.layout;
    }

    // Regular code generation - clean up markdown
    const match = code.match(/```(?:jsx|javascript|js)?\n([\s\S]*?)\n```/);
    if (match) code = match[1];
    else code = code.replace(/```jsx|```/g, "");

    return {
      code: code.trim(),
      componentId: newComponentId,
      imageKeys,
      layout, // Return the parsed layout
    };
  } catch (error) {
    console.error("Gemini API call failed:", error);
    return {
      code: `() => <div className="text-red-500 p-4">Error: ${error.message}</div>`,
      componentId: newComponentId,
      imageKeys: [],
      layout: { w: 6, h: 4 }, // Return default layout
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
    .filter((c) => c.id !== currentEditingId) // Get all *other* components
    .map(
      (c) =>
        `  - Component ID: "${c.id}" (Layout: x: ${c.layout.x}, y: ${c.layout.y}, w: ${c.layout.w}, h: ${c.layout.h})`
    )
    .join("\n");

  // Combine all grid context into one block
  const gridContext = `
GRID CONTEXT:
${currentComponentContext}
${
  otherComponentsContext.length > 0
    ? `
Here are the other components on the grid (the user may refer to them by ID):
${otherComponentsContext}
`
    : ""
}
`;

  const designSystem = getDesignSystemPrompt(settings);

  const editPrompt = `
    ONLY IF the user is EXPLICITLY asking for an AI-generated image, photo, illustration, graphic, or visual asset to be added/changed:
    - Respond with exactly: IMAGE_REQUEST: [detailed, descriptive prompt for image generation]
    - Make the image prompt detailed and specific
    Rules:
    - DO NOT add titles, captions, or descriptive text of any kind.
    - DO NOT add buttons, labels, or other UI elements unless explicitly requested.
    - DO NOT add padding, simply the image to fill the space as appropriate.
    - If centering causes empty space or awkward composition (e.g., subject cut off or head cropped),
    then crop the image intelligently ONLY using \`object-contain\` to preserve a balanced frame.
    - Never distort the image — maintain the correct aspect ratio at all times.
    - The container should control overall sizing and shape, not the image’s intrinsic dimensions.
    - Use a flexible layout that adapts to different screen sizes while preserving composition.
    - DO NOT use a mx-width or max-height or fixed width/height that would cut off part of the image (only w-full, h-full)
    - Use object-contain to control aspect ratio
    - Use w-full to control width
    - Use h-full to ensure it fills the container height
    
    OTHERWISE:
    You are an expert React and Tailwind CSS component editor.
    Return the entire new component function only. DO NOT include exports, imports, or code fences.
    Use Tailwind CSS for styling. Hooks are available in scope. All Lucide icons are available under 
    the 'Lucide' namespace (e.g., <Lucide.User />, <Lucide.Bell />, etc).

    ${designSystem ? `IMPORTANT GLOBAL DESIGN CONTEXT:\n${designSystem}\n` : ""}

    ${gridContext} 

    Current code (for component "${currentEditingId}"):
    ${currentCode}

    User request: ${userPrompt}
`;

  try {
    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: editPrompt,
    });
    let newCode = response.text.trim();

    // Check if AI detected an image request
    if (newCode.startsWith("IMAGE_REQUEST:")) {
      const imagePrompt = newCode.replace("IMAGE_REQUEST:", "").trim();
      console.log("Generating image for edit with prompt:", imagePrompt);

      const imageBase64 = await generateImage(imagePrompt);

      if (imageBase64) {
        // Convert base64 to blob URL (await it!)
        const imageURL = await cacheImageAsURL(imageBase64, currentEditingId);

        // Generate component code that includes the image URL
        const componentPrompt = `
        You are an expert React and Tailwind CSS component editor.
        Return the entire new component function only. DO NOT include exports, imports, or code fences.
        Use Tailwind CSS for styling. Hooks and lucide icons are available in scope.

        The user requested an image be ${
          currentCode.includes("blob:") || currentCode.includes("data:image")
            ? "replaced"
            : "added"
        } to the component.
        
        Use this image URL in your component:
        <img src="${imageURL}" alt="${imagePrompt.replace(
          /"/g,
          "&quot;"
        )}" className="your-tailwind-classes" />

        Rules:
        - DO NOT add titles, captions, or descriptive text of any kind.
        - DO NOT add buttons, labels, or other UI elements unless explicitly requested.
        - DO NOT add padding, simply the image to fill the space as appropriate.
        - If centering causes empty space or awkward composition (e.g., subject cut off or head cropped),
        then crop the image intelligently ONLY using \`object-contain\` to preserve a balanced frame.
        - Never distort the image — maintain the correct aspect ratio at all times.
        - The container should control overall sizing and shape, not the image’s intrinsic dimensions.
        - Use a flexible layout that adapts to different screen sizes while preserving composition.
        - DO NOT use a mx-width or max-height or fixed width/height that would cut off part of the image (only w-full, h-full)
        IMPORTANT: Size the image appropriately using Tailwind classes:
        - Use object-contain to control aspect ratio
        - Use w-full to control width
        - Use h-full to ensure it fills the container height
        - Consider using rounded corners (rounded-lg, rounded-xl) for aesthetics
        
        Style the image appropriately with Tailwind CSS to fit the component's design.
        Make sure the component fills its container (h-full w-full).

        ${designSystem ? `DESIGN CONTEXT:\n${designSystem}\n` : ""}
        ${gridContext}
        
        Current code:
        ${currentCode}
        
        User request: ${userPrompt}
        `;

        const componentResponse = await genAI.models.generateContent({
          model: "gemini-2.5-flash",
          contents: componentPrompt,
        });

        newCode = componentResponse.text.trim();
      } else {
        // If image generation failed, prompt for a fallback
        const fallbackPrompt = `
        You are an expert React and Tailwind CSS component editor.
        Return the entire new component function only. DO NOT include exports, imports, or code fences.
        Use Tailwind CSS for styling. Hooks and lucide icons are available in scope.

        Image generation failed - show an error message with an icon instead.
        Make sure the component fills its container (h-full w-full).

        ${designSystem ? `DESIGN CONTEXT:\n${designSystem}\n` : ""}
        ${gridContext}
        
        Current code:
        ${currentCode}
        
        User request: ${userPrompt}
        `;

        const fallbackResponse = await genAI.models.generateContent({
          model: "gemini-2.5-flash",
          contents: fallbackPrompt,
        });

        newCode = fallbackResponse.text.trim();
      }
    }

    // Clean up markdown code fences
    const match = newCode.match(/```(?:jsx|javascript|js)?\n([\s\S]*?)\n```/);
    if (match) newCode = match[1];
    else newCode = newCode.replace(/```jsx|```/g, "");

    return newCode.trim();
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

  // Create endpoint context
  const endpointsContext = endpoints.map(ep => 
    `- ${ep.method} ${ep.path}: ${ep.description}`
  ).join('\n');

  const systemPrompt = `
You are an expert React developer integrating frontend components with backend APIs. 

AVAILABLE API ENDPOINTS:
${endpointsContext}

API TESTING FUNCTION:
A special function \`window.__API_TEST__\` is available for making API calls.
Use it like this:

const result = await window.__API_TEST__(method, path, body);
// Returns: { status: number, ok: boolean, data: responseData }
// status: HTTP status code (200, 404, 500, etc.)
// ok: true if status is 200-299, false otherwise
// data: the response body from the endpoint

Example usage:
const response = await window.__API_TEST__('GET', '/api/users');
if (response.ok) {
  setUsers(response.data);
} else {
  setError(response.data?.error || 'Request failed');
}

For POST/PUT/PATCH with body:
const response = await window.__API_TEST__('POST', '/api/users', { name: 'John' });
if (response.ok) {
  console.log('Created:', response.data);
}

INTEGRATION RULES:
1. Keep ALL existing UI/UX intact - only add API functionality
2. Use window.__API_TEST__() to call the endpoints (NOT regular fetch)
3. Add proper error handling with try/catch
4. Show loading states during API calls
5. Display API data in the existing UI elements
6. Use appropriate HTTP methods (GET for reads, POST for creates, etc.)
7. Handle API errors gracefully with user-friendly messages
8. ALL API calls MUST include proper error handling
9. Add useEffect hooks for data fetching where appropriate
10. Check if window.__API_TEST__ exists before calling it

CRITICAL:
- DO NOT change the component's visual design or layout
- DO NOT remove existing functionality
- DO NOT include exports, imports, or code fences
- Return ONLY the complete component function code
- Make sure the component still fills its container (h-full w-full)
- ALWAYS use window.__API_TEST__ instead of fetch()

${designSystem ? `DESIGN CONTEXT:\n${designSystem}\n` : ""}
`;

  try {
    const updatedComponents = [];

    for (const comp of components) {
      const prompt = `
${systemPrompt}

CURRENT COMPONENT CODE:
${comp.code}

Task: Integrate this component with the available API endpoints if relevant.
- Analyze what data this component might need
- Use appropriate endpoints to fetch/modify that data
- Keep all existing UI elements and styling
- Add loading and error states
- If no endpoints are relevant to this component, return it unchanged
- As a reminder, DO NOT INCLUDE IMPORTS!!!

Return the complete updated component code:
`;

      const response = await genAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      let newCode = response.text.trim();

      // Clean up markdown
      const match = newCode.match(/```(?:jsx|javascript|js)?\n([\s\S]*?)\n```/);
      if (match) newCode = match[1];
      else newCode = newCode.replace(/```jsx|```/g, "");

      updatedComponents.push({
        ...comp,
        code: newCode.trim()
      });
    }

    return updatedComponents;
  } catch (error) {
    console.error("API integration failed:", error);
    return components;
  }
};

export { fetchGeminiCode, handleCodeEdit, integrateComponentsWithAPI };