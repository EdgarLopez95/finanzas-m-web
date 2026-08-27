import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
  type Firestore,
} from "firebase/firestore";

/**
 * Puerto de acceso a datos del Reinicio Profundo.
 *
 * Existe porque el reinicio es la operación más destructiva del producto y no
 * había forma de probarla: el servicio llamaba al SDK de Firestore directo, así
 * que ninguna prueba podía comprobar QUÉ borraba ni verificar las condiciones
 * que imponen las Rules. Los fallos que dejó ese punto ciego (lectura del
 * perfil del compañero, contadores de cuenta, lotes sin acotar) solo aparecían
 * contra el proyecto real.
 *
 * El puerto es deliberadamente estrecho: solo las cuatro operaciones que el
 * reinicio necesita. La implementación real vive abajo; la de pruebas puede
 * además hacer cumplir las Rules.
 */

export type ResetDoc = Readonly<{
  id: string;
  path: readonly string[];
  data: Record<string, unknown>;
}>;

export type ResetOp =
  | Readonly<{ kind: "delete"; path: readonly string[] }>
  | Readonly<{ kind: "set"; path: readonly string[]; data: Record<string, unknown> }>
  | Readonly<{ kind: "update"; path: readonly string[]; data: Record<string, unknown> }>;

export type MplusResetGateway = Readonly<{
  /** Lee un documento. `null` si no existe. */
  readDoc: (path: readonly string[]) => Promise<Record<string, unknown> | null>;
  /** Lista una colección o subcolección completa. */
  listCollection: (path: readonly string[]) => Promise<ResetDoc[]>;
  /**
   * Consulta de igualdad sobre una colección raíz, con uno o dos filtros.
   *
   * El segundo filtro no es un lujo: las Rules de `movements` solo permiten
   * LISTAR un documento de otra persona si está `active` (§9.5: en Papelera el
   * otro miembro pierde la lectura de inmediato). Una consulta solo por
   * `householdId` devuelve también los de Papelera de la pareja y el servidor
   * rechaza la consulta ENTERA con `Missing or insufficient permissions`.
   */
  queryByField: (
    collectionName: string,
    field: string,
    value: string,
    extra?: Readonly<{ field: string; value: string }>,
  ) => Promise<ResetDoc[]>;
  /** Aplica las operaciones de forma atómica (un `writeBatch`). */
  commit: (ops: readonly ResetOp[]) => Promise<void>;
}>;

const toDocRef = (db: Firestore, path: readonly string[]) =>
  doc(db, path[0], ...path.slice(1));

/** Implementación real contra Firestore. */
export const createFirestoreResetGateway = (db: Firestore): MplusResetGateway => ({
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

  commit: async (ops) => {
    const batch = writeBatch(db);
    for (const op of ops) {
      const ref = toDocRef(db, op.path);
      if (op.kind === "delete") batch.delete(ref);
      else if (op.kind === "set") batch.set(ref, op.data);
      else batch.update(ref, op.data);
    }
    await batch.commit();
  },
});
