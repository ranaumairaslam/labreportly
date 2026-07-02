import { NextResponse } from "next/server";
import { ensureDatabaseIndexes, getCollections } from "@/lib/db";

const STAFF_EMAIL = process.env.STAFF_EMAIL || "staff@gmail.com";
const STAFF_PASSWORD = process.env.STAFF_PASSWORD || "staff123";

export async function POST(req) {
  try {
    await ensureDatabaseIndexes();
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ message: "Missing email or password" }, { status: 400 });
    }

    const { staffAccounts } = await getCollections();
    const staff = await staffAccounts.findOne({ email, password });

    if (staff) {
      return NextResponse.json({
        message: "Staff login successful",
        staff: {
          id: staff._id.toString(),
          name: staff.name || "Staff Member",
          email: staff.email,
          labId: staff.labId || null,
          role: staff.role || "Staff",
          canCreateStaff: staff.canCreateStaff === true,
        },
      });
    }

    if (email === STAFF_EMAIL && password === STAFF_PASSWORD) {
      return NextResponse.json({
        message: "Staff login successful",
        staff: {
          email: STAFF_EMAIL,
          role: "Staff",
          canCreateStaff: false,
        },
      });
    }

    return NextResponse.json({ message: "Invalid staff email or password" }, { status: 401 });
  } catch (error) {
    console.error("POST /api/staff/login error:", error);
    return NextResponse.json({ message: error.message || "Internal Server Error" }, { status: 500 });
  }
}
