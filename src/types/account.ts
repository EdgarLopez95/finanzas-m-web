export type Account = {
  id: string;
  ownerId: string;
  name: string;
  balance: number;
  currency: string;
  institutionName: string;
  type: string;
  updatedAt: Date | null;
  /** Si false, la cuenta se excluye de Saldo bancario bruto y Dinero propio. Default: true. */
  includeInTotal: boolean;
  /** Cuentas archivadas no aparecen en Home, Cuentas ni selectores. Default: false. */
  archived: boolean;
  /** Clave lógica del ícono (e.g. "bank", "wallet", "cash"). Shared con Android. */
  iconKey: string;
  /** Tipo de ícono: "generic" o "bank_logo". */
  iconType: string;
  /** Color hex elegido al crear (#rrggbb). Vacío en cuentas legacy. */
  color: string;
};
