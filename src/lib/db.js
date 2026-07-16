import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL;
const globalForDb = globalThis;

function getSql() {
  if (!databaseUrl) {
    throw new Error("Neon database is not configured. Add DATABASE_URL to .env.local.");
  }

  if (!/^postgres(ql)?:\/\//i.test(databaseUrl)) {
    throw new Error("DATABASE_URL is invalid. It must start with postgresql:// or postgres://.");
  }

  if (!globalForDb.neonSql) {
    globalForDb.neonSql = neon(databaseUrl);
  }

  return globalForDb.neonSql;
}

function normalizeDocument(row) {
  if (!row) return null;

  const data = typeof row.data === "string" ? JSON.parse(row.data) : row.data || {};
  return {
    _id: row._id || row.id,
    ...data,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeRows(rows) {
  return rows.map(normalizeDocument);
}

function buildWhereClause(filter = {}) {
  const entries = Object.entries(filter).filter(([, value]) => value !== undefined);
  if (!entries.length) {
    return { query: "", values: [] };
  }

  const clauses = [];
  const values = [];

  entries.forEach(([field, value], index) => {
    if (field === "_id") {
      clauses.push(`id = $${index + 1}`);
      values.push(value);
      return;
    }

    clauses.push(`data->>$${index + 1} = $${index + 2}`);
    values.push(field, String(value));
  });

  return { query: ` WHERE ${clauses.join(" AND ")}`, values };
}

function createFinder(tableName, filter = {}) {
  return {
    sort(sortSpec = {}) {
      return {
        async toArray() {
          return queryDocuments(tableName, filter, sortSpec);
        },
      };
    },
    async toArray() {
      return queryDocuments(tableName, filter);
    },
  };
}

async function queryDocuments(tableName, filter = {}, sortSpec = {}) {
  const sql = getSql();
  const { query: whereClause, values } = buildWhereClause(filter);
  const sortEntries = Object.entries(sortSpec);
  const [sortField = "createdAt", direction = 1] = sortEntries[0] || [];
  const orderBy = sortField === "createdAt" ? "created_at" : sortField === "updatedAt" ? "updated_at" : sortField;
  const sortDirection = direction === -1 ? "DESC" : "ASC";

  const rows = await sql.query(
    `SELECT id AS _id, data, created_at, updated_at FROM ${tableName}${whereClause} ORDER BY ${orderBy} ${sortDirection}`,
    values
  );

  return normalizeRows(rows);
}

function createCollection(tableName) {
  return {
    find(filter = {}) {
      return createFinder(tableName, filter);
    },

    async findOne(filter = {}) {
      const sql = getSql();
      const { query: whereClause, values } = buildWhereClause(filter);
      const rows = await sql.query(
        `SELECT id AS _id, data, created_at, updated_at FROM ${tableName}${whereClause} LIMIT 1`,
        values
      );
      return normalizeDocument(rows[0]);
    },

    async insertOne(document) {
      const sql = getSql();
      const createdAt = document.createdAt || new Date();
      const updatedAt = document.updatedAt || createdAt;
      const rows = await sql.query(
        `INSERT INTO ${tableName} (data, created_at, updated_at) VALUES ($1::jsonb, $2, $3) RETURNING id`,
        [JSON.stringify(document), createdAt, updatedAt]
      );
      return { insertedId: rows[0]?.id };
    },

    async insertMany(documents) {
      const insertedIds = [];
      for (const document of documents) {
        const result = await this.insertOne(document);
        insertedIds.push(result.insertedId);
      }
      return { insertedCount: insertedIds.length, insertedIds };
    },

    async findOneAndUpdate(filter, update = {}) {
      const sql = getSql();
      const current = await this.findOne(filter);
      if (!current) return null;

      const nextData = {
        ...current,
        ...(update.$set || {}),
      };
      delete nextData._id;
      delete nextData.createdAt;
      delete nextData.updatedAt;

      if (update.$push) {
        Object.entries(update.$push).forEach(([field, value]) => {
          nextData[field] = Array.isArray(nextData[field]) ? [...nextData[field], value] : [value];
        });
      }

      const rows = await sql.query(
        `UPDATE ${tableName} SET data = $1::jsonb, updated_at = $2 WHERE id = $3 RETURNING id AS _id, data, created_at, updated_at`,
        [JSON.stringify(nextData), update.$set?.updatedAt || new Date(), current._id]
      );

      return { value: normalizeDocument(rows[0]) };
    },

    async updateOne(filter, update = {}, options = {}) {
      const current = await this.findOne(filter);
      if (current) {
        await this.findOneAndUpdate(filter, update);
        return { matchedCount: 1, modifiedCount: 1 };
      }

      if (!options.upsert) {
        return { matchedCount: 0, modifiedCount: 0 };
      }

      const document = {
        ...(update.$setOnInsert || {}),
        ...(update.$set || {}),
      };
      const result = await this.insertOne(document);
      return { matchedCount: 0, modifiedCount: 0, upsertedId: result.insertedId };
    },

    async deleteOne(filter = {}) {
      const sql = getSql();
      const { query: whereClause, values } = buildWhereClause(filter);
      const rows = await sql.query(`DELETE FROM ${tableName}${whereClause} RETURNING id`, values);
      return { deletedCount: rows.length };
    },

    async deleteMany(filter = {}) {
      return this.deleteOne(filter);
    },
  };
}

export async function getDb() {
  return getSql();
}

export async function getCollections() {
  return {
    labs: createCollection("labs"),
    patients: createCollection("patients"),
    advancePayments: createCollection("advance_payments"),
    pendingPayments: createCollection("pending_payments"),
    reports: createCollection("reports"),
    staffAccounts: createCollection("staff_accounts"),
  };
}

export async function ensureDatabaseIndexes() {
  if (globalForDb.dbInitPromise) {
    return globalForDb.dbInitPromise;
  }

  globalForDb.dbInitPromise = (async () => {
    const sql = getSql();

    await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`;

    await sql`
      CREATE TABLE IF NOT EXISTS labs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        data jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS patients (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        data jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS advance_payments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        data jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS pending_payments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        data jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS reports (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        data jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS staff_accounts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        data jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `;

    await Promise.all([
      sql`CREATE UNIQUE INDEX IF NOT EXISTS labs_email_idx ON labs ((data->>'email'))`,
      sql`CREATE UNIQUE INDEX IF NOT EXISTS patients_public_id_idx ON patients ((data->>'id'))`,
      sql`CREATE UNIQUE INDEX IF NOT EXISTS advance_payments_public_id_idx ON advance_payments ((data->>'id'))`,
      sql`CREATE UNIQUE INDEX IF NOT EXISTS pending_payments_public_id_idx ON pending_payments ((data->>'id'))`,
      sql`CREATE INDEX IF NOT EXISTS reports_patient_id_idx ON reports ((data->>'patientId'))`,
      sql`CREATE INDEX IF NOT EXISTS reports_number_idx ON reports ((data->>'reportNumber'))`,
      sql`CREATE UNIQUE INDEX IF NOT EXISTS staff_accounts_lab_email_idx ON staff_accounts ((data->>'labId'), (data->>'email'))`,
      sql`CREATE INDEX IF NOT EXISTS staff_accounts_lab_id_idx ON staff_accounts ((data->>'labId'))`,
    ]);
  })();

  return globalForDb.dbInitPromise;
}

export function toObjectId(id) {
  return typeof id === "string" && id.trim() ? id.trim() : null;
}
