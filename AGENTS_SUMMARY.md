# Agent Handoff Summary

This file is a continuation guide for the next coding agent. The repository also contains `AGENTS.md`, which has the project setup and safety instructions; preserve those instructions.

## Current state

The application has been substantially updated into a UIR Motorsports engineering documentation and approval hub. The worktree already contains broad user-requested changes. Do not reset, clean, or discard the existing modified/untracked files.

The current implementation includes:

- Next.js app routes and client UI under `app/`.
- Drizzle ORM with SQLite under `db/` and `drizzle/`.
- Local development and production Docker files.
- Local auth for development and Entra-related routes for production.
- UIR Motorsports logo at `public/logo.png`.

## Core invariant: fixed hierarchy

The hierarchy is defined in `app/api/_lib/hierarchy.ts` through `POSITION_DEFINITIONS` and `ORGANIZATION_DEPARTMENTS`:

```text
TEAM_LEADER
├── OPERATIONS_LEADER
│   ├── MARKETING_HEAD
│   ├── FINANCE_HEAD
│   └── LOGISTICS_HEAD
└── COMPETITION_LEADER
    ├── STATIC_EVENTS_LEADER
    │   ├── BUSINESS_PLAN_HEAD
    │   └── COST_MANUFACTURING_HEAD
    └── TECHNICAL_DYNAMIC_LEADER
        ├── VEHICLE_MECHANICS_HEAD
        ├── CHASSIS_HEAD
        ├── POWERTRAIN_HEAD
        ├── ELECTRONICS_HEAD
        └── SIMULATION_TEST_HEAD
```

`DEPUTY_TEAM_LEADER` is also supported and has Team Leader as its parent. Position definitions are seeded into `organizational_positions`; people are assigned through `user_positions`. A position has one current occupant because the users API removes an existing occupant before assigning that position to another user. A person can still have multiple positions, roles, and departments.

Do not reintroduce `reports_to_user_id`, manual supervisor fields, or manual record reviewer selectors. The reviewer is the current user occupying the next position in the automatic chain, not a separate account type.

## Central hierarchy service

Use the helpers in `app/api/_lib/hierarchy.ts` instead of duplicating authorization logic:

- `resolveApprovalChain`
- `resolveApprovalChainForRecord`
- `getManagementChain`
- `getDescendantDepartments`
- `canViewRecord`
- `canViewDepartment`
- `canReviewRecord`
- `canMasterApprove`
- `getNextApprovalStep`
- `performMasterApproval`
- `refreshOverdueRecords`

`app/api/_lib/workflow.ts` is a compatibility/re-export layer. Shared notification delivery lives in `workflow-notify.ts`.

## Record workflow

1. Any authenticated member can create a Draft record.
2. The owner submits it by changing status to `In review`.
3. Submission resolves the department head and all higher occupied positions, creates an `approval_workflows` row and sequential `approval_steps`, and notifies the chain.
4. Only the current pending step can submit a normal review decision.
5. A reviewer can approve, reject, or return changes. Returned reviews create a `record_reviews` sub-record with:
   - requested changes (`requestedChanges`)
   - reason/comment (`comment`)
   - copied/proposed title, sub-project, problem, and guided answers
   - optional return deadline (`dueAt`)
6. A return changes the record to `Returned` and points the displayed reviewer back to the reviewer who requested changes. Resubmission resets the automatic chain and preserves the review deadline when one was set.
7. Every change is captured in `record_events` and `record_versions` where applicable.
8. `Approved`, `Closed`, and `Archived` records are sealed in the API and UI. Create a new record for later work.

The review API returns the updated record so the UI immediately reflects the next reviewer, returned state, or final approval. Do not regress this by updating only the status in the client.

## Master Approval

Master Approval is implemented in `app/api/master-approvals/route.ts` and `performMasterApproval`:

