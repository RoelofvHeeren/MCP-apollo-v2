import express from 'express';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const apiKey = process.env.APOLLO_API_KEY;
if (!apiKey) {
  console.error('Missing APOLLO_API_KEY in environment');
}

// Minimal tool registry to satisfy MCP methods.
const tools = [
  {
    name: 'apollo.searchCompanies',
    description: 'Search companies in Apollo by keyword',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search keyword' }
      },
      required: ['query']
    }
  },
  {
    name: 'apollo.searchPeople',
    description: 'Search people in Apollo by keyword',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search keyword' }
      },
      required: ['query']
    }
  },
  {
    name: 'apollo.getEmailsAndPhone',
    description: 'Get a person by ID with email and phone enrichment',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Apollo person ID' }
      },
      required: ['id']
    }
  },
  {
    name: 'apollo.enrichPersonBulk',
    description: 'Bulk person enrichment by IDs or emails',
    inputSchema: {
      type: 'object',
      properties: {
        personIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Apollo person IDs'
        },
        emails: {
          type: 'array',
          items: { type: 'string' },
          description: 'Email addresses'
        }
      },
      required: []
    }
  }
];

async function callApollo(method, url, body) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey
    }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = typeof data === 'object' ? JSON.stringify(data) : String(data);
    throw new Error(message || `Apollo error ${res.status}`);
  }
  return data;
}

async function handleToolCall(name, args = {}) {
  switch (name) {
    case 'apollo.searchCompanies':
      if (!args.query) throw new Error('Missing query');
      return callApollo('POST', 'https://api.apollo.io/v1/organizations/search', { q: args.query });
    case 'apollo.searchPeople':
      if (!args.query) throw new Error('Missing query');
      return callApollo('POST', 'https://api.apollo.io/v1/people/search', { q: args.query });
    case 'apollo.getEmailsAndPhone':
      if (!args.id) throw new Error('Missing id');
      return callApollo('GET', `https://api.apollo.io/v1/people/${args.id}`);
    case 'apollo.enrichPersonBulk': {
      const payload = {};
      if (Array.isArray(args.personIds) && args.personIds.length > 0) {
        payload.person_ids = args.personIds;
      }
      if (Array.isArray(args.emails) && args.emails.length > 0) {
        payload.emails = args.emails;
      }
      if (!payload.person_ids && !payload.emails) {
        throw new Error('Provide personIds or emails');
      }
      return callApollo('POST', 'https://api.apollo.io/v1/bulk_people_enrichment', payload);
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function jsonRpcSuccess(id, result) {
  return { jsonrpc: '2.0', id, result };
}

function jsonRpcError(id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

const app = express();
app.use(express.json({ limit: '1mb', type: ['application/json', 'application/*+json'] }));

app.post('/mcp', async (req, res) => {
  const { id, method, params } = req.body || {};
  try {
    if (method === 'initialize') {
      const result = {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'apollo-mcp', version: '1.0.0' }
      };
      return res.json(jsonRpcSuccess(id, result));
    }

    if (method === 'tools/list') {
      return res.json(jsonRpcSuccess(id, { tools }));
    }

    if (method === 'tools/call') {
      const name = params?.name;
      const args = params?.arguments || {};
      const data = await handleToolCall(name, args);
      return res.json(
        jsonRpcSuccess(id, {
          content: [],
          structuredContent: data
        })
      );
    }

    if (method === 'ping') {
      return res.json(jsonRpcSuccess(id, {}));
    }

    return res.status(400).json(jsonRpcError(id ?? null, -32601, 'Method not found'));
  } catch (err) {
    return res.status(500).json(jsonRpcError(id ?? null, -32000, err?.message || 'Internal error'));
  }
});

app.use((_, res) => res.status(404).json({ message: 'Not found' }));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Apollo MCP running at /mcp on port ${port}`);
});
