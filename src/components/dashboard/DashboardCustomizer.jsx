"use client";

import Image from "next/image";
import { GripVertical, ImagePlus, Loader2, Save, X } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { normalizeBranding, storeBranding } from "@/lib/dashboardBranding";

function moveItem(items, fromIndex, toIndex) {
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export default function DashboardCustomizer({
  open,
  onClose,
  branding,
  onSave,
  menuKey,
  menuItems,
}) {
  const [draft, setDraft] = useState(() => normalizeBranding(branding));
  const [draggedItem, setDraggedItem] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  if (!open) return null;

  const orderedMenu = draft[menuKey] || menuItems.map((item) => item.name);

  const updateDraft = (field, value) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const handleLogoUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file for the logo.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => updateDraft("logoUrl", reader.result);
    reader.readAsDataURL(file);
  };

  const handleDrop = (targetName) => {
    if (!draggedItem || draggedItem === targetName) return;

    const fromIndex = orderedMenu.indexOf(draggedItem);
    const toIndex = orderedMenu.indexOf(targetName);
    if (fromIndex < 0 || toIndex < 0) return;

    updateDraft(menuKey, moveItem(orderedMenu, fromIndex, toIndex));
    setDraggedItem(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextBranding = normalizeBranding(draft);

    setIsSaving(true);
    storeBranding(nextBranding);

    try {
      if (nextBranding.labId) {
        const res = await fetch("/api/labs", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: nextBranding.labId,
            name: nextBranding.labName,
            branding: nextBranding,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Could not save dashboard settings.");
      }

      onSave(nextBranding);
      toast.success("Dashboard settings saved.");
      onClose();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Could not save dashboard settings.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <form onSubmit={handleSubmit} className="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-start justify-between border-b border-slate-200 bg-slate-50 px-6 py-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Edit Dashboard</h2>
            <p className="mt-1 text-xs text-slate-500">Change lab name, logo, contact details, colors, and menu order.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto p-6">
          <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
       <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
  {/* Changed rounded-xl to rounded-full here */}
  <div className="mx-auto flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white">
    {draft.logoUrl ? (
      <Image 
        src={draft.logoUrl} 
        alt={`${draft.labName} logo preview`} 
        width={128} 
        height={128} 
        /* Changed object-contain to object-cover so the image fills the circle nicely, and removed p-2 if you want it edge-to-edge. Keep p-2 if you want a white border inside the circle. */
        className="h-full w-full object-cover" 
        unoptimized 
      />
    ) : (
      <ImagePlus className="h-10 w-10 text-slate-300" />
    )}
  </div>
  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100">
    <ImagePlus className="h-4 w-4" />
    Upload Logo
    <input
      type="file"
      accept="image/*"
      className="sr-only"
      onChange={handleLogoUpload}
    />
  </label>
</div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase text-slate-500">Lab Name</label>
                <input value={draft.labName} onChange={(e) => updateDraft("labName", e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-700" required />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase text-slate-500">Tagline</label>
                <input value={draft.tagline} onChange={(e) => updateDraft("tagline", e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-700" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase text-slate-500">Address</label>
                <input value={draft.address} onChange={(e) => updateDraft("address", e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-700" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase text-slate-500">Phone</label>
                <input value={draft.phone} onChange={(e) => updateDraft("phone", e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-700" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase text-slate-500">Sidebar Color</label>
                <input type="color" value={draft.primaryColor} onChange={(e) => updateDraft("primaryColor", e.target.value)} className="h-10 w-full rounded-lg border border-slate-300 bg-white p-1" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase text-slate-500">Accent Color</label>
                <input type="color" value={draft.accentColor} onChange={(e) => updateDraft("accentColor", e.target.value)} className="h-10 w-full rounded-lg border border-slate-300 bg-white p-1" />
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-slate-200 p-4">
            <div className="mb-3">
              <h3 className="text-sm font-bold text-slate-800">Menu Order</h3>
              <p className="text-xs text-slate-500">Drag each dashboard item into the order this lab prefers.</p>
            </div>
            <div className="grid gap-2">
              {orderedMenu.map((name) => (
                <div
                  key={name}
                  draggable
                  onDragStart={() => setDraggedItem(name)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => handleDrop(name)}
                  className="flex cursor-grab items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm active:cursor-grabbing"
                >
                  <GripVertical className="h-4 w-4 text-slate-400" />
                  {name}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-200">
            Cancel
          </button>
          <button type="submit" disabled={isSaving} className="inline-flex items-center gap-2 rounded-lg bg-emerald-800 px-5 py-2 text-sm font-bold text-white transition hover:bg-emerald-900 disabled:opacity-50">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}
