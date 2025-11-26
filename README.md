# Apollo MCP Server (V2)

A minimal Model Context Protocol server that exposes Apollo search tools for AgentFlow. It reads `APOLLO_API_KEY` from `.env`, runs without prompts, and is ready for Railway deployment.

## Setup
- Install: `npm install`
- Configure: copy `.env` and set `APOLLO_API_KEY=YOUR_KEY`
- Run locally: `npm start`
- The server starts on port `8000` and registers three tools: `apollo.searchCompanies`, `apollo.searchPeople`, `apollo.getEmailsAndPhone`.

## Railway Deployment
- Push this repo to GitHub.
- Create a new Railway project → Deploy from GitHub → select this repo.
- Add an environment variable `APOLLO_API_KEY` in Railway project settings.
- Set the start command to `npm start` (default).
- Deploy; Railway will expose a public HTTP endpoint for the MCP server.

## Connect to AgentFlow
- Use the Railway deployment URL (or local `http://localhost:8000`) as the MCP server endpoint.
- Ensure the AgentFlow pipeline is configured to send JSON-only tool calls and to include the `APOLLO_API_KEY` at runtime via environment variables.

## Tool Usage Examples
- `apollo.searchCompanies`: `{ "keyword": "fintech", "country": "US", "limit": 5 }`
- `apollo.searchPeople`: `{ "company": "Stripe", "role": "engineering manager", "limit": 3 }`
- `apollo.getEmailsAndPhone`: `{ "person_name": "Jane Doe", "company_name": "Acme Corp" }`

## Notes
- The `/utils` directory is reserved for future shared logic.
- Responses follow the strict JSON schemas defined in `mcp_apollo_server.js`.
