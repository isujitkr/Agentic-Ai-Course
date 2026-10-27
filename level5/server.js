import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";

const server = new McpServer({
    name: "calculator",
    description: "A simple calculator that can add, subtract, multiply, and divide two numbers.",
    version: "1.0.0",
});

server.registerTool(
    "addition",
    {
        description: "Adds two numbers together.",
        inputSchema: z.object({
            a: z.number(),
            b: z.number(),
        })
    },
    async ({a,b}) =>{
        return {
            content: [
                {
                    type: "text",
                    text: `The sum of ${a} and ${b} is ${a + b}.`
                }
            ]
        }
    }
)

const transport = new StdioServerTransport();
server.connect(transport);