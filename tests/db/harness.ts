/**
 * Runs the real Supabase migrations inside PGlite (Postgres compiled to WASM) with
 * minimal stand-ins for Supabase's `auth` and `storage` schemas and its roles.
 * Lets us test RLS policies, grants and the gamification functions without Docker.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const SUPABASE_STUBS = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb default '{}'
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant execute on function auth.uid() to anon, authenticated, service_role;

create schema storage;
grant usage on schema storage to anon, authenticated, service_role;
create table storage.buckets (
  id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner uuid
);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select string_to_array(name, '/')
$$;
grant all on storage.objects to anon, authenticated, service_role;
`;

export async function createTestDb() {
  const db = new PGlite();
  await db.exec("create extension if not exists pgcrypto;").catch(() => {});
  await db.exec(SUPABASE_STUBS);
  const dir = join(__dirname, "..", "..", "supabase", "migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    try {
      await db.exec(readFileSync(join(dir, file), "utf8"));
    } catch (e) {
      throw new Error(`migration ${file} failed: ${(e as Error).message}`);
    }
  }
  return db;
}

export type Db = Awaited<ReturnType<typeof createTestDb>>;

/** Create an auth user (fires the profile trigger) and return its id. */
export async function createUser(db: Db, email: string, meta: Record<string, unknown> = {}) {
  const id = crypto.randomUUID();
  await db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [id, email, meta]);
  return id;
}

/** Run `fn` as a Supabase role, optionally as a signed-in user, inside a transaction. */
export async function as<T>(
  db: Db,
  role: "anon" | "authenticated" | "service_role",
  userId: string | null,
  fn: (tx: { query: Db["query"]; exec: Db["exec"] }) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${role}`);
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [userId ?? ""]);
    return fn(tx as unknown as { query: Db["query"]; exec: Db["exec"] });
  });
}
