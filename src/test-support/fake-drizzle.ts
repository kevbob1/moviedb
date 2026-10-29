import { getTableColumns, SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

import type { Db } from '../../drizzle/db';
import { jobs, requests } from '../../drizzle/schema';

/**
 * Test doubles for the Drizzle client.
 *
 * Two shapes, because tests ask two different questions:
 *
 * - `makeFakeDrizzle` is the scripted read seam Phase 2a introduced: it records
 *   every `select` so a test can assert on the predicate a read used, and
 *   returns whatever rows the test supplied. It knows nothing about state.
 * - `makeInMemoryDrizzle` is a small in-memory `requests`/`jobs` store used by
 *   the write-path tests (Phase 2b). It applies predicates, writes, and
 *   transaction rollback so the lifecycle flows are exercised as behaviour
 *   rather than as a transcript of calls.
 */

type Row = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Scripted read seam
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// In-memory store (write paths)
// ---------------------------------------------------------------------------

/** One recorded insert/update/delete, so a test can assert on the predicate. */
export interface RecordedWrite {
  op: 'insert' | 'update' | 'delete';
  table: 'requests' | 'jobs';
  where?: SQL;
  values?: Row;
  rows: number;
}

export interface InMemoryStore {
  /** `requests` rows in the snake_case shape the store and projections use. */
  requests: Row[];
  /** `jobs` rows in the snake_case shape the Prisma-era code used. */
  jobs: Row[];
  /** Recorded reads, so a test can assert on the predicate a write path used. */
  selects: RecordedSelect[];
  /** Recorded writes, in call order. */
  writes: RecordedWrite[];
  /** How many times `db.transaction(fn)` ran. */
  transactions: number;
  /** Make the next insert/update/delete throw, to prove a transaction rolls back. */
  failNextWrite(error: Error): void;
  /**
   * Model an insert race the caller loses: the winner's row lands first, then
   * the next insert throws Postgres' unique-violation SQLSTATE (23505), the
   * way the partial singleton index answers a real race. Also clears an armed
   * `failNextWrite`, so a leaked arming cannot poison the race.
   */
  raceNextInsert(row: Row): void;
}

export interface InMemoryDrizzle {
  db: Db;
  store: InMemoryStore;
}

const storesByDb = new WeakMap<object, InMemoryStore>();

/**
 * The store behind a `db` created by `makeInMemoryDrizzle`. Lets a test that
 * can only reach the `jest.mock`-ed module value still inspect state.
 */
export function storeOf(db: unknown): InMemoryStore {
  const store = typeof db === 'object' && db !== null ? storesByDb.get(db) : undefined;
  if (!store) {
    throw new Error('fake-drizzle: this db was not created by makeInMemoryDrizzle');
  }
  return store;
}

/** Fixture timestamps stay fixed so assertions can compare exact instants. */
const FIXED_NOW = () => new Date('2026-01-01T00:00:00.000Z');

interface StoreState {
  requests: Row[];
  jobs: Row[];
  nextRequestId: number;
  nextJobId: number;
}

function requestDefaults(state: StoreState, now: () => Date): Row {
  return {
    id: state.nextRequestId++,
    title: 'untitled',
    tmdb_id: null,
    season_number: null,
    poster_path: null,
    overview: null,
    release_date: null,
    genre_ids: [],
    requested_at: now(),
    requested_by: 'nobody',
    status: 'pending',
    media_type: 'movie',
    torrent_hash: null,
    torrent_problem: null,
    resolved_at: null,
    suggestion_hash: null,
    suggestion_score: null,
    suggestion_computed_at: null,
  };
}

function jobDefaults(state: StoreState, now: () => Date): Row {
  return {
    id: state.nextJobId++,
    type: 'unknown',
    payload: null,
    status: 'pending',
    attempts: 0,
    maxAttempts: 3,
    error: null,
    created_at: now(),
    updated_at: now(),
    completed_at: null,
  };
}

function tableName(table: unknown): 'requests' | 'jobs' {
  if (table === requests) return 'requests';
  if (table === jobs) return 'jobs';
  throw new Error('fake-drizzle: unsupported table');
}

function columnName(column: unknown): string {
  if (column && typeof column === 'object' && 'name' in column && typeof column.name === 'string') {
    return column.name;
  }
  throw new Error('fake-drizzle: projection value is not a column');
}

/**
 * Map the camelCase insert/update values drizzle is handed onto the snake_case
 * keys the store uses (the same shape a raw pg row and `toRequestModel` use).
 * Table columns own the mapping, so a schema rename cannot silently drift here.
 */
function toColumnValues(table: unknown, values: Row, row?: Row): Row {
  const columns = getTableColumns(table as never) as Record<string, unknown>;
  const byName = new Map<string, string>();
  for (const [key, column] of Object.entries(columns)) {
    byName.set(key, columnName(column));
  }

  const mapped: Row = {};
  for (const [key, value] of Object.entries(values)) {
    const name = byName.get(key) ?? key;
    mapped[name] = resolveValue(value, row);
  }
  return mapped;
}

/**
 * `sql` values are how an increment is expressed (the job claim's
 * `attempts + 1`). The fake only understands that one shape and refuses the
 * rest, so an unsupported expression fails loudly instead of being ignored.
 */
function resolveValue(value: unknown, row?: Row): unknown {
  if (!(value instanceof SQL)) return value;

  const { sql } = dialect.sqlToQuery(value);
  const increment = /^"(\w+)"\."(\w+)" \+ (\d+)$/.exec(sql);
  if (increment && row) {
    const [, , column, amount] = increment;
    return Number(row[column] ?? 0) + Number(amount);
  }
  throw new Error(`fake-drizzle: unsupported SQL value: ${sql}`);
}

function projectRow(row: Row, projection?: Row, table?: unknown): Row {
  if (projection) {
    const projected: Row = {};
    for (const [key, column] of Object.entries(projection)) {
      projected[key] = row[columnName(column)];
    }
    return projected;
  }

  // A projection-less `select()` is what drizzle hands back for a whole table:
  // field names are the schema's camelCase keys, not the column names.
  if (!table) return { ...row };
  const projected: Row = {};
  for (const [key, column] of Object.entries(tableColumns(table))) {
    projected[key] = row[columnName(column)];
  }
  return projected;
}

function tableColumns(table: unknown): Record<string, unknown> {
  return getTableColumns(table as never) as Record<string, unknown>;
}

/** Map camelCase schema keys onto the snake_case column names the store uses. */
function seedRow(table: unknown, row: Row): Row {
  const columns = tableColumns(table);
  const mapped: Row = {};
  for (const [key, value] of Object.entries(row)) {
    const column = columns[key];
    mapped[column ? columnName(column) : key] = value;
  }
  return mapped;
}

// ---------------------------------------------------------------------------
// Predicate evaluation
// ---------------------------------------------------------------------------

function normalize(value: unknown): unknown {
  return value instanceof Date ? value.toISOString() : value;
}

function compare(left: unknown, right: unknown): number {
  const a = normalize(left);
  const b = normalize(right);
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const textA = String(a);
  const textB = String(b);
  if (textA === textB) return 0;
  return textA < textB ? -1 : 1;
}

function stripOuterParens(text: string): string {
  let current = text.trim();
  while (current.startsWith('(') && current.endsWith(')')) {
    let depth = 0;
    let closesAtEnd = false;
    for (let index = 0; index < current.length; index++) {
      if (current[index] === '(') depth++;
      if (current[index] === ')') depth--;
      if (depth === 0) {
        closesAtEnd = index === current.length - 1;
        break;
      }
    }
    if (!closesAtEnd) break;
    current = current.slice(1, -1).trim();
  }
  return current;
}

/** Split on a boolean operator that appears outside any parentheses. */
function splitTopLevel(text: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;

  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (depth !== 0) continue;
    if (text.startsWith(separator, index)) {
      parts.push(text.slice(start, index));
      index += separator.length - 1;
      start = index + 1;
    }
  }

  parts.push(text.slice(start));
  return parts;
}

