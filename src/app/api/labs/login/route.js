import { NextResponse } from "next/server";
import { ensureDatabaseIndexes, getCollections } from "@/lib/db";

export async function POST(req) {
  try {
    await ensureDatabaseIndexes();
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ message: "Missing email or password" }, { status: 400 });
    }

    const { labs } = await getCollections();
    const lab = await labs.findOne({ email });

    if (!lab || lab.password !== password) {
      return NextResponse.json({ message: "Invalid email or password" }, { status: 401 });
    }

    if (lab.status !== "Active") {
      return NextResponse.json({ message: "Laboratory is not active", status: "Inactive" }, { status: 403 });
    }

    return NextResponse.json({
      message: "Login successful",
      lab: {
        id: lab._id.toString(),
        name: lab.name,
        email: lab.email,
        owner: lab.owner || "N/A",
        status: lab.status,
      },
    });
  } catch (error) {
    console.error("POST /api/labs/login error:", error);
    return NextResponse.json({ message: error.message || "Internal Server Error" }, { status: 500 });
  }
}
