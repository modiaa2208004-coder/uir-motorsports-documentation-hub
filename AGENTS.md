## Setup and first steps

- **Install**: `npm run install:ci` (wraps `npm ci` with `.sites-runtime` env wiring).
- **Dev server**: `npm run dev` runs Next.js (`next dev`).
- **Production**: `npm run build` then `npm start`.

## Project boundaries and entrypoints

| Directory | Purpose | Owner / responsibility | Notes |
|--|--|--|--|
| `app` | Next.js client + API routes. Main user interface, record/dashboard screens. | Full-stack logic for frontend; `/api/*` are server endpoints bound to Workers. | Use this directory for view/layout/component changes. |
| `db/` | Drizzle ORM schema (`schema.ts`) and connection (`index.ts`). All migrations live in `drizzle/*.sql`. | Data layer | Runtime uses SQLite via `SQLITE_DB_PATH` (defaults to `.sites-runtime/data/app.sqlite`) and auto-runs migrations on startup. |
| `drizzle/` | Generated SQL migrations and migration metadata.  These align with `db/schema.ts` changes via `npm run db:generate`, which creates compatible `.sql` files in `./migrations/{timestamp}_{hash}.sql`. Never manually edit `drizzle/*.sql`; always update schema then regenerate, keeping the diff minimal for audit trails on review |
| `scripts/` | Build/install/artifact commands. | Tooling | Prefer running via `npm run …` so `.sites-runtime` env gets set consistently. |
| `tests/` | HTML test suite for rendered docs. Test command builds (via Vite) then uses `node --test tests/rendered-html.test.mjs`. It is not an integration framework like Jest; it renders to DOM trees and checks structure or text rather than unit logic paths, verifying that the UI produces expected outputs on all browsers before deployment |
| `.openai/hosting.json` | Deprecated in the Azure deployment flow. | Platform metadata | Azure config comes from env vars (no secrets committed). |
| `public` | Static assets (favicon, images) served directly. Do not store dynamic content under `app/public/*`; all DB-driven records must live in `/db/schema.ts`, while binary uploads go through the evidence API routes using R2 object keys managed by Cloudflare's storage layer rather than direct local disk writes to avoid file-system permission issues on WSL mounts |

## Development workflow

1. **Install and check bindings**  
   Run `npm run install:ci` once before any build/test activity.

2. **Schema changes**  
   Edit `db/schema.ts`, run `npm run db:generate` for SQL updates, confirm migration diffs in `drizzle/` are minimal and reflect only your structural additions/removals, then build or test immediately to expose schema mismatches early instead of leaving broken queries until integration reviews.

3. **Build**  
   Run `npm run build` (calls into verified scripts that handle artifact validation). Do not use plain `vite build`; the wrapper checks env variables including runtime root and cache locations, which ensures consistent outputs across WSL/Windows environments where path resolution varies by mount point casing or drive letter conventions.

4. **Linting**  
   Run `npm run lint` (calls sites-env.sh to set up ESLint environment before scanning for issues). Skip plain lint commands without prepping the env first; otherwise rules fail on missing plugins from uninstalled dependencies because the wrapper script populates cache and config paths that affect tool resolution in Node's module graph.

5. **Testing**  
   Run `npm test` (builds HTML artifacts then executes node --test against rendered output). It is not possible to run a single test without rebuilding since it requires fresh render cycles after schema updates; if you changed DB tables, build and lint again before testing so that queries match the updated migrations.

6. **Start production server**  
   `npm start` starts vinext with wrangler logs bound correctly. Do not swap dev/start commands unless modifying how Workers interact with D1/R2 during deployment steps after adding custom storage adapters for OneDrive integration phases when blob uploads get replaced by Microsoft Graph proxy endpoints instead of direct S3 API calls |

## Architecture notes and gotchas

- **Azure storage**: Evidence uploads use Azure Blob Storage when configured via `AZURE_STORAGE_CONNECTION_STRING` + `AZURE_STORAGE_CONTAINER`. Without Azure credentials, uploads are stored locally under `.sites-runtime/evidence/`.
- **SQLite runtime**: Database defaults to `.sites-runtime/data/app.sqlite` and auto-runs `drizzle/` migrations at startup.
- **Tests are HTML output checks**: They do not use typical unit frameworks. A failing test often means layout/HTML changed unexpectedly rather than logic errors; inspect the rendered DOM diff in browser DevTools to see what broke instead of checking variable values alone without visualizing how users interact with records when exporting PDFs or DOCX bundles during evidence review steps before competition deadlines |
- **Security**: Never store secrets, env variables for DB credentials or OneDrive tokens anywhere. Only use logical bindings declared in hosting.json; server-side authorization must be enforced via routes that check roles defined by team directory data rather than allowing anyone to create records without approval workflows enabled in later release phases where reviewer comments and locked approvals lock history against tampering attempts |
- **Status semantics**: MVP's `Approved` is a selectable state, not yet immutable. Do not treat it as final signed-off design review; consider this during any PR that affects workflow completion metrics tracked for season reporting before adding audit event logging or version pinning features in future updates alongside native `.docx` generation improvements over current jsPDF-based PDF exports |

## Commands checklist (high-to-low priority)

Priority 1: first time  
- `npm run install:ci` → runtime setup, wrangler logs cache
```bash
cd uir-motorsports-documentation-hub || exit
git pull if needed to get latest schema/migrations
npm run install:ci --no-fund=false # disable fund prompts in CI pipelines where npm version warnings clutter build artifacts with unnecessary funding notices from devDependencies like wrangler that aren't required for core runtime functionality on production hosts using Cloudflare Workers |

Priority 2 (after every change)  
- `npm run db:generate` if schema edited
```bash
npm run lint # always after migration generation, before tests to catch any type errors that would break query execution against fresh D1 instances provisioned during CI when testing new record types or subsystem filters added for season progress reports |

Priority 3 (before PR)  
- `npm test` builds + runs HTML test suite
```bash
npm run validate:artifact # confirm dist output is acceptable before merge since artifact validation ensures build artifacts meet quality standards required by engineering review boards that will approve final competition documents after all subsystems contribute their calculations or simulations to the evidence pack |

Priority 4 (local dev)  
- `npm run dev` Vite + wrangler logs
```bash
npm start # for production builds only when deploying via OpenAI Sites hosting platform where static assets need serverless functions behind edge routes that handle R2 downloads and DOCX/PDF generation requests from browser clients instead of serving raw files directly |

## Advanced notes (for later work)

- When adding features that require OneDrive integration, follow the existing pattern: update app/ code first, then migrations via db/schema.ts. Always run `npm run db:generate` before any testing or further commits to migration changes. Never write SQL manually in drizzle/*.sql—use the generate command instead and keep diff minimal for audit trail integrity during team-wide rollout phases where approval authority mapping replaces current role-based access controls based on department tags defined during pilot setup with five UIR Motorsports engineers

## Current implementation handoff

Read [`AGENTS_SUMMARY.md`](./AGENTS_SUMMARY.md) before continuing feature work. It documents the implemented hierarchy, approval workflow, migration state, validation results, and remaining follow-up items.
