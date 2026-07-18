import { NextResponse } from "next/server";
import { ensureDatabaseIndexes, getCollections } from "@/lib/db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookie from "cookie";

const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days, matches JWT expiresIn

export async function POST(req) {
  try {
    await ensureDatabaseIndexes();
    const body = await req.json();

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
    const lab = await labs.findOne({ email: email.trim().toLowerCase() });
    if (!lab) {
      return NextResponse.json({ message: "Invalid email or password" }, { status: 401 });
    }

    const storedPassword = lab.password ?? "";
    let isPasswordCorrect = false;
    if (
      storedPassword.startsWith("$2a$") ||
      storedPassword.startsWith("$2b$") ||
      storedPassword.startsWith("$2y$")
    ) {
      isPasswordCorrect = await bcrypt.compare(password, storedPassword);
    } else {
      isPasswordCorrect = storedPassword === password;
    }

    if (!isPasswordCorrect) {
      return NextResponse.json({ message: "Invalid email or password" }, { status: 401 });
    }

    if (lab.status !== "Active") {
      return NextResponse.json(
        { message: "Laboratory is not active.", status: "Inactive" },
        { status: 403 }
      );
    }

    // if (!process.env.JWT_SECRET) {
    //   console.error("JWT_SECRET is missing in .env.local");
    //   return NextResponse.json({ message: "Server configuration error." }, { status: 500 });
    // }

    const role = "lab_admin"; // labs collection = the lab_admin account itself

    const token = jwt.sign(
      { id: lab._id, labId: lab.labId, email: lab.email, role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    await labs.updateOne({ _id: lab._id }, { $set: { token, lastLogin: new Date() } });

    const labData = {
      id: lab._id.toString(),
      labId: lab.labId || null,
      name: lab.name,
      email: lab.email,
      owner: lab.owner || "",
      status: lab.status,
      branding: lab.branding || null,
      address: lab.address || "",
      phone: lab.phone || "",
      role, // <-- frontend uses this to decide where to redirect
    };

    const res = NextResponse.json({ success: true, lab: labData });

    res.headers.set(
      "Set-Cookie",
      cookie.serialize("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: SESSION_MAX_AGE_SECONDS,
      })
    );

    return res;
  } catch (error) {
    console.error("POST /api/labs/login error:", error);
    
    // Provide more helpful error messages
    let errorMessage = "Internal Server Error";
    if (error?.message?.includes("ENOTFOUND")) {
      errorMessage = "Database connection failed - unable to reach the database server";
    } else if (error?.message?.includes("connect")) {
      errorMessage = "Database connection error - please check the database configuration";
    } else if (error?.message?.includes("authentication")) {
      errorMessage = "Database authentication failed - invalid credentials";
    }
    
    return NextResponse.json(
      {
        success: false,
        message: errorMessage,
        error: process.env.NODE_ENV === "development" ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}