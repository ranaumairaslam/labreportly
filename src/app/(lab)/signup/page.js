"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const initialValues = {
  lab_name: "",
  lab_code: "",
  address: "",
  phone: "",
  admin_name: "",
  admin_email: "",
  password: "",
};

export default function LabSignupPage() {
  const [formValues, setFormValues] = useState(initialValues);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const handleChange = (field) => (event) => {
    setFormValues({ ...formValues, [field]: event.target.value });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    setStatusMessage("");

    try {
      const payload = {
        name: formValues.lab_name,
        owner: formValues.admin_name,
        email: formValues.admin_email,
        password: formValues.password,
        lab_code: formValues.lab_code,
        address: formValues.address,
        phone: formValues.phone,
      };

      const res = await fetch("/api/labs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Could not register your laboratory");
      }

      setStatusMessage("Your laboratory has been registered successfully.");
      setFormValues(initialValues);
    } catch (error) {
      setStatusMessage(error.message || "Failed to register laboratory.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] px-4 py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
        <section className="space-y-6 rounded-3xl bg-white/90 p-8 shadow-xl shadow-slate-200/60 ring-1 ring-slate-200 lg:max-w-xl">
          <div className="inline-flex items-center gap-3 rounded-3xl bg-[#004d26] px-4 py-3 text-white shadow-lg shadow-[#004d26]/20">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-400 text-2xl font-black text-[#004d26]">
              AJ
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-slate-100">Al-Jannat Labs</p>
              <h1 className="text-3xl font-semibold tracking-tight text-white">Lab Signup</h1>
            </div>
          </div>

          <p className="text-slate-600 leading-7">
            Register your laboratory with Al-Jannat to enable patient registration, report generation, and staff access through the admin dashboard.
            Complete the form below and our team will review the details.
          </p>

          <div className="grid gap-4 rounded-3xl bg-slate-50 p-6 text-sm text-slate-700">
            <div className="space-y-2">
              <p className="font-semibold text-slate-900">What you get</p>
              <ul className="space-y-2 pl-4 text-slate-600">
                <li>• Centralized lab registration</li>
                <li>• Admin and staff access workflows</li>
                <li>• Patient and report management</li>
              </ul>
            </div>
            <div className="grid gap-2">
              <p className="font-semibold text-slate-900">Need help?</p>
              <p className="text-slate-600">Contact support at <span className="font-medium text-[#004d26]">0300-6943193</span> or visit our main office in Arifwala.</p>
            </div>
          </div>
        </section>

        <Card className="w-full bg-white/95 shadow-2xl shadow-slate-200/70">
          <CardHeader className="px-8 pb-0 pt-8 sm:px-10">
            <CardTitle className="text-2xl font-semibold text-slate-900">Create your lab account</CardTitle>
            <CardDescription className="mt-2 text-slate-600">
              Enter the lab details below and wait for admin approval. All fields are required.
            </CardDescription>
          </CardHeader>

          <CardContent className="px-8 pb-8 pt-4 sm:px-10">
            <form onSubmit={handleSubmit} className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Lab Name</label>
                  <Input
                    type="text"
                    value={formValues.lab_name}
                    onChange={handleChange("lab_name")}
                    placeholder="City Lab"
                    required
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Lab Code</label>
                  <Input
                    type="text"
                    value={formValues.lab_code}
                    onChange={handleChange("lab_code")}
                    placeholder="LAB001"
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Address</label>
                  <Input
                    type="text"
                    value={formValues.address}
                    onChange={handleChange("address")}
                    placeholder="New York, USA"
                    required
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Phone</label>
                  <Input
                    type="tel"
                    value={formValues.phone}
                    onChange={handleChange("phone")}
                    placeholder="0300 1234567"
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Admin Name</label>
                  <Input
                    type="text"
                    value={formValues.admin_name}
                    onChange={handleChange("admin_name")}
                    placeholder="John Doe"
                    required
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Admin Email</label>
                  <Input
                    type="email"
                    value={formValues.admin_email}
                    onChange={handleChange("admin_email")}
                    placeholder="admin@aljannat.lab"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Password</label>
                <Input
                  type="password"
                  value={formValues.password}
                  onChange={handleChange("password")}
                  placeholder="Create a secure password"
                  required
                />
              </div>

              <div className="space-y-3 pt-2">
                <Button type="submit" className="w-full bg-[#004d26] text-white hover:bg-[#00361a]" disabled={isLoading}>
                  {isLoading ? "Registering..." : "Submit Registration"}
                </Button>
                {statusMessage ? (
                  <p className={`rounded-2xl px-4 py-3 text-sm ${statusMessage.includes("success") ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"}`}>
                    {statusMessage}
                  </p>
                ) : null}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
