import { NextResponse } from "next/server";
import { ensureDatabaseIndexes, getCollections } from "@/lib/db";

function cleanDocument(document) {
  const { _id, createdAt, updatedAt, ...rest } = document;
  return rest;
}

export async function GET() {
  try {
    await ensureDatabaseIndexes();
    const { reports } = await getCollections();
    const docs = await reports.find({}).sort({ createdAt: -1 }).toArray();
    return NextResponse.json({ reports: docs.map(cleanDocument) });
  } catch (error) {
    console.error("GET /api/reports error:", error);
    return NextResponse.json({ message: error.message || "Internal Server Error" }, { status: 500 });
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
      status,
      findings,
      specialistReferral,
      specimen,
      examRequired,
      categoryTitle,
    } = body || {};

    if (!reportNumber || !patientId || !patientName || !findings) {
      return NextResponse.json({ message: "Missing required report fields" }, { status: 400 });
    }

    const now = new Date();
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
      labId: labId || "default-lab",
      tests: tests || [],
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
