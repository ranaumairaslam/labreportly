import { NextResponse } from "next/server";
import { ensureDatabaseIndexes, getCollections } from "@/lib/db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookie from "cookie";

export async function POST(req) {
  try {
    await ensureDatabaseIndexes();
    const body = await req.json();
    console.log("POST /api/labs/login called:", body);

    const { email, password } = body;
    if (!email || !password) {
      return NextResponse.json({ message: "Missing email or password" }, { status: 400 });
    }

    const collections = await getCollections();
    if (!collections || !collections.labs) {
      console.error("Labs collection not found.");
      return NextResponse.json({ message: "Database connection failed." }, { status: 500 });
    }

    const { labs } = collections;
    const lab = await labs.findOne({ email });
    if (!lab) return NextResponse.json({ message: "Invalid email or password" }, { status: 401 });

    const storedPassword = lab.password ?? "";
    let isPasswordCorrect = false;
    if (storedPassword.startsWith("$2a$") || storedPassword.startsWith("$2b$") || storedPassword.startsWith("$2y$")) {
      isPasswordCorrect = await bcrypt.compare(password, storedPassword);
    } else {
      isPasswordCorrect = storedPassword === password;
    }

    if (!isPasswordCorrect) return NextResponse.json({ message: "Invalid email or password" }, { status: 401 });

    if (lab.status !== "Active") {
      return NextResponse.json({ message: "Laboratory is not active.", status: "Inactive" }, { status: 403 });
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is missing in .env.local");
      return NextResponse.json({ message: "Server configuration error." }, { status: 500 });
    }

    const token = jwt.sign({ id: lab._id, email: lab.email, role: "lab_admin" }, process.env.JWT_SECRET, { expiresIn: "7d" });

    await labs.updateOne({ _id: lab._id }, { $set: { token, lastLogin: new Date() } });

    const labData = {
      id: lab._id.toString(),
      name: lab.name,
      email: lab.email,
      owner: lab.owner || "",
      status: lab.status,
      branding: lab.branding || null,
      address: lab.address || "",
      phone: lab.phone || "",
    };

    const res = NextResponse.json({ success: true, lab: labData });
    // Set an HttpOnly cookie so client-side code cannot modify it directly
    res.headers.set(
      "Set-Cookie",
      cookie.serialize("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge:   15 * 60, // 1 day
      })
    );

    return res;
  } catch (error) {
    console.error("POST /api/labs/login error:", error);
    return NextResponse.json(
      { success: false, message: "Internal Server Error", error: process.env.NODE_ENV === "development" ? error.message : undefined },
      { status: 500 }
    );
  }
}