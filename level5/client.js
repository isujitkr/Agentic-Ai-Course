import express from "express";
import dotenv from "dotenv";
dotenv.config();
import { ChatGoogle } from "@langchain/google";

const app = express();
const PORT = process.env.PORT || 3000;
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

app.get("/", (req, res) => {
  res.send("Hello, World!");
});

app.use(express.json());

const client = new Client({
  name: "Client",
  version: "1.0.0",
});

const model = new ChatGoogle({
    apiKey: process.env.GEMINI_API_KEY,
    model: "gemini-3.5-flash-lite",
});

async function start() {

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["server.js"]
  })

  await client.connect(transport);

  const { tools } = await client.listTools();
  
  const modelWithTools = model.bindTools(
    tools.map(tool =>({
        type: "function",
        function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema
        }
    }))
  )

  app.post("/chat", async (req, res) => {
    const { prompt } = req.body;

    const response = await modelWithTools.invoke([
      {
        role: "human",
        content: prompt,
      },
    ]);

    if(response.tool_calls.length){
        const tool = response.tool_calls[0];
        const result = await client.callTool({
            name: tool.name,
            arguments: tool.args
        })

        return res.json(result.content[0].text);
    }

    return res.json(response.content);
  });

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

start();
