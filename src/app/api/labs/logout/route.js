import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const res = NextResponse.json({ success: true });

    res.cookies.set("token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return res;
  } catch (err) {
    console.error("POST /api/labs/logout error:", err);
    return NextResponse.json({ success: false, message: "Logout failed" }, { status: 500 });
  }
}
