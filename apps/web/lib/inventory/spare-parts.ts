import {
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  type Transaction,
  where,
  writeBatch,
} from "firebase/firestore";
import { ApiError, api } from "@/lib/api-client";
import { usesApi } from "@/lib/data/flags";
import { dataChanged } from "@/lib/data/live";
import { appendAuditLog } from "@/lib/firebase/audit-log";
import { db } from "@/lib/firebase/firebase-client";

export type SparePartStatus = "in_stock" | "assigned" | "scrapped";

export type SparePart = {
  id: string;
  partId: string;
  partIdKey: string;
  description: string;
  status: SparePartStatus;
  vehicleId: string | null;
  assignedAt?: Date;
  createdAt?: Date;
};

export class InventoryError extends Error {}

/** Normalised part ID used for uniqueness and search. */
export function partIdKey(partId: string) {
  return partId.trim().toLowerCase();
}

const partsCol = (companyId: string) =>
  collection(db, "companies", companyId, "spareParts");
const partRef = (companyId: string, id: string) =>
  doc(db, "companies", companyId, "spareParts", id);
// Claim docs guarantee one active part per part ID (doc id = encoded key).
const claimRef = (companyId: string, key: string) =>
  doc(db, "companies", companyId, "sparePartIds", encodeURIComponent(key));

function audit(
  tx: Transaction,
  companyId: string,
  userId: string,
  action: string,
  description: string,
) {
  tx.set(doc(collection(db, "auditLogs")), {
    userId,
    companyId,
    action,
    description,
    entityStatus: true,
    createdAt: serverTimestamp(),
  });
}

/** API mode ("inventory" slice): one server call, messages shown like local errors. */
async function inventoryApi(
  path: string,
  method: "post" | "patch" | "delete",
  body?: unknown,
) {
  try {
    const { data } = await api.request({ url: path, method, data: body });
    dataChanged();
    return data as { count?: number };
  } catch (error) {
    if (error instanceof ApiError) throw new InventoryError(error.message);
    throw error;
  }
}

export async function createPart(
  companyId: string,
  userId: string,
  data: { partId: string; description: string },
) {
  const partId = data.partId.trim();
  const key = partIdKey(partId);
  if (!key) throw new InventoryError("Part ID is required.");
  if (usesApi("inventory")) {
    await inventoryApi(`/companies/${companyId}/spare-parts`, "post", {
      partId,
      description: data.description,
    });
    return;
  }
  const newRef = doc(partsCol(companyId));

  await runTransaction(db, async (tx) => {
    const claim = await tx.get(claimRef(companyId, key));
    if (claim.exists()) {
      throw new InventoryError(`Part ID ${partId} is already in inventory.`);
    }
    tx.set(claimRef(companyId, key), { partDocId: newRef.id });
    tx.set(newRef, {
      partId,
      partIdKey: key,
      description: data.description.trim(),
      status: "in_stock",
      vehicleId: null,
      entityStatus: true,
      createdAt: serverTimestamp(),
      createdBy: userId,
    });
    audit(
      tx,
      companyId,
      userId,
      "create",
      `Spare part ${partId} added to stock`,
    );
  });
}

export async function updatePart(
  companyId: string,
  userId: string,
  id: string,
  data: { partId: string; description: string },
) {
  const partId = data.partId.trim();
  const key = partIdKey(partId);
  if (!key) throw new InventoryError("Part ID is required.");
  if (usesApi("inventory")) {
    await inventoryApi(`/companies/${companyId}/spare-parts/${id}`, "patch", {
      partId,
      description: data.description,
    });
    return;
  }

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(partRef(companyId, id));
    if (!snap.exists()) throw new InventoryError("This part no longer exists.");
    const oldKey = snap.data().partIdKey as string;

    if (key !== oldKey) {
      const claim = await tx.get(claimRef(companyId, key));
      if (claim.exists()) {
        throw new InventoryError(`Part ID ${partId} is already in inventory.`);
      }
      tx.delete(claimRef(companyId, oldKey));
      tx.set(claimRef(companyId, key), { partDocId: id });
    }

    tx.update(partRef(companyId, id), {
      partId,
      partIdKey: key,
      description: data.description.trim(),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });
    audit(tx, companyId, userId, "update", `Spare part ${partId} updated`);
  });
}

