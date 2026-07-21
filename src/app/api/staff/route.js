import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { ensureDatabaseIndexes, getCollections } from "@/lib/db";

function getAuthenticatedLabId(req) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "dev-lab-secret");
    return decoded?.labId || decoded?.id || null;
  } catch (error) {
    return null;
  }
}

function normalizeEmail(email) {
  return (email || "").trim().toLowerCase();
}

export async function POST(req) {
  try {
    await ensureDatabaseIndexes();
    const body = await req.json();
    const authLabId = getAuthenticatedLabId(req);
    const scopeLabId = authLabId || body.labId?.trim() || null;
    const { staffAccounts } = await getCollections();
    const name = body.name?.trim();
    const email = normalizeEmail(body.email);
    const password = body.password;
    const labId = scopeLabId || body.labId?.trim();
    const role = body.role?.trim() || "Staff";
    const requesterRole = body.requesterRole?.trim();

    if (!name || !email || !password || !labId) {
      return NextResponse.json({ message: "Name, email, password, and lab reference are required" }, { status: 400 });
    }

    if (requesterRole !== "Admin" && requesterRole !== "LabAdmin") {
      return NextResponse.json({ message: "Only the lab admin can create staff accounts" }, { status: 403 });
    }

    const existingStaff = await staffAccounts.findOne({ labId, email });
    if (existingStaff) {
      return NextResponse.json({ message: "A staff account with this email already exists for this lab" }, { status: 409 });
    }

    const now = new Date();
    const result = await staffAccounts.insertOne({
      name,
      email,
      password,
      labId,
      role,
      createdBy: "lab-admin",
      canCreateStaff: false,
      createdAt: now,
      updatedAt: now,
    });
    const created = await staffAccounts.findOne({ _id: result.insertedId });

    return NextResponse.json({
      message: "Staff account created successfully",
      staff: {
        id: created._id.toString(),
        name: created.name,
        email: created.email,
        labId: created.labId,
        role: created.role,
        canCreateStaff: created.canCreateStaff === true,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("POST /api/staff error:", error);
    return NextResponse.json({ message: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(req) {
  try {
    await ensureDatabaseIndexes();
    const { searchParams } = new URL(req.url);
    const requestedLabId = searchParams.get("labId")?.trim();
    const authLabId = getAuthenticatedLabId(req);
    const scopeLabId = authLabId || requestedLabId || null;

    if (!scopeLabId) {
      return NextResponse.json({ staff: [] });
    }

    const { staffAccounts } = await getCollections();
    const filter = scopeLabId ? { labId: scopeLabId } : {};
    const accounts = await staffAccounts.find(filter).sort({ createdAt: -1 }).toArray();

    return NextResponse.json({ staff: accounts.map((account) => ({
      id: account._id.toString(),
      name: account.name,
      email: account.email,
      labId: account.labId,
      role: account.role,
      canCreateStaff: account.canCreateStaff === true,
      createdAt: account.createdAt,
    })) });
  } catch (error) {
    console.error("GET /api/staff error:", error);
    return NextResponse.json({ message: error.message || "Internal Server Error" }, { status: 500 });
  }
}
