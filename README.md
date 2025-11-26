# Apollo MCP Server

MCP server exposing Apollo REST tools for AgentFlow via `/mcp`.

## Setup
- Install: `npm install`
- Copy `.env.example` → `.env` and set `APOLLO_API_KEY`
- Run locally: `npm start` (defaults to port `3000`)
- MCP endpoint: `http://localhost:3000/mcp`

## Railway Deployment
- Push to GitHub, deploy on Railway with `npm start`
- Set env var `APOLLO_API_KEY`
- Use `https://<railway-host>/mcp` in AgentFlow

## Tools
- `apollo.searchCompanies` → POST `https://api.apollo.io/v1/organizations/search` (`{ q }`)
- `apollo.searchPeople` → POST `https://api.apollo.io/v1/people/search` (`{ q }`)
- `apollo.getEmailsAndPhone` → GET `https://api.apollo.io/v1/people/{id}`
- `apollo.enrichPersonBulk` → POST `https://api.apollo.io/v1/bulk_people_enrichment` (`{ person_ids }` or `{ emails }`)

## Behavior
- JSON-RPC over HTTP; methods supported: `initialize`, `tools/list`, `tools/call`, `ping`.
- Returns Apollo JSON directly; errors surface as JSON-RPC error messages.