const COLUMN_TERM = /^"(\w+)"\."(\w+)"\s+(.+)$/;

function evaluateTerm(term: string, params: unknown[], row: Row): boolean {
  const parsed = COLUMN_TERM.exec(term);
  if (!parsed) {
    throw new Error(`fake-drizzle: unsupported predicate: ${term}`);
  }

  const [, , column, rest] = parsed;
  const value = row[column] ?? null;

  if (rest === 'is null') return value === null;
  if (rest === 'is not null') return value !== null;

  const parameterAt = (index: number): unknown => params[index - 1];

  const single = /^(=|<|>|<=|>=|<>)\s+\$(\d+)$/.exec(rest);
  if (single) {
    const [, operator, index] = single;
    const other = parameterAt(Number(index));
    switch (operator) {
      case '=':
        return value !== null && compare(value, other) === 0;
      case '<>':
        return value !== null && compare(value, other) !== 0;
      case '<':
        return value !== null && compare(value, other) < 0;
      case '>':
        return value !== null && compare(value, other) > 0;
      case '<=':
        return value !== null && compare(value, other) <= 0;
      case '>=':
        return value !== null && compare(value, other) >= 0;
    }
  }

  const inList = /^in \(([^)]*)\)$/.exec(rest);
  if (inList) {
    const indexes = inList[1].split(',').map((part) => Number(part.trim().replace('$', '')));
    return indexes.some((index) => value !== null && compare(value, parameterAt(index)) === 0);
  }

  throw new Error(`fake-drizzle: unsupported predicate term: ${term}`);
}

