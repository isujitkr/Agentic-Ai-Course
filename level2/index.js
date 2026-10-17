import express from 'express';
import dotenv from 'dotenv';
dotenv.config();
import { ChatGoogle } from "@langchain/google";
import { TavilySearch } from "@langchain/tavily";
import { createAgent } from "langchain";
import { tool } from '@langchain/core/tools';
import z from 'zod/v3';

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

const customToolAddition = tool(
  ({a,b})=>{
    return `Custom tool result: ${a} + ${b} = ${a+b}`;
  },
  {
    name: "Addition_tool",
    description: "Use this tool for addition of two numbers",
    schema: z.object({
      a: z.number(),
      b: z.number(),
    }),
  }
);

const customToolEmail = tool(
  ({email, content})=>{
    return `Custom tool result: Email sent to ${email} with content: ${content}`;
  },
  {
    name: "Email_tool",
    description: "Use this tool to send an email with content",
    schema: z.object({
      email: z.string().email().describe("Sender email"),
      content: z.string().describe("Email content"),
    }),
  }
)

const llModel = new ChatGoogle({
      apiKey: process.env.GEMINI_API_KEY,
      model: "gemini-3.5-flash-lite",
});

app.post("/chat", async (req, res) =>{
    const {prompt} = req.body;
    
    const agent = createAgent({
      model: llModel,
      tools: [tavilySearchTool, customToolAddition, customToolEmail],
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