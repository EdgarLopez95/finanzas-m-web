import {
  Utensils,
  ShoppingBasket,
  House,
  ReceiptText,
  Car,
  Bus,
  CreditCard,
  ShieldPlus,
  PawPrint,
  Ticket,
  BadgeDollarSign,
  UsersRound,
  GraduationCap,
  Landmark,
  Fuel,
  UtensilsCrossed,
  Bike,
  Coffee,
  Wifi,
  Smartphone,
  Zap,
  Droplet,
  Flame,
  Sparkles,
  Wrench,
  ShoppingBag,
  Shirt,
  Heart,
  BriefcaseMedical,
  Dumbbell,
  Gift,
  PartyPopper,
  Plane,
  LayoutGrid,
  Cloud,
  ShieldCheck,
  CircleParking,
  Scissors,
  Shapes,
  CircleHelp,
  HandCoins,
  BriefcaseBusiness,
  Palette,
  Store,
  Building2,
  Banknote,
  BadgePercent,
  Award,
  TrendingUp,
  PiggyBank,
  LineChart,
  Undo2,
  ArrowLeftRight,
  Play,
  CircleDollarSign,
  type LucideIcon
} from "lucide-react";

export interface CategoryIconOption {
  iconKey: string;
  label: string;
  keywords: string[];
}

/**
 * Grupo canónico de filtro para el picker de íconos. Un iconKey puede
 * pertenecer a más de un grupo (paridad con Android
 * `CategoryVisualCatalog.categoryIconGroups`), por eso el filtro se resuelve
 * por pertenencia (`iconKeys.includes(...)`) y no por un campo único en cada
 * opción.
 */
export interface CategoryIconGroup {
  title: string;
  iconKeys: string[];
}

export const expenseIconCatalog: Record<string, LucideIcon> = {
  food: Utensils,
  groceries: ShoppingBasket,
  housing: House,
  bills: ReceiptText,
  car: Car,
  transport: Bus,
  credit_card: CreditCard,
  health: ShieldPlus,
  pets: PawPrint,
  entertainment: Ticket,
  subscriptions: BadgeDollarSign,
  family: UsersRound,
  education: GraduationCap,
  bank: Landmark,
  gasoline: Fuel,
  restaurant: UtensilsCrossed,
  delivery: Bike,
  coffee: Coffee,
  internet: Wifi,
  phone: Smartphone,
  electricity: Zap,
  water: Droplet,
  gas_service: Flame,
  cleaning: Sparkles,
  maintenance: Wrench,
  shopping: ShoppingBag,
  clothes: Shirt,
  personal_care: Heart,
  pharmacy: BriefcaseMedical,
  fitness: Dumbbell,
  gifts: Gift,
  celebration: PartyPopper,
  travel: Plane,
  apps: LayoutGrid,
  cloud: Cloud,
  insurance: ShieldCheck,
  parking: CircleParking,
  toll: BadgeDollarSign,
  haircut: Scissors,
  other: Shapes,
};

export const incomeIconCatalog: Record<string, LucideIcon> = {
  salary: HandCoins,
  freelance: BriefcaseBusiness,
  design_work: Palette,
  service_work: Wrench,
  sales: Store,
  business: Building2,
  client_payment: Banknote,
  commission: BadgePercent,
  bonus: Award,
  investment: TrendingUp,
  interest: PiggyBank,
  dividends: LineChart,
  rental_income: Building2,
  family_support: UsersRound,
  gift_income: Gift,
  cash_back: BadgeDollarSign,
  cashback: BadgeDollarSign,
  refund: Undo2,
  reimbursement: ArrowLeftRight,
  loan_received: Landmark,
  content_income: Play,
  teaching: GraduationCap,
  creative_income: Palette,
  other_income: CircleDollarSign,
  unknown_income: CircleHelp,
};

