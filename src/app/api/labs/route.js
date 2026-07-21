import { NextResponse } from "next/server";
import { ensureDatabaseIndexes, getCollections, toObjectId } from "@/lib/db";

function formatLab(lab) {
  return {
    id: lab._id.toString(),
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

export async function GET() {
  try {
    await ensureDatabaseIndexes();
    const { labs: labsCollection } = await getCollections();
    const dbLabs = await labsCollection.find({}).sort({ createdAt: -1 }).toArray();

    return NextResponse.json({ labs: dbLabs.map(formatLab) });
  } catch (error) {
    console.error("GET /api/labs error:", error);
    return NextResponse.json({ message: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await ensureDatabaseIndexes();
    const { labs: labsCollection } = await getCollections();
    const body = await req.json();
    const name = body.name || body.lab_name;
    const owner = body.owner || body.admin_name || body.owner;
    const email = body.email || body.admin_email;
    const password = body.password;
    const address = body.address || "";
    const phone = body.phone || "";

    if (!name || !email || !password) {
      return NextResponse.json({ message: "Missing required parameters (name, email, password)" }, { status: 400 });
    }

    const existingLab = await labsCollection.findOne({ email });

    if (existingLab) {
      return NextResponse.json({ message: "A laboratory with this email already exists" }, { status: 409 });
    }

    const now = new Date();
    const result = await labsCollection.insertOne({
      name,
      owner: owner || "N/A",
      email,
      password,
      address,
      phone,
      status: "Active",
      createdAt: now,
      updatedAt: now,
    });
    const newLab = await labsCollection.findOne({ _id: result.insertedId });

    return NextResponse.json({
      message: "Laboratory onboarded successfully",
      lab: formatLab(newLab)
    }, { status: 201 });
  } catch (error) {
    console.error("POST /api/labs error:", error);
    return NextResponse.json({ message: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(req) {
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

    const data = {
      ...(status !== undefined && { status }),
      ...(name !== undefined && { name }),
      ...(owner !== undefined && { owner }),
      ...(email !== undefined && { email }),
      ...(password !== undefined && { password }),
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

    return NextResponse.json({
      message: "Laboratory updated successfully",
      lab: formatLab(result)
    });
  } catch (error) {
    console.error("PUT /api/labs error:", error);
    return NextResponse.json({ message: error || "Internal Server Error" }, { status: 500 });
  }
}
