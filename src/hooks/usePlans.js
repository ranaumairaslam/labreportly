import { useState } from "react";

export function usePublicPlans() {
  const [plans] = useState([
    {
      id: "basic",
      name: "Basic",
      price: 29,
      cycle: "month",
      pinQuota: 500,
      teamMembers: 2,
      popular: false,
    },
    {
      id: "pro",
      name: "Pro",
      price: 59,
      cycle: "month",
      pinQuota: 1500,
      teamMembers: 5,
      popular: true,
    },
  ]);
  const loading = false;
  const freeTrialDays = 14;

  return { plans, loading, freeTrialDays };
}


