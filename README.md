# UIR Motorsports Documentation Hub

The UIR Motorsports Documentation Hub is a controlled engineering workspace for project records, evidence, review workflows, tasks, manufacturing and purchase requests, deadlines, audit history, and export-ready reports.

## Quick start

Requirements: Node.js `22.x` and npm.

```bash
npm run install:ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

For a production build:

```bash
npm run build
npm start
```

The development Docker setup is:

```bash
docker compose -f docker-compose.dev.yml up --build
```

The production Docker setup is:

```bash
docker compose up --build -d
```

## Authentication and configuration

Local development uses `AUTH_MODE=local`. Local accounts are configured through environment variables such as `LOCAL_AUTH_USERS`; do not commit secrets or real credentials. Production authentication is designed for Microsoft Entra ID.

Evidence files use Azure Blob Storage when `AZURE_STORAGE_CONNECTION_STRING` and `AZURE_STORAGE_CONTAINER` are configured. Without Azure credentials, local development stores evidence under `.sites-runtime/evidence/`.

The SQLite database defaults to `.sites-runtime/data/app.sqlite` locally. Docker production stores it in the `/app/data` volume. The application automatically applies pending Drizzle migrations when the database connection starts.

## Organization and approval model

The organization is represented by fixed positions, not manually assigned reporting relationships:

```text
Team Leader
├── Operations Leader
│   ├── Marketing & Media
│   ├── Finance
│   └── Logistics & Procurement
└── Competition Leader
    ├── Static Events Leader
    │   ├── Business Plan
    │   └── Cost & Manufacturing
    └── Technical & Dynamic Leader
        ├── Vehicle Mechanics
        ├── Chassis & Structures
        ├── Powertrain
        ├── Electronics & Low Voltage
        └── Simulation, Validation & Testing
```

Department heads and leaders are assigned to `organizational_positions` through the Team directory. A position has one current occupant; a person may hold multiple positions and departments. The system derives reporting, visibility, review routing, tasks, notifications, escalation, and approval authority from this structure. There is no active `reports_to_user_id` configuration.

Normal document approval follows the chain from the department head upward. A reviewer is a user occupying an organizational position, not a separate reviewer account or team role. Reviewers create review sub-records containing requested changes, reasons, proposed answers, and deadlines. Approved records are sealed and cannot be edited; further work requires a new record.

Master Approval is available to leaders within their authority scope. It records the reason, comment, actor, and audit event, marks skipped lower steps as `BYPASSED`, marks the approving step as `MASTER_APPROVED`, and leaves higher authorities pending. The Team Leader can finalize the entire chain.

## Important directories

| Path | Purpose |
| --- | --- |
| `app/hub.tsx` | Main dashboard, records, review, calendar, team, evidence, and report UI |
| `app/workspace/Modules.tsx` | Tasks, manufacturing/purchase requests, notifications, structure, and approval screens |
| `app/api/` | Server routes for records, reviews, users, organization, requests, tasks, evidence, and workflows |
| `app/api/_lib/hierarchy.ts` | Central hierarchy, visibility, approval, Master Approval, and overdue escalation engine |
| `app/api/_lib/workflow.ts` | Compatibility exports and shared workflow helpers |
| `db/schema.ts` | Drizzle SQLite schema |
| `db/index.ts` | SQLite connection and migration startup logic |
| `drizzle/` | Generated database migrations; do not edit SQL files manually |
| `public/logo.png` | UIR Motorsports brand logo |

## Database changes

When changing the schema:

```bash
# edit db/schema.ts first
npm run db:generate
npm run lint
npm test
```

Migration `drizzle/0011_milky_omega_flight.sql` adds organizational positions, user-position assignments, workflow settings, approval-chain fields, Master Approval fields, overdue state, and removes the old reporting relationship table. Historical migrations may still mention the old table; preserve migration history and let the newer migration remove it.

## Validation commands

```bash
npm run lint
npm run build
npm test
npm run validate:artifact
```

The rendered test suite currently validates the built HTML artifact. The build has a known non-blocking Turbopack NFT warning caused by dynamic local/Azure evidence-storage path resolution.

## Handoff

Read [`AGENTS_SUMMARY.md`](./AGENTS_SUMMARY.md) before continuing feature work. It records the current implementation state, workflow invariants, migration details, tested behavior, and follow-up items for the next agent.
