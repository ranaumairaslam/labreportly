import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { ensureDatabaseIndexes, getCollections } from "@/lib/db";

function cleanDocument(document) {
  const { _id, createdAt, updatedAt, ...rest } = document;
  return {
    id: String(_id),
    ...rest,
  };
}

function getAuthenticatedLabId(req) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "dev-lab-secret");
    return decoded?.labId || decoded?.id || null;
  } catch (error) {
    return null;
  }
}

export async function GET(req) {
  try {
    await ensureDatabaseIndexes();
    const url = new URL(req.url);
    const reportNumber = url.searchParams.get("reportNumber");
    const requestedLabId = url.searchParams.get("labId")?.trim();
    const authLabId = getAuthenticatedLabId(req);
    const scopeLabId = authLabId || requestedLabId || null;
    const { reports } = await getCollections(scopeLabId);

    if (!reportNumber && !scopeLabId) {
      return NextResponse.json({ reports: [] });
    }

    const filter = {};
    if (reportNumber) filter.reportNumber = reportNumber;
    if (scopeLabId) filter.labId = scopeLabId;

    const docs = await reports.find(filter).sort({ createdAt: -1 }).toArray();
    return NextResponse.json({ reports: docs.map(cleanDocument) });
  } catch (error) {
    console.error("GET /api/reports error:", error);
    return NextResponse.json({ message: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    await ensureDatabaseIndexes();
    const { reports } = await getCollections();
    const url = new URL(req.url);
    const reportNumber = url.searchParams.get("reportNumber");

    if (!reportNumber) {
      return NextResponse.json({ message: "Missing reportNumber" }, { status: 400 });
    }

    const result = await reports.deleteOne({ reportNumber });
    return NextResponse.json(
      { message: "Report deleted", deletedCount: result.deletedCount },
      { status: 200 }
    );
  } catch (error) {
    console.error("DELETE /api/reports error:", error);
    return NextResponse.json(
      { message: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    await ensureDatabaseIndexes();
    const { reports } = await getCollections();
    const body = await req.json();
    const {
      reportNumber,
      patientId,
      patientName,
      patientContact,
      patientAge,
      patientGender,
      totalBill,
      pendingBalance,
      registeredAt,
      labId,
      tests,
      results,
      status,
      findings,
      specialistReferral,
      specimen,
      examRequired,
      categoryTitle,
    } = body || {};

    if (!reportNumber || !patientId || !patientName || findings === undefined || findings === null) {
      return NextResponse.json({ message: "Missing required report fields" }, { status: 400 });
    }

    const now = new Date();
    const storedResults = Array.isArray(results) ? results : (Array.isArray(tests) ? tests : []);
    const scopeLabId = getAuthenticatedLabId(req) || labId || "default-lab";

    const result = await reports.insertOne({
      reportNumber,
      patientId,
      patientName,
      patientContact: patientContact || null,
      patientAge: patientAge || null,
      patientGender: patientGender || null,
      totalBill: totalBill || null,
      pendingBalance: pendingBalance || null,
      registeredAt: registeredAt || null,
      labId: scopeLabId,
      results: storedResults,
      status: status || "Completed",
      findings,
      specialistReferral: specialistReferral || null,
      specimen: specimen || null,
      examRequired: examRequired || null,
      categoryTitle: categoryTitle || null,
      createdAt: now,
      updatedAt: now,
    });

    const newReport = await reports.findOne({ _id: result.insertedId });
    return NextResponse.json({ message: "Report saved", report: cleanDocument(newReport) }, { status: 201 });
  } catch (error) {
    console.error("POST /api/reports error:", error);
    return NextResponse.json({ message: error.message || "Internal Server Error" }, { status: 500 });
  }
}