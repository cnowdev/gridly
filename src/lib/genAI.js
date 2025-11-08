import { GoogleGenAI } from "@google/genai";

const API_KEY = import.meta.env.VITE_API_KEY;

if(!API_KEY){
    throw Error("VITE_API_KEY is not defined in environment variables");
}

const genAI = new GoogleGenAI({apiKey: API_KEY});
export default genAI;