export const DEFAULT_DASHBOARD_BRANDING = {
  labId: "",
  labName: "",
  tagline: "Clinical Laboratory",
  address: "",
  phone: "",
  logoUrl: "",
  primaryColor: "",
  accentColor: "",
  templateUrduName: "",
  templateUrduTagline: "",
  templateFooter: "",
  templateInchargeLabel: "",
  templateWatermarkOpacity: "0.09",
  dashboardMenuOrder: ["Overview", "New Registration", "Revenue", "Reports"],
  staffMenuOrder: ["Registration", "Report Generated"],
};

export function normalizeBranding(source = {}) {
  const branding = source.branding || source.dashboardBranding || source;

  return {
    ...DEFAULT_DASHBOARD_BRANDING,
    labId: source.id || source.labId || branding.labId || DEFAULT_DASHBOARD_BRANDING.labId,
    labName: branding.labName || source.name || DEFAULT_DASHBOARD_BRANDING.labName,
    tagline: branding.tagline || source.tagline || DEFAULT_DASHBOARD_BRANDING.tagline,
    address: branding.address || source.address || DEFAULT_DASHBOARD_BRANDING.address,
    phone: branding.phone || source.phone || DEFAULT_DASHBOARD_BRANDING.phone,
    logoUrl: branding.logoUrl || source.logoUrl || DEFAULT_DASHBOARD_BRANDING.logoUrl,
    primaryColor: branding.primaryColor || DEFAULT_DASHBOARD_BRANDING.primaryColor,
    accentColor: branding.accentColor || DEFAULT_DASHBOARD_BRANDING.accentColor,
    templateUrduName: branding.templateUrduName || DEFAULT_DASHBOARD_BRANDING.templateUrduName,
    templateUrduTagline: branding.templateUrduTagline || DEFAULT_DASHBOARD_BRANDING.templateUrduTagline,
    templateFooter: branding.templateFooter || source.templateFooter || DEFAULT_DASHBOARD_BRANDING.templateFooter,
    templateInchargeLabel: branding.templateInchargeLabel || DEFAULT_DASHBOARD_BRANDING.templateInchargeLabel,
    templateWatermarkOpacity: branding.templateWatermarkOpacity || DEFAULT_DASHBOARD_BRANDING.templateWatermarkOpacity,
    dashboardMenuOrder: Array.isArray(branding.dashboardMenuOrder)
      ? branding.dashboardMenuOrder
      : DEFAULT_DASHBOARD_BRANDING.dashboardMenuOrder,
    staffMenuOrder: Array.isArray(branding.staffMenuOrder)
      ? branding.staffMenuOrder
      : DEFAULT_DASHBOARD_BRANDING.staffMenuOrder,
  };
}

export function readStoredBranding() {
  if (typeof window === "undefined") return DEFAULT_DASHBOARD_BRANDING;

  try {
    const storedBranding = window.localStorage.getItem("lab_dashboard_branding");
    if (storedBranding) return normalizeBranding(JSON.parse(storedBranding));

    const storedLab = window.localStorage.getItem("lab_profile");
    if (storedLab) return normalizeBranding(JSON.parse(storedLab));
  } catch (error) {
    console.warn("Could not read lab dashboard branding.", error);
  }

  return DEFAULT_DASHBOARD_BRANDING;
}

export function storeBranding(branding) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("lab_dashboard_branding", JSON.stringify(normalizeBranding(branding)));
}
