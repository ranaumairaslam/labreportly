import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { ensureDatabaseIndexes, getCollections } from "@/lib/db";

function cleanDocument(document) {
  const { _id, createdAt, updatedAt, ...rest } = document;
  return rest;
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
    const requestedLabId = url.searchParams.get("labId")?.trim();
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
    const ADMIN_TOKEN = process.env.SUPER_ADMIN_TOKEN || "super_admin_demo_token";
    const authLabId = getAuthenticatedLabId(req);
    const isAdminRequest = Boolean(token && token === ADMIN_TOKEN);
    const scopeLabId = isAdminRequest ? null : (authLabId || requestedLabId || null);
    const collections = await getCollections(scopeLabId);

    let filter = {};
    if (!isAdminRequest && scopeLabId) {
      filter = { labId: scopeLabId };
    }

    const [patients, advancePayments, pendingPayments] = await Promise.all([
      collections.patients.find(filter).sort({ createdAt: 1 }).toArray(),
      collections.advancePayments.find(filter).sort({ createdAt: 1 }).toArray(),
      collections.pendingPayments.find(filter).sort({ createdAt: 1 }).toArray(),
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
    const authLabId = getAuthenticatedLabId(req);
    // IMPORTANT: this is the labId that will actually be stamped onto every
    // document we write below. Everything must agree with this value.
    const scopeLabId = authLabId || patient?.labId || null;
    const collections = await getCollections(scopeLabId);

    // Scope the duplicate-id check to this lab, not globally, in case the
    // underlying collections are shared across labs.
    const existingPatient = await collections.patients.findOne({
      id: patient.id,
      ...(scopeLabId ? { labId: scopeLabId } : {}),
    });
    if (existingPatient) {
      return NextResponse.json({ message: "A patient with this ID already exists" }, { status: 409 });
    }

    const now = new Date();

    // FIX: previously labId was never written onto the patient document,
    // so GET's `{ labId: scopeLabId }` filter could never match it and the
    // newly registered patient would "disappear" from the dashboard.
    await collections.patients.insertOne({
      ...patient,
      labId: scopeLabId,
      createdAt: now,
      updatedAt: now,
    });

    if (advancePayment?.id) {
      await collections.advancePayments.insertOne({
        ...advancePayment,
        labId: scopeLabId,
        patientId: patient.id,
        createdAt: now,
        updatedAt: now,
      });
    }

    if (pendingPayment?.id) {
      await collections.pendingPayments.insertOne({
        ...pendingPayment,
        labId: scopeLabId,
        patientId: patient.id,
        createdAt: now,
        updatedAt: now,
      });
    }

    return NextResponse.json(
      { message: "Patient added", patient: { ...patient, labId: scopeLabId } },
      { status: 201 }
    );
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
    const body = await req.json();
    const authLabId = getAuthenticatedLabId(req);
    const scopeLabId = authLabId || body?.labId || null;
    const collections = await getCollections(scopeLabId);
    const { id, pendingPaymentId, advancePayment, reportSummary, ...updates } = body || {};

    if (!id) {
      return NextResponse.json({ message: "Missing patient ID" }, { status: 400 });
    }

    // Never let the client overwrite the lab ownership of a record via updates.
    delete updates.labId;

    const updateOps = {
      $set: { ...updates, updatedAt: new Date() },
    };

    if (reportSummary) {
      updateOps.$push = { reports: reportSummary };
    }

    // FIX: scope the match to this lab so one lab can't edit another lab's
    // patient record if patient ids ever collide across labs.
    const matchFilter = scopeLabId ? { id, labId: scopeLabId } : { id };

    const result = await collections.patients.findOneAndUpdate(
      matchFilter,
      updateOps,
      { returnDocument: "after" }
    );

    const updatedPatient = result?.value || result;

    if (!updatedPatient) {
      return NextResponse.json({ message: "Patient not found" }, { status: 404 });
    }

    let pendingDeleted = 0;
    if (pendingPaymentId) {
      const delRes = await collections.pendingPayments.deleteOne({
        id: pendingPaymentId,
        ...(scopeLabId ? { labId: scopeLabId } : {}),
      });
      pendingDeleted = delRes.deletedCount || 0;
    }

    let advanceUpserted = false;
    if (advancePayment?.id) {
      const updRes = await collections.advancePayments.updateOne(
        { id: advancePayment.id, ...(scopeLabId ? { labId: scopeLabId } : {}) },
        {
          $set: {
            ...advancePayment,
            labId: scopeLabId,
            patientId: id,
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
    const authLabId = getAuthenticatedLabId(req);
    const scopeLabId = authLabId || new URL(req.url).searchParams.get("labId")?.trim() || null;
    const { patients, advancePayments, pendingPayments } = await getCollections(scopeLabId);
    const url = new URL(req.url);
    const patientId = url.searchParams.get("id");

    if (!patientId) {
      return NextResponse.json({ message: "Missing patient ID" }, { status: 400 });
    }

    // FIX: scope delete to this lab so one lab can't delete another lab's patient.
    const matchFilter = scopeLabId ? { id: patientId, labId: scopeLabId } : { id: patientId };

    const result = await patients.deleteOne(matchFilter);
    if (result.deletedCount === 0) {
      return NextResponse.json({ message: "Patient not found" }, { status: 404 });
    }

    await Promise.all([
      advancePayments.deleteMany({ patientId, ...(scopeLabId ? { labId: scopeLabId } : {}) }),
      pendingPayments.deleteMany({ patientId, ...(scopeLabId ? { labId: scopeLabId } : {}) }),
    ]);

    return NextResponse.json({ message: "Patient deleted successfully" });
  } catch (error) {
    console.error("DELETE /api/patients error:", error);
    return NextResponse.json({ message: error.message || "Internal Server Error" }, { status: 500 });
  }
}