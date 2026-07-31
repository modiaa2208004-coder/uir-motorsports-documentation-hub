import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull(),
  season: text("season").notNull(),
  competition: text("competition").notNull().default("Formula Student UK"),
  vehicleClass: text("vehicle_class").notNull().default("FS Class"),
  objective: text("objective").notNull().default(""),
  vehicleSummary: text("vehicle_summary").notNull().default(""),
  status: text("status").notNull().default("Active"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const records = sqliteTable("engineering_records", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().default("HOPE-2027"),
  title: text("title").notNull(),
  type: text("type").notNull(),
  system: text("system").notNull(),
  owner: text("owner").notNull(),
  reviewer: text("reviewer").notNull().default("Department Leader"),
  status: text("status").notNull().default("Draft"),
  problem: text("problem").notNull().default(""),
  detailsJson: text("details_json").notNull().default("{}"),
  completeness: integer("completeness").notNull().default(28),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const evidence = sqliteTable("record_evidence", {
  id: text("id").primaryKey(),
  recordId: text("record_id").notNull(),
  filename: text("filename").notNull(),
  objectKey: text("object_key").notNull(),
  contentType: text("content_type").notNull().default("application/octet-stream"),
  size: integer("size").notNull().default(0),
  caption: text("caption").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
