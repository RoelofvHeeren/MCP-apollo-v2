import 'dotenv/config';
import fetch from 'node-fetch';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

const API_KEY = process.env.APOLLO_API_KEY;
if (!API_KEY) throw new Error('Missing APOLLO_API_KEY in .env');

// Minimal Apollo GraphQL helper
async function apollo(query, variables = {}) {
  const res = await fetch('https://api.apollo.io/v1/mixed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': API_KEY },
    body: JSON.stringify({ query, variables })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data;
}

// Create MCP server and tools
const server = new McpServer({ name: 'apollo-mcp-v2', version: '1.0.0' });

// ===========================
// 1) SEARCH COMPANIES
// ===========================
server.registerTool(
  'apollo.searchCompanies',
  {
    inputSchema: z.object({
      keyword: z.string(),
      country: z.string().optional(),
      limit: z.number().default(10)
    }),
    outputSchema: z.object({
      companies: z.array(
        z.object({
          name: z.string(),
          website: z.string().nullable(),
          city: z.string().nullable(),
          country: z.string().nullable(),
          employee_count: z.number().nullable(),
          industry: z.string().nullable()
        })
      )
    })
  },
  async ({ keyword, country, limit }) => {
    const q = `query { companies(query: "${keyword}", country: "${country || ''}", first: ${limit}) { edges { node { name websiteUrl city country estimatedNumEmployees industry } } } }`;
    const res = await apollo(q);
    return {
      companies:
        res?.data?.companies?.edges?.map((e) => ({
          name: e.node.name,
          website: e.node.websiteUrl,
          city: e.node.city,
          country: e.node.country,
          employee_count: e.node.estimatedNumEmployees,
          industry: e.node.industry
        })) || []
    };
  }
);

// ===========================
// 2) SEARCH PEOPLE
// ===========================
server.registerTool(
  'apollo.searchPeople',
  {
    inputSchema: z.object({
      company: z.string(),
      role: z.string().optional(),
      limit: z.number().default(10)
    }),
    outputSchema: z.object({
      leads: z.array(
        z.object({
          first_name: z.string(),
          last_name: z.string(),
          title: z.string().nullable(),
          email: z.string().nullable(),
          linkedin: z.string().nullable()
        })
      )
    })
  },
  async ({ company, role, limit }) => {
    const q = `query { people(companyName: "${company}", jobTitle: "${role || ''}", first: ${limit}) { edges { node { firstName lastName title email linkedinUrl } } } }`;
    const res = await apollo(q);
    return {
      leads:
        res?.data?.people?.edges?.map((e) => ({
          first_name: e.node.firstName,
          last_name: e.node.lastName,
          title: e.node.title,
          email: e.node.email,
          linkedin: e.node.linkedinUrl
        })) || []
    };
  }
);

// ===========================
// 3) EMAIL + PHONE LOOKUP
// ===========================
server.registerTool(
  'apollo.getEmailsAndPhone',
  {
    inputSchema: z.object({
      person_name: z.string(),
      company_name: z.string()
    }),
    outputSchema: z.object({
      email: z.string().nullable(),
      phone: z.string().nullable(),
      credit_used: z.boolean()
    })
  },
  async ({ person_name, company_name }) => {
    const q = `query { person(name: "${person_name}", companyName: "${company_name}") { email phone creditUsed } }`;
    const res = await apollo(q);
    const p = res?.data?.person;
    return {
      email: p?.email || null,
      phone: p?.phone || null,
      credit_used: p?.creditUsed || false
    };
  }
);

// HTTP transport wiring for Railway/local
async function start() {
  // Stateless mode so clients (e.g., AgentFlow) don't need to manage session IDs between calls.
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  });

  await server.connect(transport);

  const app = express();

  // Allow browser-based clients (Agent builders) to reach the MCP endpoint.
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  });

  // Parse JSON when present; otherwise fall back to raw text.
  app.use(
    express.json({
      type: ['application/json', 'application/json-rpc', 'application/*+json'],
      limit: '1mb'
    })
  );
  app.use(express.text({ type: '*/*', limit: '1mb' }));

  // Minimal request logger to debug client compatibility issues (no body content logged).
  app.use((req, _res, next) => {
    console.log(
      JSON.stringify({
        event: 'http_request',
        method: req.method,
        url: req.url,
        headers: {
          accept: req.headers.accept,
          'content-type': req.headers['content-type']
        }
      })
    );
    next();
  });

  app.get('/', (_req, res) => res.json({ status: 'ok' }));
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  app.all('/mcp', async (req, res) => {
    try {
      // Some clients (e.g., UI-based Agent builders) may not set the expected Accept header.
      // Ensure text/event-stream is present so the transport does not reject the request.
      const accept = req.headers.accept || '';
      if (!accept.includes('text/event-stream')) {
        req.headers.accept = accept ? `${accept}, text/event-stream` : 'application/json, text/event-stream';
      }
      let parsedBody = undefined;
      if (typeof req.body === 'string' && req.body.trim()) {
        try {
          parsedBody = JSON.parse(req.body);
        } catch (_err) {
          parsedBody = req.body; // fall back to raw string; transport will ignore if not needed
        }
      } else if (typeof req.body === 'object' && req.body !== null) {
        parsedBody = req.body;
      }
      await transport.handleRequest(req, res, parsedBody);
    } catch (err) {
      console.error('MCP request error', {
        method: req.method,
        url: req.url,
        headers: req.headers,
        error: err?.message || err
      });
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Internal server error' },
          id: null
        });
      }
    }
  });

  app.use((_, res) => res.status(404).json({ message: 'Not found' }));

  const port = process.env.PORT || 8000;
  app.listen(port, () => console.log(`Apollo MCP running on port ${port} 🚀`));
}

start().catch((err) => {
  console.error('Failed to start Apollo MCP server', err);
  process.exit(1);
});
