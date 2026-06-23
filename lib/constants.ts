export const PLANS = {
  free: {
    label: "Free",
    credits: 10,
    price: 0,
  },
  starter: {
    label: "Starter",
    credits: 50,
    price: 9,
  },
  pro: {
    label: "Pro",
    credits: 150,
    price: 29,
  },
} as const;

export const CREDIT_COST_PER_GENERATION = 1;

export const MIN_CREDITS_TO_GENERATE = 1;

export const AUTO_HEAL_MAX_ATTEMPTS = 3;

export function canUseImproveAgent(plan: string): boolean {
  return plan === "starter" || plan === "pro";
}

export const PRICING_PLANS = [
  {
    key: "free",
    label: "Free",
    description: "Start building. No credit card required.",
    price: 0,
    featured: false,
    planId: null,
    active: true,
    features: ["10 generations / month", "Live preview", "Export to zip"],
  },
  {
    key: "starter",
    label: "Starter",
    description: "For developers who build regularly.",
    price: 9,
    featured: true,
    planId: "cplan_3Et5fsDz7EvOLeOmdiKauQByO6Q",
    active: false,
    features: [
      "50 generations / month",
      "Image uploads",
      "Live preview",
      "Export to zip",
    ],
  },
  {
    key: "pro",
    label: "Pro",
    description: "For power users who ship fast.",
    price: 29,
    featured: false,
    planId: "cplan_3Et5t7nvLLA6tM9X2QKFeleJXW6",
    active: false,
    features: [
      "150 generations / month",
      "Priority AI (faster response)",
      "Live preview",
      "Export to zip",
      "Image uploads",
      "Access to Dreamera Pro Agent",
    ],
  },
] as const;
