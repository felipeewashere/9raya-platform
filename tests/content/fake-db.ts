/**
 * Tiny in-memory stand-in for the parts of supabase-js used by src/lib/content/import.ts
 * (select/insert/upsert/update/delete with eq / not-in filters, single / maybeSingle).
 * Values are JSON-cloned on write, like a real database round trip.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;
type Filter = (r: Row) => boolean;

const UNIQUE: Record<string, string[]> = {
  courses: ["slug"],
  chapters: ["course_id", "slug"],
  sections: ["chapter_id", "slug"],
  lessons: ["chapter_id", "slug"],
  questions: ["lesson_id", "key"],
  question_answers: ["question_id"],
};

const CASCADE: Record<string, { table: string; column: string; nullify?: boolean }[]> = {
  chapters: [{ table: "sections", column: "chapter_id" }, { table: "lessons", column: "chapter_id" }],
  sections: [{ table: "lessons", column: "section_id" }],
  lessons: [{ table: "questions", column: "lesson_id" }, { table: "lesson_blocks", column: "lesson_id" }],
  questions: [{ table: "question_answers", column: "question_id" }, { table: "lesson_blocks", column: "question_id", nullify: true }],
};

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

export class FakeDb {
  tables: Record<string, Row[]> = {};
  private seq = 0;

  rows(t: string) {
    return (this.tables[t] ??= []);
  }

  newId() {
    this.seq++;
    return `00000000-0000-4000-8000-${String(this.seq).padStart(12, "0")}`;
  }

  remove(t: string, pred: Filter): Row[] {
    const all = this.rows(t);
    const gone = all.filter(pred);
    this.tables[t] = all.filter((r) => !pred(r));
    for (const g of gone)
      for (const c of CASCADE[t] ?? []) {
        if (c.nullify) {
          for (const r of this.rows(c.table)) if (r[c.column] === g.id) r[c.column] = null;
        } else {
          this.remove(c.table, (r) => r[c.column] === g.id);
        }
      }
    return gone;
  }

  from(table: string) {
    return new Query(this, table);
  }

  client() {
    return this as unknown as SupabaseClient;
  }
}

class Query implements PromiseLike<{ data: unknown; error: { message: string } | null }> {
  private op: "select" | "insert" | "upsert" | "update" | "delete" = "select";
  private payload: Row | Row[] | null = null;
  private conflict: string[] | null = null;
  private filters: Filter[] = [];
  private returning = false;
  private mode: "many" | "single" | "maybe" = "many";

  constructor(
    private db: FakeDb,
    private table: string,
  ) {}

  select() {
    if (this.op !== "select") this.returning = true;
    return this;
  }
  insert(rows: Row | Row[]) {
    this.op = "insert";
    this.payload = rows;
    return this;
  }
  upsert(rows: Row | Row[], opts?: { onConflict?: string }) {
    this.op = "upsert";
    this.payload = rows;
    this.conflict = opts?.onConflict ? opts.onConflict.split(",") : UNIQUE[this.table];
    return this;
  }
  update(row: Row) {
    this.op = "update";
    this.payload = row;
    return this;
  }
  delete() {
    this.op = "delete";
    return this;
  }
  eq(col: string, v: unknown) {
    this.filters.push((r) => r[col] === v);
    return this;
  }
  in(col: string, vs: unknown[]) {
    this.filters.push((r) => vs.includes(r[col]));
    return this;
  }
  not(col: string, op: string, list: string) {
    if (op !== "in") throw new Error(`unsupported not.${op}`);
    const vals = list
      .replace(/^\(|\)$/g, "")
      .split(",")
      .map((s) => s.replace(/^"|"$/g, ""));
    this.filters.push((r) => !vals.includes(String(r[col])));
    return this;
  }
  order() {
    return this;
  }
  single() {
    this.mode = "single";
    return this;
  }
  maybeSingle() {
    this.mode = "maybe";
    return this;
  }

  private match(r: Row) {
    return this.filters.every((f) => f(r));
  }

  private run(): Row[] {
    const t = this.db.rows(this.table);
    switch (this.op) {
      case "select":
        return t.filter((r) => this.match(r));
      case "insert": {
        const list = (Array.isArray(this.payload) ? this.payload : [this.payload!]).map((r): Row => ({ id: this.db.newId(), ...clone(r) }));
        for (const r of list) {
          const uniq = UNIQUE[this.table];
          if (uniq && t.some((x) => uniq.every((c) => x[c] === r[c]))) throw new Error(`duplicate key in ${this.table}`);
        }
        if (this.table === "lesson_blocks") {
          for (const r of list) if (t.some((x) => x.lesson_id === r.lesson_id && x.position === r.position)) throw new Error("duplicate block position");
        }
        t.push(...list);
        return list;
      }
      case "upsert": {
        const out: Row[] = [];
        for (const raw of Array.isArray(this.payload) ? this.payload : [this.payload!]) {
          const r = clone(raw);
          const existing = t.find((x) => this.conflict!.every((c) => x[c] === r[c]));
          if (existing) {
            Object.assign(existing, r);
            out.push(existing);
          } else {
            const row = { id: this.db.newId(), ...r };
            t.push(row);
            out.push(row);
          }
        }
        return out;
      }
      case "update": {
        const hit = t.filter((r) => this.match(r));
        for (const r of hit) Object.assign(r, clone(this.payload));
        return hit;
      }
      case "delete":
        return this.db.remove(this.table, (r) => this.match(r));
    }
  }

  then<A = { data: unknown; error: { message: string } | null }, B = never>(
    ok?: ((v: { data: unknown; error: { message: string } | null }) => A | PromiseLike<A>) | null,
    bad?: ((e: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    let result: { data: unknown; error: { message: string } | null };
    try {
      const rows = this.run().map((r) => clone(r));
      const data = this.op !== "select" && !this.returning ? null : rows;
      if (this.mode === "single") {
        result = rows.length === 1 ? { data: rows[0], error: null } : { data: null, error: { message: `expected one row, got ${rows.length}` } };
      } else if (this.mode === "maybe") {
        result = rows.length > 1 ? { data: null, error: { message: "more than one row" } } : { data: rows[0] ?? null, error: null };
      } else result = { data, error: null };
    } catch (e) {
      result = { data: null, error: { message: (e as Error).message } };
    }
    return Promise.resolve(result).then(ok, bad);
  }
}
