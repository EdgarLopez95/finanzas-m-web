export type Household = {
  id: string;
  name: string;
  ownerId: string;
  memberIds: string[];
  memberCount: number;
  inviteCode?: string | null;
  inviteCodeExpiresAt?: Date | null;
  status: "active" | "dissolved";
};

/** Perfil mínimo y seguro de un miembro del Hogar (sin datos financieros). */
export type HouseholdMemberProfile = {
  uid: string;
  displayName: string;
  photoUrl: string | null;
};

export type HouseholdEvent = {
  id: string;
  householdId: string;
  title: string;
  notes: string;
  amount: number;
  /** householdCategoryId en Firestore → mapeado como categoryId. */
  categoryId: string;
  /** UID del miembro que creó el evento (createdByUserId en Firestore). */
  createdByUserId: string;
  /** UID del miembro que adelantó/invitó el pago. */
  paidByUserId: string;
  /** Modo de liquidación de este evento. */
  settlementMode: "invitation" | "advancedByPayer" | "eachPaysOwn";
  /** ID de la transacción origen, si fue creado por proyección Personal -> Hogar. */
  sourceTransactionId?: string | null;
  status: string;
  isActive: boolean;
  /** Fecha real del evento (eventDate > date > createdAt). */
  eventDate: Date | null;
  createdAt: Date | null;
};

export type HouseholdEventShare = {
  id: string;
  householdId: string;
  eventId: string;
  memberUserId: string;
  /** Monto que corresponde a este miembro (puede ser undefined en shares sin split explícito). */
  amount: number;
  /** Porcentaje asignado al miembro (0-100). Undefined si el share es igual entre todos. */
  percentage: number | null;
  status: string;
  isPaid: boolean;
  completedAt?: Date | null;
  completedByTransactionId?: string | null;
  createdAt: Date | null;
  updatedAt?: Date | null;
};

export type HouseholdCategory = {
  id: string;
  householdId: string;
  name: string;
  iconKey: string;
  color: string;
  archived: boolean;
  parentId?: string | null;
  /** Bloque 2 (seed): clave del catálogo canónico, null/undefined si no es una categoría seed. */
  seedKey?: string | null;
  /** Bloque 2 (seed): orden canónico del catálogo, null/undefined si no es una categoría seed. */
  sortOrder?: number | null;
  createdAt?: Date | null;
};

export type HouseholdDebt = {
  id: string;
  householdId: string;
  /** eventId: evento del hogar que originó esta deuda (puede ser vacío). */
  eventId: string;
  title: string;
  /** fromUserId: quien debe el dinero. */
  fromUserId: string;
  /** toUserId: a quién se le debe. */
  toUserId: string;
  amount: number;
  status: string;
  outgoingTransactionId?: string | null;
  incomingTransactionId?: string | null;
  paymentDeclaredAt?: Date | null;
  paidAt?: Date | null;
  createdAt: Date | null;
  updatedAt?: Date | null;
};

export type HouseholdIncomeEntry = {
  id: string;
  householdId: string;
  /** Descripción segura derivada del ingreso personal (sin datos privados). */
  visibleDescription: string;
  /** sourceOwnerId: UID del miembro que proyectó este ingreso. */
  sourceOwnerId: string;
  amount: number;
  status: string;
  /** Fecha del ingreso original (entryDate > createdAt). */
  entryDate: Date | null;
  createdAt: Date | null;
};
