export function formatTrialLabel(freeTrialDays) {
  const days = Number(freeTrialDays ?? 0);
  if (!Number.isFinite(days) || days <= 0) return "14";
  return String(days);
}

