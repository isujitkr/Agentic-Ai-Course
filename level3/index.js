import express from 'express';
import dotenv from 'dotenv';
dotenv.config();
import { ChatGoogle } from "@langchain/google";
import { TavilySearch } from "@langchain/tavily";
import { tool } from '@langchain/core/tools';
import z from 'zod/v3';
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { Command, interrupt, MessagesAnnotation, StateGraph, StateSchema } from '@langchain/langgraph';
import { MongoClient } from "mongodb";
import { MongoDBSaver } from "@langchain/langgraph-checkpoint-mongodb";
import {randomUUID} from "node:crypto"

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Hello, World!');
});

app.use(express.json());

const client = new MongoClient(process.env.MONGO_URI);

const checkpointer = new MongoDBSaver({client: client, dbName: "langgraph", collectionName: "checkpoints"});


//langchain

// const tavilySearchTool = new TavilySearch({
//   maxResults: 5,
//   topic: "general",
// });

// const customToolAddition = tool(
//   ({a,b})=>{
//     return `Custom tool result: ${a} + ${b} = ${a+b}`;
//   },
//   {
//     name: "Addition_tool",
//     description: "Use this tool for addition of two numbers",
//     schema: z.object({
//       a: z.number(),
//       b: z.number(),
//     }),
//   }
// );

// const customToolEmail = tool(
//   ({email, content})=>{
//     return `Custom tool result: Email sent to ${email} with content: ${content}`;
//   },
//   {
//     name: "Email_tool",
//     description: "Use this tool to send an email with content",
//     schema: z.object({
//       email: z.string().email().describe("Sender email"),
//       content: z.string().describe("Email content"),
//     }),
//   }
// )

//LangGraph

// const tools = [tavilySearchTool, customToolAddition, customToolEmail];

// const llModel = new ChatGoogle({
//       apiKey: process.env.GEMINI_API_KEY,
//       model: "gemini-3.5-flash-lite",
// }).bindTools(tools);

// const toolNode = new ToolNode(tools);

// const agent = async (state) =>{
//     const result = await llModel.invoke(
//       state.messages
//     )

//     return {
//       messages: [result]
//     }
// }

// const shouldContinue = (state) =>{

//    if(state.messages[state.messages.length - 1].tool_calls.length > 0) {
//      return "tools";
//    }
//    return "__ end__";
// }

// //built in state graph for messages
// const graph = new StateGraph(MessagesAnnotation)
//   .addNode("agent", agent)
//   .addNode("tools", toolNode)
//   .addEdge("__start__", "agent")
//   .addConditionalEdges(
//     "agent",
//     shouldContinue,
//   )
//   .addEdge("tools", "agent")
//   .compile({checkpointer});

// app.post("/chat", async (req, res) =>{
//     const {prompt} = req.body;
    
//     const result = await graph.invoke({
//       messages: [
//         {
//           role: "user",
//           content: prompt
//         }
//       ]
//     },{
//       configurable: {thread_id: "user-123"}
//     });

//     return res.json(result.messages[result.messages.length - 1].content);
// });




//human in the loop 

const customState = new StateSchema({
  prompt: z.string(),
  approvalRequired: z.boolean(),
  aiResponse: z.string(),
  approved: z.boolean(),
  result: z.string(),
})

const llModel = new ChatGoogle({
      apiKey: process.env.GEMINI_API_KEY,
      model: "gemini-3.5-flash-lite",
})


const agent = async (state) => {
  const result = await llModel.invoke([
    {
      role: "system",
      content: `You are an AI assistant that generates a response based on the user's prompt.

      If the user is greeting or asking a normal question, respond directly and set approvalRequired to false.

      If the user requests a sensitive action, such as sending an email or deleting a file, explain that approval is required and set approvalRequired to true.

      Return ONLY valid JSON in this format:
      {
        "response": "Your response here",
        "approvalRequired": false
      }

      Do not include Markdown code fences or extra text.`
    },
    {
      role: "user",
      content: state.prompt
    }
  ]);

  const resultJson = JSON.parse(result.content);

  return {
    aiResponse: resultJson.response,
    approvalRequired: resultJson.approvalRequired
  };
};


const approvalNode = async (state) =>{
  const answer = interrupt({
    message: "Do you want to approve this action?",
    prompt: state.prompt,
    aisResponse: state.aiResponse,
  });

  return {
    approved: String(answer).trim().toLowerCase() === "yes"
  };
}

const actionNode = async (state) =>{
  if(state.approved) {
    return {
      result: `Action approved. Executing action: ${state.prompt}`
    }
  } else {
    return {
      result: "Action denied"
    }
  }
}

const shouldContinue = async (state) =>{
  if(state.approvalRequired) {
    return "approval";
  }
  return "__end__";
}

const graph = new StateGraph(customState)
  .addNode("agent", agent)
  .addNode("approval", approvalNode)
  .addNode("action", actionNode)
  .addEdge("__start__", "agent")
  .addConditionalEdges(
    "agent",
    shouldContinue,
  )
  .addEdge("approval", "action")
  .addEdge("action", "__end__")
  .compile({checkpointer});


app.post("/chat", async (req, res) =>{
    const {prompt} = req.body;
    const threadId = randomUUID(); // Generate a unique thread ID for each request
    
    const result = await graph.invoke({
      prompt: prompt,
    },{
      configurable: {thread_id: threadId}
    });

    return res.json({
      threadId: threadId,
      aiResponse: result.aiResponse,
      approvalRequired: result.approvalRequired,
    });
});

app.post("/chat/resume", async (req, res) =>{
    const {threadId, answer} = req.body;
    
    const result = await graph.invoke(
      new Command({
        resume: String(answer)
      }),
      {
        configurable: {thread_id: threadId}
      }
    );

    return res.json({
      threadId: threadId,
      aiResponse: result.aiResponse,
      approvalRequired: result.approvalRequired,
      approved: result.approved,
      result: result.result
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});