import { NextResponse } from "next/server";
import { ensureDatabaseIndexes, getCollections } from "@/lib/db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookie from "cookie";

const SESSION_MAX_AGE_SECONDS = 10;

export async function POST(req) {
  try {
    // Check JWT Secret
    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is missing");
      return NextResponse.json(
        {
          success: false,
          message: "Server configuration error",
        },
        { status: 500 }
      );
    }

    // Connect DB
    await ensureDatabaseIndexes();

    const collections = await getCollections();

    if (!collections?.labs) {
      console.error("Labs collection not found");
      return NextResponse.json(
        {
          success: false,
          message: "Database connection failed",
        },
        { status: 500 }
      );
    }

    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        {
          success: false,
          message: "Email and password are required",
        },
        { status: 400 }
      );
    }

    const lab = await collections.labs.findOne({
      email: email.trim().toLowerCase(),
    });

    if (!lab) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid email or password",
        },
        { status: 401 }
      );
    }

    let validPassword = false;

    if (
      lab.password?.startsWith("$2a$") ||
      lab.password?.startsWith("$2b$") ||
      lab.password?.startsWith("$2y$")
    ) {
      validPassword = await bcrypt.compare(password, lab.password);
    } else {
      validPassword = lab.password === password;
    }

    if (!validPassword) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid email or password",
        },
        { status: 401 }
      );
    }

    if (lab.status !== "Active") {
      return NextResponse.json(
        {
          success: false,
          message: "Laboratory is not active",
        },
        { status: 403 }
      );
    }

    const token = jwt.sign(
      {
        id: lab._id.toString(),
        labId: lab.labId,
        email: lab.email,
        role: "lab_admin",
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d",
      }
    );

    await collections.labs.updateOne(
      { _id: lab._id },
      {
        $set: {
          token,
          lastLogin: new Date(),
        },
      }
    );

    const response = NextResponse.json({
      success: true,
      lab: {
        id: lab._id.toString(),
        labId: lab.labId,
        name: lab.name,
        email: lab.email,
        owner: lab.owner,
        status: lab.status,
        branding: lab.branding,
        address: lab.address,
        phone: lab.phone,
        role: "lab_admin",
      },
    });

    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

    return response;
  } catch (error) {
    console.error("========== LOGIN API ERROR ==========");
    console.error(error);
    console.error(error.stack);

    return NextResponse.json(
      {
        success: false,
        message: error.message,
      },
      { status: 500 }
    );
  }
}