- It is available to authorized leaders in the relevant department scope.
- It is allowed for normal emergencies and overdue records; non-overdue actions require a comment.
- It bypasses only pending steps below the approving position.
- Higher pending steps remain in the workflow.
- Team Leader can finalize all remaining lower steps.
- It records reason, comment, approver, timestamp, actor authority, and bypassed user IDs.
- Approval steps use `BYPASSED` and `MASTER_APPROVED` to preserve history.
- The UI provides single-record and leader-only bulk Master Approval for overdue records.

## Overdue escalation

`refreshOverdueRecords` is called while loading records/reviews. It changes overdue in-review records to `Overdue`, creates permanent events, and notifies the current reviewer and successive higher authorities.

The global setting is stored as `workflow_settings.setting_key = overdue_escalation_hours`, seeded to `24`, and can be changed by Team Leader/deputy/admin through the Team screen and `PATCH /api/organization`.

## Other workflow surfaces

- `app/api/tasks/route.ts`: task visibility uses record/department hierarchy; assignments notify the management chain.
- `app/api/requests/route.ts`: manufacturing and purchase requests now resolve automatic approval chains; manual approver selection was removed from the UI. Request approval state is stored in `approvalChainJson` with step status and is handled sequentially by `requests/[id]/route.ts`.
- `app/api/records/route.ts`: record visibility filters through `canViewRecord` and refreshes overdue state.
- `app/api/users/route.ts`: Team Leader/deputy/admin manage roles, departments, and positions. Reviewer is rejected as a team role.
- `app/api/organization/route.ts`: exposes positions/occupants and the global overdue setting.
- `app/hub.tsx`: main UI, review queue, calendar, team directory, evidence preview/download, Master Approval modals, audit history, and exports.
- `app/workspace/Modules.tsx`: tasks, requests, notifications, project structure, and legacy approval-matrix views.

## Schema and migration notes

Schema changes belong in `db/schema.ts`. Run `npm run db:generate`; never hand-edit generated `drizzle/*.sql` files. The current hierarchy migration is:

```text
drizzle/0011_milky_omega_flight.sql
```

It adds:

- `organizational_positions`
- `user_positions`
- `workflow_settings`
- record overdue/approval-chain/Master Approval fields
- removal of `reporting_relationships`

SQLite migrations run automatically from `db/index.ts` when the app starts. The compatibility helper in `db/index.ts` exists for older review columns and should remain idempotent.

## Auth and permissions

Role helpers are in `app/roles.ts`; session/database merging is in `app/auth.ts`.

- `canEdit` means admin, Team Leader, or Deputy Team Leader.
- Normal owners may edit their own unsealed records.
- Reviewers can propose review changes but do not directly edit the main record through the review API.
- Team directory assignment is limited to Team Leader/deputy/admin, with department-scope checks for non-global leaders.
- Local configured accounts are merged with DB registrations so login choices match registered accounts.

Do not put credentials, database secrets, or storage tokens in source control.

## Verification already completed

The following passed after the latest implementation:

```bash
npm run lint
npm run build
npm test
npm run validate:artifact
```

Manual smoke verification also covered automatic record routing, sequential request approval, returned review sub-records, and Team Leader Master Approval with preserved `BYPASSED`/`MASTER_APPROVED` steps. Temporary smoke data was removed afterward.

The build has one known non-blocking Turbopack NFT warning from dynamic filesystem resolution in `app/api/_lib/evidenceStorage.ts`.

## Follow-up items

1. The approval-matrix screen and API remain as legacy configurable UI. The main record/request workflows now use the fixed hierarchy and do not depend on those rules. Decide whether to remove or relabel that screen in a later cleanup.
2. The rendered test suite is intentionally small and checks generated HTML metadata, not full browser/API integration. Add targeted route tests if the test strategy is expanded.
3. `RecordDetail` currently fetches record permissions and approval steps in separate requests; combine them if optimizing network behavior.
4. Keep export history changes backward-compatible. Existing exports include review sub-records, proposed answers, evidence register, and audit events.
5. Historical migration files can mention `reports_to_user_id`; do not rewrite migration history. The current schema and migration 0011 remove the active table.
