import { createMCPServer } from 'mcp-server';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import express from 'express';

dotenv.config();
const apiKey = process.env.APOLLO_API_KEY;
if (!apiKey) console.error('Missing APOLLO_API_KEY in environment');

// Create MCP Server
const server = createMCPServer({ name: 'apollo-mcp', version: '1.0.0' });

// ----------- TOOLS ----------- //

// Search Companies
server.tool('apollo.searchCompanies', { query: 'string' }, async ({ query }) => {
  const res = await fetch('https://api.apollo.io/v1/organizations/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify({ q: query })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data;
});

// Search People
server.tool('apollo.searchPeople', { query: 'string' }, async ({ query }) => {
  const res = await fetch('https://api.apollo.io/v1/people/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify({ q: query })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data;
});

// Pull Email + Phone Enrichment
server.tool('apollo.getEmailsAndPhone', { personId: 'string' }, async ({ personId }) => {
  const res = await fetch(`https://api.apollo.io/v1/people/${personId}`, {
    headers: { 'x-api-key': apiKey }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data;
});

// ----------- HTTP BINDING (required for workflows) ----------- //

const app = express();
app.use('/mcp', (req, res) => server.handle(req, res));

app.listen(process.env.PORT || 3000, () => {
  console.log('🚀 Apollo MCP running at /mcp');
});