export const expenseIconOptions: CategoryIconOption[] = [
  { iconKey: "food", label: "Comida", keywords: ["comida", "alimento", "restaurante", "desayuno", "almuerzo", "cena"] },
  { iconKey: "groceries", label: "Mercado", keywords: ["mercado", "supermercado", "compras", "despensa", "groceries"] },
  { iconKey: "restaurant", label: "Restaurantes", keywords: ["restaurante", "comer fuera", "gourmet", "salida"] },
  { iconKey: "coffee", label: "Café", keywords: ["cafe", "taza", "panaderia", "onces", "starbucks", "coffee"] },
  { iconKey: "delivery", label: "Domicilios", keywords: ["domicilio", "rappi", "uber eats", "comida rapida", "delivery", "moto"] },

  { iconKey: "housing", label: "Vivienda", keywords: ["vivienda", "casa", "arriendo", "apartamento", "hipoteca", "housing"] },
  { iconKey: "cleaning", label: "Limpieza", keywords: ["limpieza", "aseo", "detergente", "lavanderia", "cleaning", "sparkles"] },
  { iconKey: "maintenance", label: "Mantenimiento", keywords: ["mantenimiento", "reparacion", "plomero", "pintura", "maintenance", "wrench"] },
  { iconKey: "electricity", label: "Luz / Electricidad", keywords: ["luz", "electricidad", "energia", "servicio publico", "electricity", "zap"] },
  { iconKey: "water", label: "Agua", keywords: ["agua", "acueducto", "servicio publico", "water", "droplet"] },
  { iconKey: "gas_service", label: "Gas", keywords: ["gas", "servicio publico", "cocina", "flame"] },

  { iconKey: "car", label: "Vehículo / Carro", keywords: ["carro", "vehiculo", "auto", "car"] },
  { iconKey: "transport", label: "Transporte Público", keywords: ["transporte", "bus", "transmilenio", "metro", "colectivo", "publico"] },
  { iconKey: "gasoline", label: "Gasolina", keywords: ["gasolina", "combustible", "estacion", "tanque", "gasoline", "fuel"] },
  { iconKey: "parking", label: "Parqueadero", keywords: ["parqueadero", "estacionamiento", "parking"] },
  { iconKey: "toll", label: "Peaje", keywords: ["peaje", "carretera", "viaje", "toll"] },

  { iconKey: "health", label: "Salud / Médicos", keywords: ["salud", "medico", "doctor", "consulta", "eps", "prepagada", "health"] },
  { iconKey: "pharmacy", label: "Farmacia", keywords: ["farmacia", "drogueria", "medicamentos", "pastillas", "pharmacy"] },
  { iconKey: "personal_care", label: "Cuidado Personal", keywords: ["cuidado personal", "aseo", "spa", "cosmeticos", "personal_care", "heart"] },
  { iconKey: "fitness", label: "Gimnasio / Deporte", keywords: ["gimnasio", "deporte", "fitness", "gym", "entrenamiento", "dumbbell"] },
  { iconKey: "haircut", label: "Peluquería", keywords: ["peluqueria", "corte", "barberia", "haircut", "scissors"] },

  { iconKey: "shopping", label: "Compras", keywords: ["compras", "shopping", "mall", "tienda"] },
  { iconKey: "clothes", label: "Ropa", keywords: ["ropa", "vestido", "zapatos", "moda", "clothes", "shirt"] },
  { iconKey: "gifts", label: "Regalos", keywords: ["regalo", "detalle", "cumpleanos", "gifts", "gift"] },

  { iconKey: "bills", label: "Facturas", keywords: ["factura", "cuenta", "pago", "bills", "receipt"] },
  { iconKey: "credit_card", label: "Tarjeta de Crédito", keywords: ["tarjeta de credito", "banco", "visa", "mastercard", "credit_card"] },
  { iconKey: "subscriptions", label: "Suscripciones", keywords: ["suscripcion", "netflix", "spotify", "mensualidad", "subscriptions"] },
  { iconKey: "internet", label: "Internet", keywords: ["internet", "wifi", "fibra", "hogar"] },
  { iconKey: "phone", label: "Celular / Teléfono", keywords: ["celular", "telefono", "plan", "datos", "smartphone"] },
  { iconKey: "apps", label: "Aplicaciones", keywords: ["aplicacion", "app", "software", "juego", "layoutgrid"] },
  { iconKey: "cloud", label: "Nube / Almacenamiento", keywords: ["nube", "drive", "icloud", "dropbox", "cloud"] },
  { iconKey: "insurance", label: "Seguros", keywords: ["seguro", "poliza", "soat", "insurance"] },

  { iconKey: "pets", label: "Mascotas", keywords: ["mascota", "perro", "gato", "veterinaria", "comida perro", "pets", "pawprint"] },
  { iconKey: "entertainment", label: "Entretenimiento", keywords: ["entretenimiento", "cine", "concierto", "diversion", "ticket"] },
  { iconKey: "family", label: "Familia", keywords: ["familia", "hijos", "padres", "apoyo", "family", "usersround"] },
  { iconKey: "education", label: "Educación", keywords: ["educacion", "colegio", "universidad", "curso", "libro", "graduationcap"] },
  { iconKey: "bank", label: "Banco", keywords: ["banco", "transferencia", "comision", "landmark"] },
  { iconKey: "celebration", label: "Celebración", keywords: ["celebracion", "fiesta", "rumba", "licor", "partypopper"] },
  { iconKey: "travel", label: "Viajes", keywords: ["viaje", "hotel", "tiquete", "vacaciones", "plane"] },
  { iconKey: "other", label: "Otros", keywords: ["otros", "varios", "gasto vario", "shapes"] },
];

