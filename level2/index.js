import express from 'express';
import dotenv from 'dotenv';
dotenv.config();
import { ChatGoogle } from "@langchain/google";
import { TavilySearch } from "@langchain/tavily";
import { createAgent } from "langchain";

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Hello, World!');
});

app.use(express.json());


//langchain

const tavilySearchTool = new TavilySearch({
  maxResults: 5,
  topic: "general",
});

const llModel = new ChatGoogle({
      apiKey: process.env.GEMINI_API_KEY,
      model: "gemini-3.5-flash-lite",
});

app.post("/chat", async (req, res) =>{
    const {prompt} = req.body;
    
    const agent = createAgent({
      model: llModel,
      tools: [tavilySearchTool],
    });

    const result = await agent.invoke({
      messages:[
        {
          role: "user",
          content: prompt,
        }
      ]
    })
    
    return res.json(result.messages[result.messages.length - 1].content);
})

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});