import { NextResponse } from "next/server";
import { ensureDatabaseIndexes, getCollections } from "@/lib/db";

export async function POST(req) {
  try {
    await ensureDatabaseIndexes();
    const { staffAccounts } = await getCollections();
    const body = await req.json();
    const name = body.name?.trim();
    const email = body.email?.trim().toLowerCase();
    const password = body.password;
    const labId = body.labId?.trim();
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
    const labId = searchParams.get("labId");
    const { staffAccounts } = await getCollections();

    const filter = labId ? { labId } : {};
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
