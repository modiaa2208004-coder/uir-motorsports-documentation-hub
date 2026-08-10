import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

let cached: ReturnType<typeof drizzle> | null = null;
type SqliteDatabase = InstanceType<typeof Database>;

export function getDb() {
  if (cached) return cached;

  const dbPath =
    process.env.SQLITE_DB_PATH ||
    path.join(process.cwd(), ".sites-runtime", "data", "app.sqlite");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const sqlite = new Database(dbPath);
  const db = drizzle(sqlite, { schema });
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  repairPartiallyAppliedRoleMigration(sqlite, migrationsFolder);
  migrate(db, { migrationsFolder });
  ensureReviewColumns(sqlite);

  cached = db;
  return db;
}

// Keep already-created local/Docker databases compatible if the app process
// was upgraded without a clean migration restart. This is idempotent and
// only adds columns that are absent; normal schema changes still use Drizzle.
function ensureReviewColumns(sqlite: SqliteDatabase) {
  addMissingColumns(sqlite, "record_reviews", [
    ["proposed_title", "TEXT"],
    ["proposed_system", "TEXT"],
    ["proposed_problem", "TEXT"],
    ["proposed_details_json", "TEXT"],
    ["review_round", "INTEGER NOT NULL DEFAULT 1"],
    ["due_at", "TEXT"],
  ]);
  addMissingColumns(sqlite, "engineering_records", [
    ["review_round", "INTEGER NOT NULL DEFAULT 0"],
    ["review_due_at", "TEXT"],
  ]);
}

// Older containers ran the compatibility helper before migration generation,
// so some databases already contain submitted_role while migration 0008 is
// still pending. Complete that one migration's table work and record it as
// applied, allowing the remaining migrations to run normally.
function repairPartiallyAppliedRoleMigration(sqlite: SqliteDatabase, migrationsFolder: string) {
  if (!tableExists(sqlite, "__drizzle_migrations") || !columnExists(sqlite, "engineering_records", "submitted_role")) return;
  const migrationName = fs.readdirSync(migrationsFolder).find((name) => {
    if (!name.endsWith(".sql")) return false;
    return fs.readFileSync(path.join(migrationsFolder, name), "utf8").includes("ADD `submitted_role`");
  });
  if (!migrationName) return;
  const hash = createHash("sha256").update(fs.readFileSync(path.join(migrationsFolder, migrationName))).digest("hex");
  const applied = sqlite.prepare("SELECT 1 FROM __drizzle_migrations WHERE hash = ? LIMIT 1").get(hash);
  if (applied) return;

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS user_roles (
      id text PRIMARY KEY NOT NULL,
      user_id text NOT NULL,
      role text NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
    CREATE INDEX IF NOT EXISTS user_roles_user_idx ON user_roles (user_id);
    CREATE UNIQUE INDEX IF NOT EXISTS user_roles_user_role_unique ON user_roles (user_id, role);
  `);
  sqlite.prepare("INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)").run(hash, Date.now());
}

function tableExists(sqlite: SqliteDatabase, tableName: string) {
  return Boolean(sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1").get(tableName));
}

function columnExists(sqlite: SqliteDatabase, tableName: string, columnName: string) {
  const table = sqlite.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return table.some((column) => column.name === columnName);
}

function addMissingColumns(sqlite: SqliteDatabase, tableName: string, columns: readonly (readonly [string, string])[]) {
  const table = sqlite.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  if (!table.length) return;
  const existing = new Set(table.map((column) => column.name));
  for (const [name, type] of columns) {
    if (!existing.has(name)) sqlite.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${name} ${type}`).run();
  }
}
