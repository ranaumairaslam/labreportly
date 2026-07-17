import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { ensureDatabaseIndexes, getCollections, toObjectId } from "@/lib/db";

const ADMIN_TOKEN = process.env.SUPER_ADMIN_TOKEN || "super_admin_demo_token";

function unauthorized() {
  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}

function normalizeEmail(email) {
  return (email || "").trim().toLowerCase();
}

async function hashPassword(password) {
  if (!password) return "";
  if (password.startsWith("$2a$") || password.startsWith("$2b$") || password.startsWith("$2y$")) {
    return password;
  }
  return bcrypt.hash(password, 10);
}

// Sequential IDs like LAB-0001, LAB-0002, ...
async function getNextLabId(collections) {
  if (!collections.counters) {
    throw new Error("counters collection is not registered in getCollections()");
  }
  const result = await collections.counters.findOneAndUpdate(
    { _id: "labId" },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" }
  );
  // Driver-version safe: some driver versions return the doc directly,
  // others wrap it in { value }.
  const seq = result?.value?.seq ?? result?.seq;
  return "LAB-" + String(seq).padStart(4, "0");
}

function formatLab(lab) {
  return {
    id: lab._id.toString(),
    labId: lab.labId || null,
    name: lab.name,
    owner: lab.owner || "N/A",
    email: lab.email,
    status: lab.status,
    branding: lab.branding || null,
    address: lab.address || "",
    phone: lab.phone || "",
    date: new Date(lab.createdAt).toISOString().split("T")[0],
  };
}

function getToken(req) {
  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice(7).trim();
}

export async function GET(req) {
  const token = getToken(req);
  if (token !== ADMIN_TOKEN) return unauthorized();

  try {
    await ensureDatabaseIndexes();
    const { labs: labsCollection } = await getCollections();
    const dbLabs = await labsCollection.find({}).sort({ createdAt: -1 }).toArray();

    return NextResponse.json({ labs: dbLabs.map(formatLab) });
  } catch (error) {
    console.error("GET /api/admin/labs error:", error);
    return NextResponse.json({ message: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req) {
  const token = getToken(req);
  if (token !== ADMIN_TOKEN) return unauthorized();

  try {
    await ensureDatabaseIndexes();
    const collections = await getCollections();
    const { labs: labsCollection } = collections;
    const body = await req.json();
    const { name, owner, email, password, status } = body || {};

    if (!name || !email || !password) {
      return NextResponse.json({ message: "Missing required parameters (name, email, password)" }, { status: 400 });
    }

    const normalizedEmail = normalizeEmail(email);
    const hashedPassword = await hashPassword(password);
    const existingLab = await labsCollection.findOne({ email: normalizedEmail });
    if (existingLab) {
      return NextResponse.json({ message: "A laboratory with this email already exists" }, { status: 409 });
    }

    const labId = await getNextLabId(collections);
    const now = new Date();
    const result = await labsCollection.insertOne({
      labId,
      name,
      owner: owner || "N/A",
      email: normalizedEmail,
      password: hashedPassword,
      status: status || "Active",
      createdAt: now,
      updatedAt: now,
    });

    const newLab = await labsCollection.findOne({ _id: result.insertedId });
    return NextResponse.json({ message: "Laboratory onboarded successfully", lab: formatLab(newLab) }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/labs error:", error);
    return NextResponse.json({ message: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(req) {
  const token = getToken(req);
  if (token !== ADMIN_TOKEN) return unauthorized();

  try {
    await ensureDatabaseIndexes();
    const { labs: labsCollection } = await getCollections();
    const body = await req.json();
    const { id, status, name, owner, email, password, branding, address, phone } = body || {};

    if (!id) {
      return NextResponse.json({ message: "Missing laboratory ID" }, { status: 400 });
    }

    const _id = toObjectId(id);
    if (!_id) {
      return NextResponse.json({ message: "Invalid laboratory ID" }, { status: 400 });
    }

    const normalizedEmail = email !== undefined ? normalizeEmail(email) : undefined;
    const hashedPassword = password !== undefined ? await hashPassword(password) : undefined;

    if (normalizedEmail) {
      const existingLab = await labsCollection.findOne({ email: normalizedEmail, _id: { $ne: _id } });
      if (existingLab) {
        return NextResponse.json({ message: "A laboratory with this email already exists" }, { status: 409 });
      }
    }

    // labId is intentionally NOT editable here — it's assigned once at creation
    // and should stay stable for the life of the lab.
    const data = {
      ...(status !== undefined && { status }),
      ...(name !== undefined && { name }),
      ...(owner !== undefined && { owner }),
      ...(normalizedEmail !== undefined && { email: normalizedEmail }),
      ...(hashedPassword !== undefined && { password: hashedPassword }),
      ...(branding !== undefined && { branding }),
      ...(address !== undefined && { address }),
      ...(phone !== undefined && { phone }),
      updatedAt: new Date(),
    };

    const result = await labsCollection.findOneAndUpdate(
      { _id },
      { $set: data },
      { returnDocument: "after" }
    );

    if (!result) {
      return NextResponse.json({ message: "Laboratory not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Laboratory updated successfully", lab: formatLab(result) });
  } catch (error) {
    console.error("PUT /api/admin/labs error:", error);
    return NextResponse.json({ message: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req) {
  const token = getToken(req);
  if (token !== ADMIN_TOKEN) return unauthorized();

  try {
    await ensureDatabaseIndexes();
    const { labs: labsCollection, staffAccounts } = await getCollections();
    const body = await req.json().catch(() => ({}));
    const { id } = body || {};

    if (!id) {
      return NextResponse.json({ message: "Missing laboratory ID" }, { status: 400 });
    }

    const _id = toObjectId(id);
    if (!_id) {
      return NextResponse.json({ message: "Invalid laboratory ID" }, { status: 400 });
    }

    const deleteLabResult = await labsCollection.deleteOne({ _id });
    if ((deleteLabResult.deletedCount || 0) === 0) {
      return NextResponse.json({ message: "Laboratory not found" }, { status: 404 });
    }

    await staffAccounts.deleteMany({ labId: id });

    return NextResponse.json({ message: "Laboratory deleted successfully" });
  } catch (error) {
    console.error("DELETE /api/admin/labs error:", error);
    return NextResponse.json({ message: error.message || "Internal Server Error" }, { status: 500 });
  }
}