import { MongoClient, ObjectId } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "al-jannat";

const globalForMongo = globalThis;

function getClientPromise() {
  if (!uri) {
    throw new Error("MongoDB is not configured. Add MONGODB_URI to .env.local.");
  }

  if (!globalForMongo.mongoClientPromise) {
    const client = new MongoClient(uri);
    globalForMongo.mongoClientPromise = client.connect();
  }

  return globalForMongo.mongoClientPromise;
}

export async function getDb() {
  const client = await getClientPromise();
  return client.db(dbName);
}

export async function getCollections() {
  const db = await getDb();

  return {
    labs: db.collection("labs"),
    patients: db.collection("patients"),
    advancePayments: db.collection("advance_payments"),
    pendingPayments: db.collection("pending_payments"),
    reports: db.collection("reports"),
  };
}

export async function ensureDatabaseIndexes() {
  const { labs, patients, advancePayments, pendingPayments, reports } = await getCollections();

  await Promise.all([
    labs.createIndex({ email: 1 }, { unique: true }),
    patients.createIndex({ id: 1 }, { unique: true }),
    advancePayments.createIndex({ id: 1 }, { unique: true }),
    pendingPayments.createIndex({ id: 1 }, { unique: true }),
    reports.createIndex({ patientId: 1 }),
    reports.createIndex({ reportNumber: 1 }),
  ]);
}

export function toObjectId(id) {
  if (!ObjectId.isValid(id)) {
    return null;
  }

  return new ObjectId(id);
}
