import { NextResponse } from "next/server";


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

    const response = NextResponse.json({ token: ADMIN_TOKEN });

    // Save super-admin token in cookie
    response.cookies.set(
      "super_admin_token",
      ADMIN_TOKEN,
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7
      }
    );

    return response;
  } catch (e) {
    return NextResponse.json(
      { message: "Bad request" },
      { status: 400 }
    );
  }
}

