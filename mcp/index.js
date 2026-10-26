#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Parse API key from env or command line arguments
let apiKey = process.env.DATABOARD_API_KEY || process.env.DATOPIN_API_KEY || "";
const apiUrl = process.env.DATABOARD_API_URL || process.env.DATOPIN_API_URL || "https://gurukalyan.vercel.app/api/analytics";

// Support passing --key dp_live_... via CLI
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--key" && args[i + 1]) {
    apiKey = args[i + 1];
  }
}

if (!apiKey) {
  console.error("Warning: DATABOARD_API_KEY environment variable is missing.");
}

async function queryDataBoard(type, params = {}) {
  const url = new URL(apiUrl);
  url.searchParams.set("type", type);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) {
      url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey.trim()}`,
      "Content-Type": "application/json",
      "User-Agent": "DataBoard-MCP/1.0",
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Data Board API error: ${res.status} ${res.statusText}`);
  }
  return data;
}

const server = new Server(
  {
    name: "databoard-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 1. Register Available Tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_analytics_overview",
        description: "Get high-level traffic metrics: unique visitors, pageviews, sessions, bounce rate, top country, and revenue for a timeframe.",
        inputSchema: {
          type: "object",
          properties: {
            period: {
              type: "string",
              enum: ["today", "24h", "7d", "30d"],
              description: "Timeframe for metrics (default: 'today')",
            },
            project_id: {
              type: "string",
              description: "Optional project ID. If omitted, aggregates across all user projects.",
            },
          },
        },
      },
      {
        name: "get_realtime_visitors",
        description: "Check live active visitors browsing the website in the last 5 minutes and active URLs.",
        inputSchema: {
          type: "object",
          properties: {
            project_id: {
              type: "string",
              description: "Optional project ID to filter realtime visitors.",
            },
          },
        },
      },
      {
        name: "get_top_sources",
        description: "Get ranked referral traffic channels and domains (e.g. Google, Twitter/X, GitHub, Direct).",
        inputSchema: {
          type: "object",
          properties: {
            period: {
              type: "string",
              enum: ["today", "7d", "30d"],
              description: "Timeframe for sources (default: '7d')",
            },
            limit: {
              type: "number",
              description: "Number of top sources to return (default: 10)",
            },
          },
        },
      },
      {
        name: "get_top_pages",
        description: "Get ranked most visited paths and landing pages with view counts.",
        inputSchema: {
          type: "object",
          properties: {
            period: {
              type: "string",
              enum: ["today", "7d", "30d"],
              description: "Timeframe for pages (default: '7d')",
            },
            limit: {
              type: "number",
              description: "Number of top pages to return (default: 10)",
            },
          },
        },
      },
      {
        name: "get_conversion_goals",
        description: "Get conversion goal performance, completion counts, and attributed revenue in USD.",
        inputSchema: {
          type: "object",
          properties: {
            period: {
              type: "string",
              enum: ["today", "7d", "30d"],
              description: "Timeframe for conversions (default: '30d')",
            },
          },
        },
      },
      {
        name: "get_uptime_status",
        description: "Check operational health (Up/Down status, latency in ms, HTTP response code) of monitored sites.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  };
});

// 2. Handle Tool Execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: toolArgs = {} } = request.params;

  try {
    if (name === "get_analytics_overview") {
      const data = await queryDataBoard("overview", toolArgs);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    }

    if (name === "get_realtime_visitors") {
      const data = await queryDataBoard("realtime", toolArgs);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    }

    if (name === "get_top_sources") {
      const data = await queryDataBoard("sources", toolArgs);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    }

    if (name === "get_top_pages") {
      const data = await queryDataBoard("pages", toolArgs);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    }

    if (name === "get_conversion_goals") {
      const data = await queryDataBoard("conversions", toolArgs);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    }

    if (name === "get_uptime_status") {
      const data = await queryDataBoard("uptime", toolArgs);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    }

    throw new Error(`Unknown tool requested: "${name}"`);
  } catch (err) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error executing ${name}: ${err.message}`,
        },
      ],
    };
  }
});

// 3. Connect Stdio Transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error starting Data Board MCP Server:", err);
  process.exit(1);
});
