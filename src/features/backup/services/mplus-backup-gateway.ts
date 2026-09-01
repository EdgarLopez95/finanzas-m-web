import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  type Firestore,
} from "firebase/firestore";

/**
 * Puerto de acceso a datos para el Respaldo en ZIP (Finanzas M+).
 *
 * Permite ejecutar la exportación tanto contra Firestore real como con
 * implementaciones simuladas en pruebas unitarias sin dependencias externas.
 */

export type BackupDoc = Readonly<{
  id: string;
  path: readonly string[];
  data: Record<string, unknown>;
}>;

export type MplusBackupGateway = Readonly<{
  /** Lee un documento. Devuelve `null` si no existe. */
  readDoc: (path: readonly string[]) => Promise<Record<string, unknown> | null>;
  /** Lista una colección o subcolección completa. */
  listCollection: (path: readonly string[]) => Promise<BackupDoc[]>;
  /**
   * Consulta de igualdad sobre una colección, con hasta dos filtros.
   */
  queryByField: (
    collectionName: string,
    field: string,
    value: string,
    extra?: Readonly<{ field: string; value: string }>,
  ) => Promise<BackupDoc[]>;
}>;

const toDocRef = (db: Firestore, path: readonly string[]) =>
  doc(db, path[0], ...path.slice(1));

/** Implementación real contra Firestore. */
export const createFirestoreBackupGateway = (db: Firestore): MplusBackupGateway => ({
  readDoc: async (path) => {
    const snap = await getDoc(toDocRef(db, path));
    return snap.exists() ? ((snap.data() ?? {}) as Record<string, unknown>) : null;
  },

  listCollection: async (path) => {
    const snap = await getDocs(collection(db, path[0], ...path.slice(1)));
    return snap.docs.map((d) => ({
      id: d.id,
      path: [...path, d.id],
      data: (d.data() ?? {}) as Record<string, unknown>,
    }));
  },

  queryByField: async (collectionName, field, value, extra) => {
    const constraints = [where(field, "==", value)];
    if (extra) constraints.push(where(extra.field, "==", extra.value));
    const snap = await getDocs(query(collection(db, collectionName), ...constraints));
    return snap.docs.map((d) => ({
      id: d.id,
      path: [collectionName, d.id],
      data: (d.data() ?? {}) as Record<string, unknown>,
    }));
  },
});
