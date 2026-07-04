import { NextResponse } from "next/server";
import { ensureDatabaseIndexes, getCollections } from "@/lib/db";

function cleanDocument(document) {
  const { _id, createdAt, updatedAt, ...rest } = document;
  return {
    id: String(_id),
    ...rest,
  };
}

export async function GET(req) {
  try {
    await ensureDatabaseIndexes();
    const { reports } = await getCollections();
    const url = new URL(req.url);
    const reportNumber = url.searchParams.get("reportNumber");
    const labId = url.searchParams.get("labId");

    if (!reportNumber && !labId) {
      return NextResponse.json({ reports: [] });
    }

    const filter = {};
    if (reportNumber) filter.reportNumber = reportNumber;
    if (labId) filter.labId = labId;

    const docs = await reports.find(filter).sort({ createdAt: -1 }).toArray();
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
      results,
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
    const storedResults = Array.isArray(results) ? results : (Array.isArray(tests) ? tests : []);

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
