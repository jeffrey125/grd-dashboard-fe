# GRD Dashboard frontend

Planning repository for the shipment-monitoring frontend rebuild. Application
scaffolding has **not** been implemented. The only application assets currently
present are the official GRD logo and favicon variants.

Start with [the v1 plan](docs/v1/README.md), then the
[implementation tickets](docs/v1/tickets/README.md). Agent instructions are in
[AGENTS.md](AGENTS.md).

Approved foundation: React, TypeScript, Vite, and pnpm. Hosting, publishing, and
deployment are deferred. Once scaffolded, the intended local frontend URL is
`http://localhost:5173`; the separate backend defaults to `http://localhost:3000`.
These are planned addresses, not a claim that either server is running.

This rebuild uses the original shipment UI for behavior, Tom's UI for layout and
engineering patterns, and the GRD website for branding. The implemented backend
contract is authoritative over both reference frontends.
