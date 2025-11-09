# Gridly: The AI Full-Stack Developer

Gridly is an AI-powered, full-stack application builder that turns natural language prompts into deployable code. It provides a multi-modal interface where you can generate, test, and integrate a complete frontend and backend, all from one dashboard.

At its core, Gridly uses a suite of Google Generative AI models (Gemini 2.5 Flash, Gemini 2.5 Pro, and Imagen 3) to act as your co-pilot.

## Key Features

* **AI-Powered Component Generation**: Describe a UI element and Gridly generates a responsive React component with Tailwind CSS.
* **On-the-Fly Image Generation**: Ask for a visual asset and Gridly uses Imagen 3 to generate and embed it directly into your components.
* **AI-Powered Backend Generation**: Describe API logic and Gridly generates the Node.js/Express.js code for it.
* **In-Browser Virtual Server**: Test your generated backend endpoints instantly using a built-in API tester, powered by a virtual Express server running in your browser.
* **Automatic Full-Stack Integration**: The "Merged" view uses Gemini 2.5 Pro to analyze your frontend and backend, then automatically rewrites your React components to fetch data from your new API.
* **Full Project Export**: Download a clean, runnable, full-stack project (Vite + Express) with all AI-generated test harnesses replaced by standard `fetch` calls.
* **Visual Grid Layout**: Drag, drop, and resize your components on a responsive 24-column grid.
* **Persistent State**: Components, API endpoints, and virtual database state are saved locally so you can pick up where you left off.

## How It Works: The Three Modes

Gridly operates in three distinct modes:

### 1. Frontend Mode
Your visual canvas. Use the chat bar to describe UI components, and Gemini 2.5 Flash generates the React/Tailwind code. You can draw boxes on the grid to place components, edit their code live, and even generate images using Imagen 3 which are saved locally.

### 2. Backend Mode
Your server logic center. Describe API endpoints (e.g., `POST /api/login`) to generate Express.js routes. You can also "Auto-Generate" endpoints based on your frontend components. All routes run in a local Virtual Server with a persistent in-memory database.

### 3. Merged Mode
The integration hub. Gemini 2.5 Pro analyzes your entire grid and API list, then intelligently rewrites your frontend components to use the live backend endpoints, providing a fully functional preview of your merged application.

## Tech Stack

* **Frontend**: React 19 (Vite), Tailwind CSS
* **Layout**: `react-grid-layout`
* **AI**: Google Gemini 2.5 Flash & Pro, Imagen 3
* **Backend Simulation**: Custom in-browser Virtual Express Server
* **Storage**: `localStorage` & `IndexedDB`

## Getting Started

### Prerequisites
* Node.js (v18+)
* A Google AI API Key (with access to Gemini and Imagen)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/your-username/gridly.git](https://github.com/your-username/gridly.git)
    cd gridly
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up environment variables:**
    Create a `.env` file in the root and add your API key:
    ```
    VITE_API_KEY=YOUR_GOOGLE_AI_API_KEY_HERE
    ```

4.  **Run the application:**
    ```bash
    npm run dev
    ```<img width="1464" height="871" alt="Screenshot 2025-11-09 at 7 11 25 AM" src="https://github.com/user-attachments/assets/24b540a1-4fd7-41db-970b-9244362ad4ed" />
<img width="1464" height="871" alt="Screenshot 2025-11-09 at 6 53 44 AM" src="https://github.com/user-attachments/assets/cacc9c11-7ccb-4001-90c1-ae17cbccb44e" />
