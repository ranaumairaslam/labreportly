import { NextResponse } from "next/server";
import { ensureDatabaseIndexes, getCollections } from "@/lib/db";
import jwt from "jsonwebtoken";

const STAFF_EMAIL = process.env.STAFF_EMAIL || "staff@gmail.com";
const STAFF_PASSWORD = process.env.STAFF_PASSWORD || "staff123";

export async function POST(req) {
  try {
    await ensureDatabaseIndexes();
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ message: "Missing email or password" }, { status: 400 });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is missing in .env.local");
    }

    const { staffAccounts } = await getCollections();
    const staff = await staffAccounts.findOne({ email, password });

    let staffUser = null;

    if (staff) {
      staffUser = {
        id: staff._id.toString(),
        name: staff.name || "Staff Member",
        email: staff.email,
        labId: staff.labId || null,
        role: staff.role || "Staff",
        canCreateStaff: staff.canCreateStaff === true,
      };
    } else if (email === STAFF_EMAIL && password === STAFF_PASSWORD) {
      staffUser = {
        id: "default-staff",
        name: "Staff Member",
        email: STAFF_EMAIL,
        role: "Staff",
        canCreateStaff: false,
      };
    }

    if (staffUser) {
      // Generate JWT for staff
      const token = jwt.sign(
        {
          id: staffUser.id,
          email: staffUser.email,
          role: "staff"
        },
        process.env.JWT_SECRET,
        {
          expiresIn: "7d"
        }
      );

      const response = NextResponse.json({
        message: "Staff login successful",
        staff: staffUser,
      }, {
        status: 200
      });

      // Save JWT in cookie
      response.cookies.set(
        "token",
        token,
        {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 24 * 7
        }
      );

      return response;
    }

    return NextResponse.json({ message: "Invalid staff email or password" }, { status: 401 });
  } catch (error) {
    console.error("POST /api/staff/login error:", error);
    return NextResponse.json({ message: error.message || "Internal Server Error" }, { status: 500 });
  }
}