function evaluate(expression: string, params: unknown[], row: Row): boolean {
  const text = stripOuterParens(expression);

  const orParts = splitTopLevel(text, ' or ');
  if (orParts.length > 1) return orParts.some((part) => evaluate(part, params, row));

  const andParts = splitTopLevel(text, ' and ');
  if (andParts.length > 1) return andParts.every((part) => evaluate(part, params, row));

  return evaluateTerm(text, params, row);
}

/** Whether `row` satisfies a drizzle predicate, rendered by drizzle's dialect. */
export function matchesWhere(where: SQL | undefined, row: Row): boolean {
  if (!where) return true;
  const { sql, params } = dialect.sqlToQuery(where);
  return evaluate(sql, params, row);
}

function applyOrderBy(rows: Row[], orderBy: SQL | undefined): Row[] {
  if (!orderBy) return rows;

  const { sql } = dialect.sqlToQuery(orderBy);
  const parsed = /^"(\w+)"\."(\w+)" (asc|desc)$/.exec(sql);
  if (!parsed) throw new Error(`fake-drizzle: unsupported ordering: ${sql}`);

  const [, , column, direction] = parsed;
  const sign = direction === 'desc' ? -1 : 1;
  return [...rows].sort((left, right) => sign * compare(left[column], right[column]));
}

// ---------------------------------------------------------------------------
// In-memory client
// ---------------------------------------------------------------------------

