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
    // Extract and log the endpoint (safely without password)
    try {
      const url = new URL(databaseUrl);
      const endpoint = url.hostname;
      console.log(`[DB] Connecting to database endpoint: ${endpoint}`);
    } catch (e) {
      console.log("[DB] Could not parse database URL");
    }
    
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
  // Support Mongo-like nested $set/$setOnInsert structures is handled by caller.
  // Here we only translate simple filters.
  const entries = Object.entries(filter).filter(([, value]) => value !== undefined);

  if (!entries.length) {
    return { query: "", values: [] };
  }

  const clauses = [];
  const values = [];
  let paramIndex = 1;

  entries.forEach(([field, value]) => {
    if (field === "_id") {
      // Only use id column if value looks like a UUID (contains hyphens or is 36+ chars)
      if (typeof value === "string" && (value.includes("-") || value.length > 20)) {
        clauses.push(`id = $${paramIndex}`);
        values.push(value);
      } else {
        // For non-UUID _id values (like "labId"), search in data field
        clauses.push(`data->>'_id' = $${paramIndex}`);
        values.push(String(value));
      }
      paramIndex++;
      return;
    }

    // Use field name as a literal string, not a parameter
    clauses.push(`data->>'${field}' = $${paramIndex}`);
    values.push(String(value));
    paramIndex++;
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

  const finalQuery = `SELECT id AS _id, data, created_at, updated_at FROM ${tableName}${whereClause} ORDER BY ${orderBy} ${sortDirection}`;
  
  const startTime = Date.now();
  const rows = await sql.query(finalQuery, values);
  const duration = Date.now() - startTime;
  
  if (duration > 500) {
    console.warn(`[DB SLOW QUERY] ${tableName} (${duration}ms):`, finalQuery);
  }

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
      const finalQuery = `SELECT id AS _id, data, created_at, updated_at FROM ${tableName}${whereClause} LIMIT 1`;
      
      const startTime = Date.now();
      const rows = await sql.query(finalQuery, values);
      const duration = Date.now() - startTime;
      
      if (duration > 500) {
        console.warn(`[DB SLOW QUERY] ${tableName}.findOne (${duration}ms):`, finalQuery);
      }
      
      return normalizeDocument(rows[0]);
    },

    async insertOne(document) {
      const sql = getSql();
      const createdAt = document.createdAt || new Date();
      const updatedAt = document.updatedAt || createdAt;
      
      const startTime = Date.now();
      const rows = await sql.query(
        `INSERT INTO ${tableName} (data, created_at, updated_at) VALUES ($1::jsonb, $2, $3) RETURNING id`,
        [JSON.stringify(document), createdAt, updatedAt]
      );
      const duration = Date.now() - startTime;
      
      if (duration > 500) {
        console.warn(`[DB SLOW QUERY] ${tableName}.insertOne (${duration}ms)`);
      }
      
      return { insertedId: rows[0]?.id };
    },

    async insertMany(documents) {
      if (documents.length === 0) {
        return { insertedCount: 0, insertedIds: [] };
      }
      
      const sql = getSql();
      const now = new Date();
      
      // Batch insert: convert to single query with multiple value sets
      const placeholders = documents.map((_, idx) => {
        const dataIdx = idx * 3 + 1;
        const createdIdx = idx * 3 + 2;
        const updatedIdx = idx * 3 + 3;
        return `($${dataIdx}::jsonb, $${createdIdx}, $${updatedIdx})`;
      }).join(", ");
      
      const values = [];
      documents.forEach(doc => {
        const createdAt = doc.createdAt || now;
        const updatedAt = doc.updatedAt || createdAt;
        values.push(JSON.stringify(doc), createdAt, updatedAt);
      });
      
      const query = `INSERT INTO ${tableName} (data, created_at, updated_at) VALUES ${placeholders} RETURNING id`;
      const rows = await sql.query(query, values);
      
      return { insertedCount: rows.length, insertedIds: rows.map(r => r.id) };
    },

    async findOneAndUpdate(filter, update = {}, options = {}) {
      const sql = getSql();
      const current = await this.findOne(filter);
      
      if (!current) {
        // If upsert is true and no document found, create a new one
        if (options.upsert) {
          // Merge filter with update.$inc to create new document
          const newDoc = { ...filter };
          if (update.$inc) {
            Object.entries(update.$inc).forEach(([field, value]) => {
              newDoc[field] = value;
            });
          }
          if (update.$set) {
            Object.assign(newDoc, update.$set);
          }
          const result = await this.insertOne(newDoc);
          // Return the newly created document if returnDocument is "after"
          if (options.returnDocument === "after") {
            const inserted = await this.findOne({ _id: result.insertedId });
            return { value: inserted };
          }
          return { value: newDoc };
        }
        return null;
      }

      const nextData = {
        ...current,
        ...(update.$set || {}),
        ...(update.$setOnInsert || {}),
      };
      
      // Handle $inc operations (increment fields)

      if (update.$inc) {
        Object.entries(update.$inc).forEach(([field, value]) => {
          nextData[field] = (nextData[field] || 0) + value;
        });
      }
      
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
    // Mongo-like collections expected by API route handlers
    labs: createCollection("labs"),
    patients: createCollection("patients"),
    advancePayments: createCollection("advance_payments"),
    pendingPayments: createCollection("pending_payments"),
    reports: createCollection("reports"),
    staffAccounts: createCollection("staff_accounts"),
    // Used by /api/admin/labs for sequential LAB-0001, LAB-0002...
    counters: createCollection("counters"),
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

    await sql`
      CREATE TABLE IF NOT EXISTS counters (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        data jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `;

    // Create specific column indexes for common queries
    await Promise.all([
      sql`CREATE UNIQUE INDEX IF NOT EXISTS labs_email_idx ON labs ((data->>'email'))`,
      sql`CREATE UNIQUE INDEX IF NOT EXISTS patients_public_id_idx ON patients ((data->>'id'))`,
      sql`CREATE UNIQUE INDEX IF NOT EXISTS advance_payments_public_id_idx ON advance_payments ((data->>'id'))`,
      sql`CREATE UNIQUE INDEX IF NOT EXISTS pending_payments_public_id_idx ON pending_payments ((data->>'id'))`,
      sql`CREATE INDEX IF NOT EXISTS reports_patient_id_idx ON reports ((data->>'patientId'))`,
      sql`CREATE INDEX IF NOT EXISTS reports_number_idx ON reports ((data->>'reportNumber'))`,
      sql`CREATE UNIQUE INDEX IF NOT EXISTS staff_accounts_lab_email_idx ON staff_accounts ((data->>'labId'), (data->>'email'))`,
      sql`CREATE INDEX IF NOT EXISTS staff_accounts_lab_id_idx ON staff_accounts ((data->>'labId'))`,
      // GIN indexes for general JSONB queries (faster for complex filters)
      sql`CREATE INDEX IF NOT EXISTS labs_data_gin_idx ON labs USING GIN(data)`,
      sql`CREATE INDEX IF NOT EXISTS patients_data_gin_idx ON patients USING GIN(data)`,
      sql`CREATE INDEX IF NOT EXISTS staff_accounts_data_gin_idx ON staff_accounts USING GIN(data)`,
      sql`CREATE INDEX IF NOT EXISTS counters_data_gin_idx ON counters USING GIN(data)`,
    ]);
  })();

  return globalForDb.dbInitPromise;
}

export function toObjectId(id) {
  // This project stores UUID ids as plain strings in Postgres.
  // Many API routes pass `id` coming from the frontend.
  // Treat any non-empty string as valid.
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

