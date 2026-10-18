import express from 'express';
import dotenv from 'dotenv';
dotenv.config();
import { ChatGoogle } from "@langchain/google";
import { TavilySearch } from "@langchain/tavily";
import { tool } from '@langchain/core/tools';
import z from 'zod/v3';
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { MessagesAnnotation, StateGraph } from '@langchain/langgraph';
import { MemorySaver } from "@langchain/langgraph";

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Hello, World!');
});

app.use(express.json());

const checkpointer = new MemorySaver()


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

//LangGraph

const tools = [tavilySearchTool, customToolAddition, customToolEmail];

const llModel = new ChatGoogle({
      apiKey: process.env.GEMINI_API_KEY,
      model: "gemini-3.5-flash-lite",
}).bindTools(tools);

const toolNode = new ToolNode(tools);

const agent = async (state) =>{
    const result = await llModel.invoke(
      state.messages
    )

    return {
      messages: [result]
    }
}

const shouldContinue = (state) =>{

   if(state.messages[state.messages.length - 1].tool_calls.length > 0) {
     return "tools";
   }
   return "__ end__";
}

//built in state graph for messages
const graph = new StateGraph(MessagesAnnotation)
  .addNode("agent", agent)
  .addNode("tools", toolNode)
  .addEdge("__start__", "agent")
  .addConditionalEdges(
    "agent",
    shouldContinue,
  )
  .addEdge("tools", "agent")
  .compile({checkpointer});

app.post("/chat", async (req, res) =>{
    const {prompt} = req.body;
    
    const result = await graph.invoke({
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    },{
      configurable: {thread_id: "user-123"}
    });

    return res.json(result.messages[result.messages.length - 1].content);
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});