export const incomeIconOptions: CategoryIconOption[] = [
  { iconKey: "salary", label: "Sueldo / Nómina", keywords: ["sueldo", "nomina", "salario", "pago", "empresa", "salary"] },
  { iconKey: "freelance", label: "Freelance / Contratos", keywords: ["freelance", "contrato", "proyecto", "honorarios", "independiente"] },
  { iconKey: "design_work", label: "Diseño", keywords: ["diseno", "palette", "creative", "logos", "ilustracion"] },
  { iconKey: "service_work", label: "Servicios Prestados", keywords: ["servicios", "soporte", "asesoria", "wrench"] },
  { iconKey: "teaching", label: "Clases / Tutorías", keywords: ["clases", "tutoria", "profesor", "curso", "graduationcap"] },
  { iconKey: "creative_income", label: "Trabajo Creativo", keywords: ["creativo", "arte", "musica", "escritura", "palette"] },

  { iconKey: "sales", label: "Ventas", keywords: ["venta", "comercio", "negocio", "sales", "store"] },
  { iconKey: "business", label: "Negocio Propio", keywords: ["negocio", "empresa", "local", "business", "building2"] },
  { iconKey: "client_payment", label: "Pago de Cliente", keywords: ["cliente", "pago", "abono", "banknote"] },
  { iconKey: "commission", label: "Comisión", keywords: ["comision", "porcentaje", "ventas", "commission"] },
  { iconKey: "bonus", label: "Bono / Prima", keywords: ["bono", "prima", "regalo", "aguinaldo", "award"] },
  { iconKey: "investment", label: "Inversiones", keywords: ["inversion", "cripto", "acciones", "trendingup"] },
  { iconKey: "interest", label: "Intereses", keywords: ["interes", "rendimiento", "cdt", "piggybank"] },
  { iconKey: "dividends", label: "Dividendos", keywords: ["dividendo", "utilidad", "rendimiento", "linechart"] },
  { iconKey: "rental_income", label: "Arriendos / Rentas", keywords: ["arriendo", "renta", "alquiler", "propiedad", "building2"] },

  { iconKey: "family_support", label: "Ayuda Familiar", keywords: ["familia", "apoyo", "padres", "regalo familia", "usersround"] },
  { iconKey: "gift_income", label: "Regalo", keywords: ["regalo", "cumpleanos", "gift"] },
  { iconKey: "cashback", label: "Cashback", keywords: ["cashback", "devolucion", "tarjeta", "recompensa"] },
  { iconKey: "refund", label: "Reembolso / Devolución", keywords: ["reembolso", "devolucion", "compra", "refund", "undo2"] },
  { iconKey: "reimbursement", label: "Reintegro de Gasto", keywords: ["reintegro", "gasto compartido", "reimbursement", "arrowleftright"] },
  { iconKey: "loan_received", label: "Préstamo Recibido", keywords: ["prestamo", "credito", "banco", "landmark"] },
  { iconKey: "content_income", label: "Redes / Contenido", keywords: ["redes", "youtube", "tiktok", "twitch", "contenido"] },
  { iconKey: "other_income", label: "Otros Ingresos", keywords: ["otros", "varios", "extra", "circledollarsign"] },
  { iconKey: "unknown_income", label: "Ingreso Desconocido", keywords: ["desconocido", "duda", "circlehelp"] },
];

/**
 * Grupos canónicos de filtro para el picker de gasto (Personal y Hogar),
 * paridad exacta con Android `CategoryVisualCatalog.categoryIconGroups`
 * (rama de gasto). Un iconKey puede repetirse entre grupos; algunos iconKey
 * (p. ej. "health", "pets") no pertenecen a ningún grupo curado y solo
 * aparecen bajo "Todos" o por búsqueda, igual que en Android.
 */