export function makeInMemoryDrizzle(
  options: { requests?: Row[]; jobs?: Row[]; now?: () => Date } = {},
): InMemoryDrizzle {
  const now = options.now ?? FIXED_NOW;
  const state: StoreState = {
    requests: [],
    jobs: [],
    nextRequestId: 1,
    nextJobId: 1,
  };

  // Seeded rows get the same defaults an insert would, so a partial fixture is
  // still a complete row when a read projects it.
  for (const row of options.requests ?? []) {
    state.requests.push({ ...requestDefaults(state, now), ...seedRow(requests, row) });
  }
  for (const row of options.jobs ?? []) {
    state.jobs.push({ ...jobDefaults(state, now), ...seedRow(jobs, row) });
  }

  const store: InMemoryStore = {
    requests: state.requests,
    jobs: state.jobs,
    selects: [],
    writes: [],
    transactions: 0,
    failNextWrite: (error) => {
      pendingFailure = error;
    },
    raceNextInsert: (row) => {
      pendingFailure = undefined;
      raceWinner = row;
    },
  };

  let pendingFailure: Error | undefined;
  let raceWinner: Row | undefined;

  /** The error a real insert race dies with (partial singleton index). */
  const uniqueViolation = (): Error =>
    Object.assign(
      new Error('duplicate key value violates unique constraint "jobs_singleton_live_type_key"'),
      { code: '23505' },
    );

  const rowsFor = (table: unknown): Row[] => {
    const name = tableName(table);
    return name === 'requests' ? state.requests : state.jobs;
  };

  const write = (record: RecordedWrite): void => {
    if (pendingFailure) {
      const error = pendingFailure;
      pendingFailure = undefined;
      throw error;
    }
    store.writes.push(record);
  };

  const applyPredicate = (table: unknown, where: SQL | undefined): Row[] => {
    return rowsFor(table).filter((row) => matchesWhere(where, row));
  };

  const insert = (table: unknown) => ({
    values: (values: Row) => {
      const run = (): Row[] => {
        const name = tableName(table);
        if (raceWinner) {
          // The winner's insert lands first; ours dies on the unique index.
          const winner = raceWinner;
          raceWinner = undefined;
          const defaults = name === 'requests'
            ? requestDefaults(state, now)
            : jobDefaults(state, now);
          rowsFor(table).push({ ...defaults, ...seedRow(table, winner) });
          throw uniqueViolation();
        }
        const defaults = name === 'requests'
          ? requestDefaults(state, now)
          : jobDefaults(state, now);
        const row: Row = { ...defaults, ...toColumnValues(table, values) };
        write({ op: 'insert', table: name, values: { ...values }, rows: 1 });
        rowsFor(table).push(row);
        return [row];
      };

      return {
        returning: (projection?: Row): Promise<Row[]> =>
          Promise.resolve(run().map((row) => projectRow(row, projection))),
        then: (
          onFulfilled?: (value: { rowCount: number }) => unknown,
          onRejected?: (reason: unknown) => unknown,
        ): Promise<unknown> => Promise.resolve({ rowCount: 1 }).then(onFulfilled, onRejected),
      };
    },
  });

  const update = (table: unknown) => ({
    set: (values: Row) => ({
      where: (where: SQL | undefined) => {
        const run = (): Row[] => {
          const matched = applyPredicate(table, where);
          const updated = matched.map((row) => {
            Object.assign(row, toColumnValues(table, values, row));
            return row;
          });
          write({ op: 'update', table: tableName(table), where, values: { ...values }, rows: matched.length });
          return updated;
        };

        return {
          returning: (projection?: Row): Promise<Row[]> =>
            Promise.resolve(run().map((row) => projectRow(row, projection))),
          then: (
            onFulfilled?: (value: { rowCount: number; rows: Row[] }) => unknown,
            onRejected?: (reason: unknown) => unknown,
          ): Promise<unknown> => {
            const rows = run();
            return Promise.resolve({ rowCount: rows.length, rows }).then(onFulfilled, onRejected);
          },
        };
      },
    }),
  });

  const remove = (table: unknown) => ({
    where: (where: SQL | undefined) => {
      const run = (): Row[] => {
        const rows = rowsFor(table);
        const matched = rows.filter((row) => matchesWhere(where, row));
        const remaining = rows.filter((row) => !matchesWhere(where, row));
        rows.length = 0;
        rows.push(...remaining);
        write({ op: 'delete', table: tableName(table), where, rows: matched.length });
        return matched;
      };

      return {
        returning: (projection?: Row): Promise<Row[]> =>
          Promise.resolve(run().map((row) => projectRow(row, projection))),
        then: (
          onFulfilled?: (value: { rowCount: number }) => unknown,
          onRejected?: (reason: unknown) => unknown,
        ): Promise<unknown> => Promise.resolve({ rowCount: run().length }).then(onFulfilled, onRejected),
      };
    },
  });

  const select = (projection?: Row) => {
    const record: RecordedSelect = {
      kind: projection && 'value' in projection ? 'count' : 'rows',
    };
    store.selects.push(record);

    const run = (): Row[] => {
      const table = currentTable ?? requests;
      const matched = applyPredicate(table, record.where);

      if (record.kind === 'count') return [{ value: matched.length }];

      const ordered = applyOrderBy(matched, record.orderBy);
      const start = record.offset ?? 0;
      const end = record.limit === undefined ? undefined : start + record.limit;
      return ordered.slice(start, end).map((row) => projectRow(row, projection, currentTable));
    };

    let currentTable: unknown;

    const chain: SelectChain = {
      from: (table) => {
        currentTable = table;
        return chain;
      },
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
      then: (onFulfilled, onRejected) => Promise.resolve(run()).then(onFulfilled, onRejected),
    };

    return chain;
  };

  const client = {
    select,
    insert,
    update,
    delete: remove,
  };

  /** A transaction sees and mutates the same store; rollback restores it. */
  const transaction = async <T>(fn: (tx: typeof client) => Promise<T>): Promise<T> => {
    store.transactions++;
    const requestSnapshot = state.requests.map((row) => ({ ...row }));
    const jobSnapshot = state.jobs.map((row) => ({ ...row }));
    try {
      return await fn(client);
    } catch (error) {
      state.requests.length = 0;
      state.requests.push(...requestSnapshot);
      state.jobs.length = 0;
      state.jobs.push(...jobSnapshot);
      throw error;
    }
  };

  const db = { ...client, transaction } as unknown as Db;
  storesByDb.set(db as unknown as object, store);

  return { db, store };
}

const dialect = new PgDialect();

/** Render a drizzle predicate as SQL text + parameters (drizzle's own dialect). */
export function renderSql(value: SQL | undefined): { sql: string; params: unknown[] } | null {
  if (!value) return null;
  const query = dialect.sqlToQuery(value);
  return { sql: query.sql, params: query.params };
}
