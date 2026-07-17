import { NextResponse } from "next/server";

export async function POST() {
  try {
    const response = NextResponse.json({ success: true });
    response.cookies.set("super_admin_token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch (error) {
    console.error("Super admin logout error:", error);
    return NextResponse.json({ success: false, message: "Logout failed" }, { status: 500 });
  }
}
