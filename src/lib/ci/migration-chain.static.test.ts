// src/lib/ci/migration-chain.static.test.ts
//
// Pinned static-analysis test for Sprint 3 (2026-04-24 ci-migration-chain-audit).
//
// Contract:
//   1. prisma/migrations/20260417142430_migration_job_bootstrap/ exists
//      and carries migration.sql.
//   2. That SQL bootstraps both the MigrationStatus enum and the
//      MigrationJob table via idempotent CREATE IF NOT EXISTS
//      patterns (DO $$ for the enum, plain IF NOT EXISTS for the
//      table/indexes/FKs).
//   3. The bootstrap intentionally OMITS `scopeOptions` — that
//      column is added by the next migration in the chain
//      (20260417142431_migration_foundation).
//   4. prisma/migrations/20260417142431_migration_foundation/ retains
//      its `ALTER TABLE "MigrationJob" ADD COLUMN "scopeOptions"`
//      (if this migration were edited to re-add the column here,
//      the ALTER would silently no-op and fail on prod migrate).
//   5. schema.prisma still models MigrationJob with every column
//      this bootstrap creates (regression guard).
//
// Together these pins ensure a fresh scratch Postgres can walk the
// migration chain without the bootstrap being silently removed.
//
// Lightweight file-scan only. No runtime booted, no Postgres spawned.

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function findRepoRoot(): string {
  let dir = path.resolve(__dirname);
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, "package.json"))) return dir;
    dir = path.dirname(dir);
  }
  throw new Error("repo root not found");
}

describe("Sprint 3 — migration chain integrity (MigrationJob bootstrap)", () => {
  const root = findRepoRoot();
  const bootstrapDir = path.join(
    root,
    "prisma",
    "migrations",
    "20260417142430_migration_job_bootstrap",
  );
  const bootstrapSql = path.join(bootstrapDir, "migration.sql");
  const foundationSql = path.join(
    root,
    "prisma",
    "migrations",
    "20260417142431_migration_foundation",
    "migration.sql",
  );
  const schemaPath = path.join(root, "prisma", "schema.prisma");

  it("bootstrap migration directory + SQL exist", () => {
    expect(fs.existsSync(bootstrapDir)).toBe(true);
    expect(fs.existsSync(bootstrapSql)).toBe(true);
  });

  it("bootstrap creates MigrationStatus enum idempotently (DO $$ IF NOT EXISTS)", () => {
    const sql = fs.readFileSync(bootstrapSql, "utf8");
    expect(
      /IF NOT EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+pg_type\s+WHERE\s+typname\s*=\s*'MigrationStatus'/.test(
        sql,
      ),
    ).toBe(true);
    expect(/CREATE TYPE\s+"MigrationStatus"\s+AS ENUM/.test(sql)).toBe(true);
    // Every schema.prisma MigrationStatus value must appear
    for (const v of [
      "PENDING",
      "FILES_UPLOADED",
      "MAPPING_REVIEW",
      "VALIDATING",
      "VALIDATED",
      "IMPORTING",
      "COMPLETED",
      "FAILED",
      "CANCELLED",
    ]) {
      expect(sql.includes(`'${v}'`)).toBe(true);
    }
  });

  it("bootstrap creates MigrationJob table idempotently", () => {
    const sql = fs.readFileSync(bootstrapSql, "utf8");
    expect(/CREATE TABLE IF NOT EXISTS\s+"MigrationJob"/.test(sql)).toBe(true);
    expect(/"MigrationJob_pkey"\s+PRIMARY KEY\s*\(\s*"id"\s*\)/.test(sql)).toBe(true);
    // Three secondary indexes (as per schema.prisma @@index declarations)
    expect(/CREATE INDEX IF NOT EXISTS\s+"MigrationJob_organizationId_status_idx"/.test(sql)).toBe(
      true,
    );
    expect(
      /CREATE INDEX IF NOT EXISTS\s+"MigrationJob_organizationId_createdAt_idx"/.test(sql),
    ).toBe(true);
    expect(/CREATE INDEX IF NOT EXISTS\s+"MigrationJob_createdByUserId_idx"/.test(sql)).toBe(true);
    // Two FKs, both idempotent
    expect(/conname\s*=\s*'MigrationJob_organizationId_fkey'/.test(sql)).toBe(true);
    expect(/conname\s*=\s*'MigrationJob_createdByUserId_fkey'/.test(sql)).toBe(true);
  });

  it("bootstrap intentionally OMITS scopeOptions (added by the next migration)", () => {
    const sql = fs.readFileSync(bootstrapSql, "utf8");
    // The CREATE TABLE block should not reference scopeOptions at all.
    expect(/"scopeOptions"/.test(sql)).toBe(false);
  });

  it("20260417142431_migration_foundation still ADDs scopeOptions (not folded into bootstrap)", () => {
    const sql = fs.readFileSync(foundationSql, "utf8");
    expect(/ALTER TABLE\s+"MigrationJob"[\s\S]*?ADD COLUMN\s+"scopeOptions"/.test(sql)).toBe(true);
  });

  it("schema.prisma still models MigrationJob with every bootstrap column", () => {
    const schema = fs.readFileSync(schemaPath, "utf8");
    const block = schema.match(/^model MigrationJob [\s\S]*?^}/m);
    expect(block).toBeTruthy();
    const body = block?.[0] ?? "";
    // Every column the bootstrap creates (scopeOptions added later)
    for (const field of [
      "id",
      "organizationId",
      "sourcePlatform",
      "status",
      "sourceFiles",
      "fieldMappings",
      "validationReport",
      "importResults",
      "startedAt",
      "completedAt",
      "createdByUserId",
      "notes",
      "createdAt",
      "updatedAt",
    ]) {
      expect(new RegExp(`^\\s+${field}\\b`, "m").test(body)).toBe(true);
    }
  });

  it("baseline migration does not already CREATE MigrationJob (guards against duplicate CREATE)", () => {
    const baseline = fs.readFileSync(
      path.join(root, "prisma", "migrations", "00000000000000_baseline", "migration.sql"),
      "utf8",
    );
    expect(/CREATE TABLE\s+"MigrationJob"/.test(baseline)).toBe(false);
  });
});