export const EXPENSE_ICON_GROUPS: CategoryIconGroup[] = [
  { title: "Hogar", iconKeys: ["housing", "groceries", "bills", "cleaning", "maintenance", "internet", "food"] },
  { title: "Movilidad", iconKeys: ["car", "transport", "gasoline", "parking", "toll", "travel", "maintenance"] },
  { title: "Finanzas", iconKeys: ["bank", "credit_card", "subscriptions", "family", "education", "insurance", "other"] },
  { title: "Comida", iconKeys: ["food", "restaurant", "delivery", "coffee", "groceries"] },
  { title: "Servicios", iconKeys: ["bills", "internet", "phone", "electricity", "water", "gas_service", "maintenance", "gasoline", "toll"] },
  { title: "Compras", iconKeys: ["shopping", "clothes", "personal_care", "pharmacy", "fitness", "gifts", "groceries"] },
  { title: "Ocio", iconKeys: ["entertainment", "subscriptions", "celebration", "travel", "restaurant", "coffee", "apps", "gifts"] },
  { title: "Otros", iconKeys: ["apps", "cloud", "parking", "haircut", "other"] },
];

/**
 * Grupos canónicos de filtro para el picker de ingreso (solo Personal),
 * paridad exacta con Android `CategoryVisualCatalog.categoryIconGroups`
 * (rama de ingreso).
 */
export const INCOME_ICON_GROUPS: CategoryIconGroup[] = [
  { title: "Trabajo", iconKeys: ["salary", "client_payment", "commission", "bonus", "business"] },
  { title: "Freelance y servicios", iconKeys: ["freelance", "design_work", "service_work", "teaching", "creative_income", "content_income"] },
  { title: "Ventas y negocio", iconKeys: ["sales", "business", "rental_income"] },
  { title: "Inversiones", iconKeys: ["investment", "interest", "dividends"] },
  { title: "Apoyos y recompensas", iconKeys: ["family_support", "gift_income", "cashback"] },
  { title: "Especiales", iconKeys: ["refund", "reimbursement", "loan_received", "other_income", "unknown_income"] },
];

/**
 * Paleta canónica Android de 16 colores (`CategoryVisualCatalog.categoryColorPaletteHex`),
 * orden exacto. Única fuente de colores para categorías Personal y Hogar.
 */
export const CATEGORY_COLOR_PALETTE: string[] = [
  "#EF4444", "#F97316", "#F59E0B", "#EAB308", "#84CC16", "#22C55E", "#10B981", "#14B8A6",
  "#06B6D4", "#0EA5E9", "#3B82F6", "#6366F1", "#8B5CF6", "#D946EF", "#EC4899", "#FB7185",
];

export const DEFAULT_EXPENSE_COLOR = CATEGORY_COLOR_PALETTE[0];
export const DEFAULT_INCOME_COLOR = CATEGORY_COLOR_PALETTE[5];

/** Claves legacy de gasto, aceptadas por compatibilidad pero fuera del picker. */
export const EXPENSE_ICON_KEY_LEGACY_ALIASES: string[] = ["shopping-bag"];
/** Claves legacy de ingreso, aceptadas por compatibilidad pero fuera del picker. */
export const INCOME_ICON_KEY_LEGACY_ALIASES: string[] = ["cash_back"];

const VALID_EXPENSE_KEY_SET = new Set([
  ...expenseIconOptions.map((o) => o.iconKey),
  ...EXPENSE_ICON_KEY_LEGACY_ALIASES,
]);
const VALID_INCOME_KEY_SET = new Set([
  ...incomeIconOptions.map((o) => o.iconKey),
  ...INCOME_ICON_KEY_LEGACY_ALIASES,
]);

/** Valida que `iconKey` pertenezca al catálogo canónico (o a un alias legacy) del `kind` dado. */
export function isValidIconKey(iconKey: string, kind: "expense" | "income"): boolean {
  return kind === "income" ? VALID_INCOME_KEY_SET.has(iconKey) : VALID_EXPENSE_KEY_SET.has(iconKey);
}

/** Valida formato hexadecimal de 6 dígitos (ej. "#EF4444"). */
export function isValidCategoryColor(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

export function resolveCategoryIcon(iconKey: string | undefined, kind: "expense" | "income" | string): LucideIcon {
  const normalizedKind = kind === "income" ? "income" : "expense";
  
  if (!iconKey) {
    return normalizedKind === "income" ? CircleDollarSign : Shapes;
  }
  
  if (normalizedKind === "income") {
    return incomeIconCatalog[iconKey] || CircleDollarSign;
  }
  
  return expenseIconCatalog[iconKey] || Shapes;
}
