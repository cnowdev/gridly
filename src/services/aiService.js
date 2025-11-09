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

    return parts.length > 0 ? parts.join('\n') : '';
};

// Helper function to generate AI images
const generateImage = async (imagePrompt) => {
    try {
        const response = await genAI.models.generateImages({
            model: 'imagen-3.0-generate-002',
            prompt: imagePrompt,
            config: {
                numberOfImages: 1,
                includeRaiReason: true,
            }
        });

        const imageBase64 = response?.generatedImages?.[0]?.image?.imageBytes;

        if (!imageBase64) {
            console.error('No image data returned from Imagen API');
            return null;
        }

        return imageBase64;
    } catch (error) {
        console.error('Image generation failed:', error);
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

const fetchGeminiCode = async (prompt, settings, cacheImageAsURL, imageCache) => {
    if (!genAI) {
        alert('Gemini API Key is not set in .env file.');
        const errorId = `comp-${Date.now()}`;
        return {
            code: '() => <div className="text-red-500 p-4">Error: Please set your API key in .env</div>',
            componentId: errorId,
            imageKeys: []
        };
    }

    const designSystem = getDesignSystemPrompt(settings);

    const systemPrompt = `
    You are an expert React and Tailwind CSS component generator.

    ONLY IF the user is EXPLICITLY asking for an AI-generated image (photo, illustration, graphic, etc.):
    - Respond with exactly: IMAGE_REQUEST: [detailed, descriptive prompt for image generation]
    - Make the image prompt detailed and specific
    - ONLY do this if they need a realistic photo/illustration, NOT for icons or simple graphics
    
    OTHERWISE:
    You only respond with a single, pure, functional React component.
    - DO NOT include 'export default'.
    - DO NOT include 'React.createElement'.
    - DO NOT include code fences (\`\`\`).
    - DO NOT include any imports.
    - DO use Tailwind CSS for all styling.
    - The component should be self-contained and responsive, filling its container (use 'h-full w-full').
    - React hooks like 'useState', 'useEffect', and 'useRef' are available in scope.
    - You also have access to async function generateText(prompt) for generating text content. Use this if you need to generate dynamic text content, like implementing a chatbot.
    - Assume 'lucide-react' icons are available in scope.
    - When using Lucide icons, use Lucide.IconName (e.g., <Lucide.User />).
    - Respond ONLY with the raw component function:
    () => <div ... />  or  () => { const [s, setS] = useState(); return <div .../> }

    ${designSystem ? `IMPORTANT GLOBAL DESIGN CONTEXT:\n${designSystem}\n` : ''}

    If the user specifically asks for something different from the global design context, prioritize their request. If you feel like a color or font choice from the design system doesn't fit the component being generated, you can deviate from it as needed.
`;

    const fullPrompt = `${systemPrompt}\n\nUser prompt: ${prompt}`;

    // Generate component ID first
    const newComponentId = `comp-${Date.now()}`;
    let imageKeys = [];

    try {
        const response = await genAI.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: fullPrompt,
        });
        let code = response.text.trim();

        // Check if AI detected an image request
        if (code.startsWith('IMAGE_REQUEST:')) {
            const imagePrompt = code.replace('IMAGE_REQUEST:', '').trim();
            console.log('Generating image with prompt:', imagePrompt);

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
        <img src="${imageURL}" alt="${imagePrompt.replace(/"/g, '&quot;')}" className="your-tailwind-classes" />

        IMPORTANT: Size the image appropriately using Tailwind classes:
        - Use object-cover or object-contain to control aspect ratio
        - Use w-full or max-w-* to control width
        - Use h-48, h-64, h-96, or max-h-* to limit height (don't make it too tall)
        - Consider using rounded corners (rounded-lg, rounded-xl) for aesthetics
        
        Style the image appropriately with Tailwind CSS to fit the overall component design.
        Make sure the component fills its container (h-full w-full).

        ${designSystem ? `IMPORTANT GLOBAL DESIGN CONTEXT:\n${designSystem}\n` : ''}

        Original user request: ${prompt}
        `;

                const componentResponse = await genAI.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: componentPrompt,
                });

                code = componentResponse.text.trim();
            } else {
                // If image generation failed, prompt for a fallback component
                const fallbackPrompt = `
        You are an expert React and Tailwind CSS component generator.
        Return the entire component function only. DO NOT include exports, imports, or code fences.
        Use Tailwind CSS for styling. Hooks and lucide icons are available in scope.

        Image generation failed - create a component with a placeholder or Lucide icon instead.
        Make sure the component fills its container (h-full w-full).

        ${designSystem ? `IMPORTANT GLOBAL DESIGN CONTEXT:\n${designSystem}\n` : ''}

        Original user request: ${prompt}
        `;

                const fallbackResponse = await genAI.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: fallbackPrompt,
                });

                code = fallbackResponse.text.trim();
            }
        }

        // Regular code generation - clean up markdown
        const match = code.match(/```(?:jsx|javascript|js)?\n([\s\S]*?)\n```/);
        if (match) code = match[1];
        else code = code.replace(/```jsx|```/g, '');

        return {
            code: code.trim(),
            componentId: newComponentId,
            imageKeys
        };
    } catch (error) {
        console.error('Gemini API call failed:', error);
        return {
            code: `() => <div className="text-red-500 p-4">Error: ${error.message}</div>`,
            componentId: newComponentId,
            imageKeys: []
        };
    }
};

const handleCodeEdit = async (currentCode, userPrompt, components, currentEditingId, settings, cacheImageAsURL) => {
    let currentComponentContext = '';
    const currentComponent = components.find((c) => c.id === currentEditingId);


    if (currentComponent) {
        const { w, h } = currentComponent.layout;
        currentComponentContext = `The component you are editing (ID: "${currentEditingId}") is in a container with grid width ${w} and grid height ${h}.`;
    }

    const otherComponentsContext = components
        .filter(c => c.id !== currentEditingId) // Get all *other* components
        .map(c => `  - Component ID: "${c.id}" (Layout: x: ${c.layout.x}, y: ${c.layout.y}, w: ${c.layout.w}, h: ${c.layout.h})`)
        .join('\n');

    // Combine all grid context into one block
    const gridContext = `
GRID CONTEXT:
${currentComponentContext}
${otherComponentsContext.length > 0 ? `
Here are the other components on the grid (the user may refer to them by ID):
${otherComponentsContext}
` : ''}
`;

    const designSystem = getDesignSystemPrompt(settings);

    const editPrompt = `
    ONLY IF the user is EXPLICITLY asking for an AI-generated image, photo, illustration, graphic, or visual asset to be added/changed:
    - Respond with exactly: IMAGE_REQUEST: [detailed, descriptive prompt for image generation]
    - Make the image prompt detailed and specific
    
    OTHERWISE:
    You are an expert React and Tailwind CSS component editor.
    Return the entire new component function only. DO NOT include exports, imports, or code fences.
    Use Tailwind CSS for styling. Hooks are available in scope. All Lucide icons are available under 
    the 'Lucide' namespace (e.g., <Lucide.User />, <Lucide.Bell />, etc).

    ${designSystem ? `IMPORTANT GLOBAL DESIGN CONTEXT:\n${designSystem}\n` : ''}

    ${gridContext} 

    Current code (for component "${currentEditingId}"):
    ${currentCode}

    User request: ${userPrompt}
`;

    try {
        const response = await genAI.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: editPrompt,
        });
        let newCode = response.text.trim();

        // Check if AI detected an image request
        if (newCode.startsWith('IMAGE_REQUEST:')) {
            const imagePrompt = newCode.replace('IMAGE_REQUEST:', '').trim();
            console.log('Generating image for edit with prompt:', imagePrompt);

            const imageBase64 = await generateImage(imagePrompt);

            if (imageBase64) {
                // Convert base64 to blob URL (await it!)
                const imageURL = await cacheImageAsURL(imageBase64, currentEditingId);

                // Generate component code that includes the image URL
                const componentPrompt = `
        You are an expert React and Tailwind CSS component editor.
        Return the entire new component function only. DO NOT include exports, imports, or code fences.
        Use Tailwind CSS for styling. Hooks and lucide icons are available in scope.

        The user requested an image be ${currentCode.includes('blob:') || currentCode.includes('data:image') ? 'replaced' : 'added'} to the component.
        
        Use this image URL in your component:
        <img src="${imageURL}" alt="${imagePrompt.replace(/"/g, '&quot;')}" className="your-tailwind-classes" />

        IMPORTANT: Size the image appropriately using Tailwind classes:
        - Use object-cover or object-contain to control aspect ratio
        - Use w-full or max-w-* to control width
        - Use h-48, h-64, h-96, or max-h-* to limit height (don't make it too tall)
        - Consider using rounded corners (rounded-lg, rounded-xl) for aesthetics
        
        Style the image appropriately with Tailwind CSS to fit the component's design.
        Make sure the component fills its container (h-full w-full).

        ${designSystem ? `DESIGN CONTEXT:\n${designSystem}\n` : ''}
        ${gridContext}
        
        Current code:
        ${currentCode}
        
        User request: ${userPrompt}
        `;

                const componentResponse = await genAI.models.generateContent({
                    model: 'gemini-2.5-flash',
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

        ${designSystem ? `DESIGN CONTEXT:\n${designSystem}\n` : ''}
        ${gridContext}
        
        Current code:
        ${currentCode}
        
        User request: ${userPrompt}
        `;

                const fallbackResponse = await genAI.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: fallbackPrompt,
                });

                newCode = fallbackResponse.text.trim();
            }
        }

        // Clean up markdown code fences
        const match = newCode.match(/```(?:jsx|javascript|js)?\n([\s\S]*?)\n```/);
        if (match) newCode = match[1];
        else newCode = newCode.replace(/```jsx|```/g, '');

        return newCode.trim();
    } catch (error) {
        console.error('Gemini API edit call failed:', error);
        return currentCode;
    }
};

export { fetchGeminiCode, handleCodeEdit };