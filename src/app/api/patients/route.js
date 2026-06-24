import { NextResponse } from "next/server";
import { ensureDatabaseIndexes, getCollections } from "@/lib/db";

function cleanDocument(document) {
  const { _id, createdAt, updatedAt, ...rest } = document;
  return rest;
}

export async function GET() {
  try {
    await ensureDatabaseIndexes();
    const collections = await getCollections();

    const [patients, advancePayments, pendingPayments] = await Promise.all([
      collections.patients.find({}).sort({ createdAt: 1 }).toArray(),
      collections.advancePayments.find({}).sort({ createdAt: 1 }).toArray(),
      collections.pendingPayments.find({}).sort({ createdAt: 1 }).toArray(),
    ]);

    return NextResponse.json({
      patients: patients.map(cleanDocument),
      advancePayments: advancePayments.map(cleanDocument),
      pendingPayments: pendingPayments.map(cleanDocument),
    });
  } catch (error) {
    console.error("GET /api/patients error:", error);
    return NextResponse.json({ message: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req) {
  const body = await req.json();
  const { patient, advancePayment, pendingPayment } = body || {};

  if (!patient || !patient.id) {
    return NextResponse.json({ message: "Missing patient data" }, { status: 400 });
  }

  try {
    await ensureDatabaseIndexes();
    const collections = await getCollections();

    const existingPatient = await collections.patients.findOne({ id: patient.id });
    if (existingPatient) {
      return NextResponse.json({ message: "A patient with this ID already exists" }, { status: 409 });
    }

    const now = new Date();
    await collections.patients.insertOne({
      ...patient,
      createdAt: now,
      updatedAt: now,
    });

    if (advancePayment?.id) {
      await collections.advancePayments.insertOne({
        ...advancePayment,
        createdAt: now,
        updatedAt: now,
      });
    }

    if (pendingPayment?.id) {
      await collections.pendingPayments.insertOne({
        ...pendingPayment,
        createdAt: now,
        updatedAt: now,
      });
    }

    return NextResponse.json({ message: "Patient added", patient }, { status: 201 });
  } catch (e) {
    console.error("POST /api/patients error:", e);
    if (e.message?.includes("database is not configured")) {
      return NextResponse.json({
        message: "Patient added in demo mode. Add DATABASE_URL to save to Neon.",
        patient,
        advancePayment,
        pendingPayment,
        databaseConnected: false,
      }, { status: 201 });
    }

    return NextResponse.json({ message: e.message || "Bad request" }, { status: 400 });
  }
}

export async function PUT(req) {
  try {
    await ensureDatabaseIndexes();
    const collections = await getCollections();
    const body = await req.json();
    const { id, pendingPaymentId, advancePayment, reportSummary, ...updates } = body || {};

    if (!id) {
      return NextResponse.json({ message: "Missing patient ID" }, { status: 400 });
    }

    const updateOps = {
      $set: { ...updates, updatedAt: new Date() },
    };

    if (reportSummary) {
      updateOps.$push = { reports: reportSummary };
    }

    const result = await collections.patients.findOneAndUpdate(
      { id },
      updateOps,
      { returnDocument: "after" }
    );

    const updatedPatient = result?.value || result;

    if (!updatedPatient) {
      return NextResponse.json({ message: "Patient not found" }, { status: 404 });
    }

    let pendingDeleted = 0;
    if (pendingPaymentId) {
      const delRes = await collections.pendingPayments.deleteOne({ id: pendingPaymentId });
      pendingDeleted = delRes.deletedCount || 0;
    }

    let advanceUpserted = false;
    if (advancePayment?.id) {
      const updRes = await collections.advancePayments.updateOne(
        { id: advancePayment.id },
        {
          $set: {
            ...advancePayment,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        { upsert: true }
      );
      advanceUpserted = Boolean(updRes?.upsertedId);
    }

    return NextResponse.json({
      message: "Patient updated",
      patient: cleanDocument(updatedPatient),
      paymentUpdate: {
        pendingPaymentId: pendingPaymentId || null,
        pendingDeleted,
        advancePaymentId: advancePayment?.id || null,
        advanceUpserted,
      },
    });
  } catch (e) {
    console.error("PUT /api/patients error:", e);
    return NextResponse.json({ message: e.message || "Bad request" }, { status: 400 });
  }
}

export async function DELETE(req) {
  try {
    await ensureDatabaseIndexes();
    const { patients, advancePayments, pendingPayments } = await getCollections();
    const url = new URL(req.url);
    const patientId = url.searchParams.get("id");

    if (!patientId) {
      return NextResponse.json({ message: "Missing patient ID" }, { status: 400 });
    }

    const result = await patients.deleteOne({ id: patientId });
    if (result.deletedCount === 0) {
      return NextResponse.json({ message: "Patient not found" }, { status: 404 });
    }

    await Promise.all([
      advancePayments.deleteMany({ patientId }),
      pendingPayments.deleteMany({ patientId }),
    ]);

    return NextResponse.json({ message: "Patient deleted successfully" });
  } catch (error) {
    console.error("DELETE /api/patients error:", error);
    return NextResponse.json({ message: error.message || "Internal Server Error" }, { status: 500 });
  }
}
