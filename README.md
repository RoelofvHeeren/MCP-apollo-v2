# Apollo MCP Server

Simple MCP server exposing Apollo REST endpoints for use inside AgentFlow.

## Setup
- Install deps: `npm install`
- Copy `.env.example` to `.env` and set `APOLLO_API_KEY`
- Run locally: `npm start` (defaults to port 3000)
- MCP endpoint: `http://localhost:3000/mcp`

## Railway Deployment
- Push to GitHub, deploy on Railway with `npm start`
- Add env var `APOLLO_API_KEY`
- Use `https://<railway-host>/mcp` as the MCP endpoint in AgentFlow

## Tools
- `apollo.searchCompanies` → `POST https://api.apollo.io/v1/organizations/search` (body `{ q }`)
- `apollo.searchPeople` → `POST https://api.apollo.io/v1/people/search` (body `{ q }`)
- `apollo.getEmailsAndPhone` → `GET https://api.apollo.io/v1/people/{personId}`

## Notes
- Returns Apollo API JSON directly; errors propagate with Apollo’s response body.
- Requires Node.js 18+. Only uses `mcp-server`, `express`, `node-fetch`, `dotenv`.
