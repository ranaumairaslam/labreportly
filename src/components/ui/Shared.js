import React from "react";
import Image from "next/image";

export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <Image src="/super/softcenteric-logo.webp" alt="Al Jannat" width={40} height={40} className="w-10 h-10 object-contain" unoptimized />
      <span className="font-semibold text-sm">Al Jannat</span>
    </div>
  );
}

export function NotFoundState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14">
      {Icon ? <Icon className="w-10 h-10 mb-3 text-muted-foreground" /> : null}
      <h3 className="text-xl font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground mt-2 max-w-md">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

