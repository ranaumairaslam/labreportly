"use client";

import React from "react";

export function ShimmerCard({ lines = 4 }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="h-4 w-2/3 bg-muted rounded mb-4 shimmer" />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-3 w-full bg-muted rounded mb-2 shimmer" />
      ))}
    </div>
  );
}

