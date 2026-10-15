import express from 'express';
import dotenv from 'dotenv';
dotenv.config();
import { GoogleGenAI } from "@google/genai";

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Hello, World!');
});

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

async function main() {

// By default, the model will generate entire response at once. If you want to stream the response, you can use the generateContentStream method.

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash-lite",
    contents: "Who are you?",
  });

  console.log(response.text);

  
  // If you want to stream the response, you can use the generateContentStream method instead of generateContent.

//   const responseStream = await ai.models.generateContentStream({
//     model: "gemini-3.5-flash-lite",
//     contents: "Who are you?",
//   });

//   for await (const chunk of responseStream) {
//     console.log(chunk.text);
//   }
}

main();

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});