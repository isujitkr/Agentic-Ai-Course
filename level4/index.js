import express from 'express';
import dotenv from 'dotenv';
dotenv.config();
import { ChatGoogle } from "@langchain/google";
const app = express();
const PORT = process.env.PORT || 3000;
import fs from 'fs';
import { PDFParse } from 'pdf-parse';

import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { QdrantVectorStore } from "@langchain/qdrant";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

app.get('/', (req, res) => {
    res.send('Hello, World!');
});

app.use(express.json());

const llModel = new ChatGoogle({
      apiKey: process.env.GEMINI_API_KEY,
      model: "gemini-3.5-flash-lite",
})

const embeddings = new GoogleGenerativeAIEmbeddings({
  model: "gemini-embedding-001", // 768 dimensions
  apiKey: process.env.GEMINI_API_KEY,
});

const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
  url: process.env.QDRANT_URL,
  collectionName: "nodejs-Documentation",
  apiKey: process.env.QDRANT_API_KEY,
});

const upload = async () =>{
  const path = "./knowledge.pdf";
  const buffer = fs.readFileSync(path);

  const pdfResult = new PDFParse({data: buffer});
  const result = await pdfResult.getText();
  const text = result.text;

  const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 100 })
  const docs = await splitter.createDocuments([text]);

  await vectorStore.addDocuments(docs);
}

app.post("/chat", async (req, res) => {
  
  const { prompt } = req.body;
  const docs = await vectorStore.similaritySearch(prompt, 3);
  
  const context = docs.map(doc => doc.pageContent).join("\n\n");

  const result = await llModel.invoke([
    {
      role: "system",
      content: `You are a helpful assistant. Use the following context to answer the question:\n\n${context}`,
    },
    {
      role: "user",
      content: prompt,
    },
  ]);

  return res.json({ answer: result.text });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});