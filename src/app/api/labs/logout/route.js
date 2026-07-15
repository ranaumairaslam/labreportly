import { NextResponse } from "next/server";
import { ensureDatabaseIndexes, getCollections } from "@/lib/db";
import cookie from "cookie";

export async function POST(req) {
  try {
    await ensureDatabaseIndexes();
    const collections = await getCollections();
    if (!collections || !collections.labs) {
      return NextResponse.json({ message: "Database error" }, { status: 500 });
    }

    // Read token from cookie
    const token = req.cookies.get("token")?.value;
    if (token) {
      const { labs } = collections;
      // Clear token field for any lab that has this token
      await labs.updateOne({ token }, { $unset: { token: "" } });
    }

    const res = NextResponse.json({ success: true });
    // Clear cookie
    res.headers.set(
      "Set-Cookie",
      cookie.serialize("token", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      })
    );
    return res;
  } catch (err) {
    console.error("POST /api/labs/logout error:", err);
    return NextResponse.json({ success: false, message: "Logout failed" }, { status: 500 });
  }
}
