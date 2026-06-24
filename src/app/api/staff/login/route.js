import { NextResponse } from "next/server";

const STAFF_EMAIL = process.env.STAFF_EMAIL || "staff@gmail.com";
const STAFF_PASSWORD = process.env.STAFF_PASSWORD || "staff123";

export async function POST(req) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ message: "Missing email or password" }, { status: 400 });
    }

    if (email !== STAFF_EMAIL || password !== STAFF_PASSWORD) {
      return NextResponse.json({ message: "Invalid staff email or password" }, { status: 401 });
    }

    return NextResponse.json({
      message: "Staff login successful",
      staff: {
        email: STAFF_EMAIL,
        role: "Staff",
      },
    });
  } catch (error) {
    console.error("POST /api/staff/login error:", error);
    return NextResponse.json({ message: error.message || "Internal Server Error" }, { status: 500 });
  }
}