export async function deletePart(
  companyId: string,
  userId: string,
  id: string,
) {
  if (usesApi("inventory")) {
    await inventoryApi(`/companies/${companyId}/spare-parts/${id}`, "delete");
    return;
  }
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(partRef(companyId, id));
    if (!snap.exists()) return;
    const data = snap.data();
    if (data.status === "assigned") {
      throw new InventoryError(
        "Remove this part from its vehicle before deleting it.",
      );
    }
    tx.delete(claimRef(companyId, data.partIdKey as string));
    tx.update(partRef(companyId, id), {
      entityStatus: false,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });
    audit(tx, companyId, userId, "delete", `Spare part ${data.partId} deleted`);
  });
}

export async function assignPart(
  companyId: string,
  userId: string,
  id: string,
  vehicle: { id: string; name: string },
) {
  if (usesApi("inventory")) {
    await inventoryApi(
      `/companies/${companyId}/spare-parts/${id}/assign`,
      "post",
      {
        vehicleId: vehicle.id,
      },
    );
    return;
  }
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(partRef(companyId, id));
    if (!snap.exists()) throw new InventoryError("This part no longer exists.");
    const data = snap.data();
    if (data.status !== "in_stock") {
      throw new InventoryError(
        "This part was just assigned or scrapped by someone else.",
      );
    }
    tx.update(partRef(companyId, id), {
      status: "assigned",
      vehicleId: vehicle.id,
      assignedAt: serverTimestamp(),
      assignedBy: userId,
    });
    audit(
      tx,
      companyId,
      userId,
      "update",
      `Spare part ${data.partId} assigned to ${vehicle.name}`,
    );
  });
}

export async function releasePart(
  companyId: string,
  userId: string,
  id: string,
  mode: "stock" | "scrapped",
  vehicleName: string,
) {
  if (usesApi("inventory")) {
    void vehicleName;
    await inventoryApi(
      `/companies/${companyId}/spare-parts/${id}/release`,
      "post",
      { mode },
    );
    return;
  }
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(partRef(companyId, id));
    if (!snap.exists()) throw new InventoryError("This part no longer exists.");
    const data = snap.data();
    if (data.status !== "assigned") {
      throw new InventoryError("This part is no longer on a vehicle.");
    }
    tx.update(partRef(companyId, id), {
      status: mode === "stock" ? "in_stock" : "scrapped",
      vehicleId: null,
      assignedAt: null,
      assignedBy: null,
      ...(mode === "scrapped"
        ? { scrappedAt: serverTimestamp(), scrappedBy: userId }
        : {}),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });
    audit(
      tx,
      companyId,
      userId,
      "update",
      mode === "stock"
        ? `Spare part ${data.partId} removed from ${vehicleName} and returned to stock`
        : `Spare part ${data.partId} removed from ${vehicleName} and scrapped`,
    );
  });
}

/** Returns every part on a vehicle to stock (used before deleting it). */
export async function releaseAllForVehicle(
  companyId: string,
  userId: string,
  vehicle: { id: string; name: string },
) {
  if (usesApi("inventory")) {
    const result = await inventoryApi(
      `/companies/${companyId}/vehicles/${vehicle.id}/release-parts`,
      "post",
    );
    return result.count ?? 0;
  }
  const snap = await getDocs(
    query(
      partsCol(companyId),
      where("vehicleId", "==", vehicle.id),
      where("status", "==", "assigned"),
    ),
  );
  if (snap.empty) return 0;

  const batch = writeBatch(db);
  for (const part of snap.docs) {
    batch.update(part.ref, {
      status: "in_stock",
      vehicleId: null,
      assignedAt: null,
      assignedBy: null,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });
  }
  appendAuditLog(batch, {
    userId,
    companyId,
    action: "update",
    description: `${snap.size} spare part${snap.size === 1 ? "" : "s"} returned to stock from ${vehicle.name}`,
  });
  await batch.commit();
  return snap.size;
}
