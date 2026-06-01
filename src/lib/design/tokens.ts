export const financeColors = {
  interface: {
    primary: "#24324A",
    ink: "#111827",
    warmPaper: "#F7F6F2",
    backgroundDark: "#111827",
    backgroundDeep: "#090E18",
    surfaceDark: "#1A2436",
    surfaceDarkAlt: "#202B3F",
    heroBase: "#0D1424",
    heroSurface: "#172238",
    heroSurfaceElevated: "#1D2A44",
    borderDark: "#334155",
    dividerDark: "#2E3A4F",
  },
  financial: {
    income: "#22C55E",
    expense: "#EF4444",
    transfer: "#3B82F6",
    pending: "#E4B363",
    neutral: "#6B7280",
  },
  entity: {
    accountBank: "#60A5FA",
    accountSavings: "#6C8E7F",
    accountWallet: "#A78BFA",
    accountCash: "#E4B363",
  },
} as const;

export const financeSpacing = {
  2: "2px",
  4: "4px",
  8: "8px",
  12: "12px",
  16: "16px",
  20: "20px",
  24: "24px",
  32: "32px",
  40: "40px",
} as const;

export const financeRadius = {
  hero: "28px",
  headerBottom: "32px",
  recentMovementsCard: "30px",
  accountCarouselCard: "28px",
  cardLarge: "24px",
  cardMedium: "20px",
  fab: "22px",
  button: "18px",
  input: "16px",
  bottomSheetTop: "28px",
  chip: "999px",
} as const;

export const financeTypography = {
  displayAmount: {
    fontSize: "48px",
    lineHeight: "1.05",
    fontWeight: 600,
    letterSpacing: "-0.02em",
  },
  headlineLarge: {
    fontSize: "32px",
    lineHeight: "1.2",
    fontWeight: 600,
  },
  titleLarge: {
    fontSize: "22px",
    lineHeight: "1.3",
    fontWeight: 600,
  },
  bodyLarge: {
    fontSize: "16px",
    lineHeight: "1.5",
    fontWeight: 400,
  },
  bodyMedium: {
    fontSize: "14px",
    lineHeight: "1.45",
    fontWeight: 400,
  },
  labelLarge: {
    fontSize: "14px",
    lineHeight: "1.35",
    fontWeight: 500,
  },
  labelSmall: {
    fontSize: "11px",
    lineHeight: "1.3",
    fontWeight: 500,
  },
} as const;