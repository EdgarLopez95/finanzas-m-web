export type CategoryType = "income" | "expense" | "transfer" | "other";

export type Category = {
  id: string;
  ownerId: string;
  name: string;
  icon: string;
  type: CategoryType;
  iconKey?: string;
  color?: string;
  parentId?: string | null;
  archived?: boolean;
  /** Bloque 2 (seed): clave del catálogo canónico, null/undefined si no es una categoría seed. */
  seedKey?: string | null;
  /** Bloque 2 (seed): orden canónico del catálogo, null/undefined si no es una categoría seed. */
  sortOrder?: number | null;
  createdAt?: Date | null;
};