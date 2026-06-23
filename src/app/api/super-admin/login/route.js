import { NextResponse } from "next/server";

// Simple in-memory demo auth.
// In production, replace with DB + secure password hashing.

export async function POST(req) {
  try {
    const body = await req.json();
    const { email, password } = body || {};

    if (!email || !password) {
      return NextResponse.json(
        { message: "Missing email or password" },
        { status: 400 }
      );
    }

  
    const ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || "admin@gmail.com";
    const ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || "123";
    const ADMIN_TOKEN = process.env.SUPER_ADMIN_TOKEN || "super_admin_demo_token";

    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
      return NextResponse.json(
        { message: "Invalid super-admin credentials" },
        { status: 401 }
      );
    }

    return NextResponse.json({ token: ADMIN_TOKEN });
  } catch (e) {
    return NextResponse.json(
      { message: "Bad request" },
      { status: 400 }
    );
  }
}

