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

function getJsonValue(document, field) {
  return document[field] === undefined ? null : document[field];
}

function normalizeDocument(row) {
  if (!row) return null;
  return {
    _id: row._id || row.id,
    ...row.data,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeRows(rows) {
  return rows.map(normalizeDocument);
}

function getFirstFilterEntry(filter = {}) {
  const entries = Object.entries(filter);
  return entries.length ? entries[0] : null;
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
  const filterEntry = getFirstFilterEntry(filter);
  const sortEntry = getFirstFilterEntry(sortSpec);
  const sortField = sortEntry?.[0] || "createdAt";
  const sortDirection = sortEntry?.[1] === -1 ? "DESC" : "ASC";

  if (filterEntry && sortField === "createdAt") {
    const [field, value] = filterEntry;
    const rows = await sql.query(
      `SELECT id AS _id, data, created_at, updated_at
       FROM ${tableName}
       WHERE data->>$1 = $2
       ORDER BY created_at ${sortDirection}`,
      [field, String(value)]
    );
    return normalizeRows(rows);
  }

  if (filterEntry) {
    const [field, value] = filterEntry;
    const rows = await sql.query(
      `SELECT id AS _id, data, created_at, updated_at
       FROM ${tableName}
       WHERE data->>$1 = $2`,
      [field, String(value)]
    );
    return normalizeRows(rows);
  }

  const orderBy = sortField === "createdAt" ? "created_at" : "updated_at";
  const rows = await sql.query(
    `SELECT id AS _id, data, created_at, updated_at
     FROM ${tableName}
     ORDER BY ${orderBy} ${sortDirection}`
  );
  return normalizeRows(rows);
}

function createCollection(tableName, uniqueField = null) {
  return {
    async createIndex() {
      return null;
    },

    async countDocuments() {
      const sql = getSql();
      const rows = await sql.query(`SELECT COUNT(*)::int AS count FROM ${tableName}`);
      return rows[0]?.count || 0;
    },

    find(filter = {}) {
      return createFinder(tableName, filter);
    },

    async findOne(filter = {}) {
      const sql = getSql();
      const id = filter._id || null;

      if (id) {
        const rows = await sql.query(
          `SELECT id AS _id, data, created_at, updated_at FROM ${tableName} WHERE id = $1 LIMIT 1`,
          [id]
        );
        return normalizeDocument(rows[0]);
      }

      const filterEntry = getFirstFilterEntry(filter);
      if (!filterEntry) {
        const rows = await sql.query(
          `SELECT id AS _id, data, created_at, updated_at FROM ${tableName} ORDER BY created_at ASC LIMIT 1`
        );
        return normalizeDocument(rows[0]);
      }

      const [field, value] = filterEntry;
      const rows = await sql.query(
        `SELECT id AS _id, data, created_at, updated_at
         FROM ${tableName}
         WHERE data->>$1 = $2
         LIMIT 1`,
        [field, String(value)]
      );
      return normalizeDocument(rows[0]);
    },

    async insertOne(document) {
      const sql = getSql();
      const createdAt = document.createdAt || new Date();
      const updatedAt = document.updatedAt || createdAt;
      const rows = await sql.query(
        `INSERT INTO ${tableName} (data, created_at, updated_at)
         VALUES ($1::jsonb, $2, $3)
         RETURNING id`,
        [JSON.stringify(document), createdAt, updatedAt]
      );
      return { insertedId: rows[0].id };
    },

    async insertMany(documents) {
      const insertedIds = [];
      for (const document of documents) {
        const result = await this.insertOne(document);
        insertedIds.push(result.insertedId);
      }
      return { insertedCount: insertedIds.length, insertedIds };
    },

    async findOneAndUpdate(filter, update) {
      const sql = getSql();
      const current = await this.findOne(filter);
      if (!current) return null;

      const nextData = {
        ...current,
        ...(update?.$set || {}),
      };
      delete nextData._id;
      delete nextData.createdAt;
      delete nextData.updatedAt;

      if (update?.$push) {
        for (const [field, value] of Object.entries(update.$push)) {
          nextData[field] = Array.isArray(nextData[field]) ? [...nextData[field], value] : [value];
        }
      }

      const rows = await sql.query(
        `UPDATE ${tableName}
         SET data = $1::jsonb, updated_at = $2
         WHERE id = $3
         RETURNING id AS _id, data, created_at, updated_at`,
        [JSON.stringify(nextData), update?.$set?.updatedAt || new Date(), current._id]
      );
      return normalizeDocument(rows[0]);
    },

    async updateOne(filter, update, options = {}) {
      const current = await this.findOne(filter);
      if (current) {
        await this.findOneAndUpdate(filter, update);
        return { matchedCount: 1, modifiedCount: 1 };
      }

      if (!options.upsert) {
        return { matchedCount: 0, modifiedCount: 0 };
      }

      const document = {
        ...(update?.$setOnInsert || {}),
        ...(update?.$set || {}),
      };
      const result = await this.insertOne(document);
      return { matchedCount: 0, modifiedCount: 0, upsertedId: result.insertedId };
    },

    async deleteOne(filter = {}) {
      const sql = getSql();
      const id = filter._id || null;

      if (id) {
        const rows = await sql.query(`DELETE FROM ${tableName} WHERE id = $1 RETURNING id`, [id]);
        return { deletedCount: rows.length };
      }

      const filterEntry = getFirstFilterEntry(filter);
      if (!filterEntry) return { deletedCount: 0 };

      const [field, value] = filterEntry;
      const rows = await sql.query(
        `DELETE FROM ${tableName} WHERE data->>$1 = $2 RETURNING id`,
        [field, String(value)]
      );
      return { deletedCount: rows.length };
    },

    async deleteMany(filter = {}) {
      return this.deleteOne(filter);
    },

    uniqueField,
  };
}

export async function getDb() {
  return getSql();
}

export async function getCollections() {
  return {
    labs: createCollection("labs", "email"),
    patients: createCollection("patients", "id"),
    advancePayments: createCollection("advance_payments", "id"),
    pendingPayments: createCollection("pending_payments", "id"),
    reports: createCollection("reports", "reportNumber"),
  };
}

export async function ensureDatabaseIndexes() {
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

  await Promise.all([
    sql`CREATE UNIQUE INDEX IF NOT EXISTS labs_email_idx ON labs ((data->>'email'))`,
    sql`CREATE UNIQUE INDEX IF NOT EXISTS patients_public_id_idx ON patients ((data->>'id'))`,
    sql`CREATE UNIQUE INDEX IF NOT EXISTS advance_payments_public_id_idx ON advance_payments ((data->>'id'))`,
    sql`CREATE UNIQUE INDEX IF NOT EXISTS pending_payments_public_id_idx ON pending_payments ((data->>'id'))`,
    sql`CREATE INDEX IF NOT EXISTS reports_patient_id_idx ON reports ((data->>'patientId'))`,
    sql`CREATE INDEX IF NOT EXISTS reports_number_idx ON reports ((data->>'reportNumber'))`,
  ]);
}

export function toObjectId(id) {
  return typeof id === "string" && id.trim() ? id.trim() : null;
}
