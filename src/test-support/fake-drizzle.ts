import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

import type { Db } from '../../drizzle/db';

/**
 * Test double for the Drizzle read client (Phase 2a).
 *
 * `db.select(...)` is a chain of builders that drizzle only turns into SQL when
 * the query is awaited, so the fake exposes the same chain and resolves to the
 * rows a test supplies. Every `select` is recorded so a test can assert on the
 * predicate a read used — `renderSql` turns that predicate back into SQL text
 * and parameters via drizzle's own dialect, which keeps the assertions about
 * semantics rather than object identity.
 */

type Row = Record<string, unknown>;

/** One recorded `db.select(...)` call. */
export interface RecordedSelect {
  kind: 'rows' | 'count';
  where?: SQL;
  orderBy?: SQL;
  limit?: number;
  offset?: number;
}

export interface SelectChain extends PromiseLike<Row[]> {
  from(table: unknown): SelectChain;
  where(predicate: SQL | undefined): SelectChain;
  orderBy(...ordering: Array<SQL | undefined>): SelectChain;
  limit(value: number): SelectChain;
  offset(value: number): SelectChain;
}

/**
 * Build the chainable, awaitable query the fake `select` returns. `result` is
 * evaluated when the query is awaited so a test can change its fixture later.
 */
export function makeSelectChain(
  result: () => Row[],
  record: RecordedSelect = { kind: 'rows' },
): SelectChain {
  const chain: SelectChain = {
    from: () => chain,
    where: (predicate) => {
      record.where = predicate;
      return chain;
    },
    orderBy: (...ordering) => {
      record.orderBy = ordering[0];
      return chain;
    },
    limit: (value) => {
      record.limit = value;
      return chain;
    },
    offset: (value) => {
      record.offset = value;
      return chain;
    },
    then: (onFulfilled, onRejected) => Promise.resolve(result()).then(onFulfilled, onRejected),
  };
  return chain;
}

export interface FakeDrizzle {
  db: Db;
  /** Recorded `select` calls, in call order. */
  selects: RecordedSelect[];
  setRows(rows: Row[]): void;
  setCount(value: number): void;
}

export function makeFakeDrizzle(
  options: { rows?: Row[]; count?: number } = {},
): FakeDrizzle {
  let rows: Row[] = options.rows ?? [];
  let countValue = options.count ?? 0;
  const selects: RecordedSelect[] = [];

  const select = (projection?: Row): SelectChain => {
    const kind = projection && 'value' in projection ? 'count' : 'rows';
    const record: RecordedSelect = { kind };
    selects.push(record);
    return makeSelectChain(
      () => (kind === 'count' ? [{ value: countValue }] : rows),
      record,
    );
  };

  return {
    db: { select } as unknown as Db,
    selects,
    setRows: (next) => {
      rows = next;
    },
    setCount: (next) => {
      countValue = next;
    },
  };
}

const dialect = new PgDialect();

/** Render a drizzle predicate as SQL text + parameters (drizzle's own dialect). */
export function renderSql(value: SQL | undefined): { sql: string; params: unknown[] } | null {
  if (!value) return null;
  const query = dialect.sqlToQuery(value);
  return { sql: query.sql, params: query.params };
}
