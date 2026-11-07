import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/firebase-admin";

/** Sign-in address given to a removed account so its real email can be reused. */
function removedEmailFor(uid: string) {
  return `removed+${uid}@removed.invalid`;
}

/**
 * Removes a user without deleting them: the Auth account is disabled and its
 * email released, while users/{uid} stays so audit logs keep their name.
 */
export async function POST(req: Request) {
  try {
    const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
    if (!token) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }
    const caller = await adminAuth.verifyIdToken(token);
    const callerDoc = await adminDb.collection("users").doc(caller.uid).get();
    const callerRole = callerDoc.get("role");
    if (
      callerDoc.get("entityStatus") === false ||
      (callerRole !== "admin" && callerRole !== "manager")
    ) {
      return NextResponse.json(
        { error: "Only admins and managers can remove users" },
        { status: 403 },
      );
    }

    const { uid } = await req.json();
    if (typeof uid !== "string" || !uid) {
      return NextResponse.json({ error: "uid is required" }, { status: 400 });
    }
    if (uid === caller.uid) {
      return NextResponse.json(
        { error: "You can't remove your own account" },
        { status: 400 },
      );
    }

    const userRef = adminDb.collection("users").doc(uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (userDoc.get("entityStatus") === false) {
      return NextResponse.json(
        { error: "User is already removed" },
        { status: 409 },
      );
    }
    if (userDoc.get("role") === "admin" && callerRole !== "admin") {
      return NextResponse.json(
        { error: "Only admins can remove admins" },
        { status: 403 },
      );
    }

    const username: string = userDoc.get("username") ?? uid;
    const email: string | null = userDoc.get("email") ?? null;

    // Free the email in Auth first; if this fails nothing has changed yet.
    try {
      const authUser = await adminAuth.getUser(uid);
      // Linked sign-ins (e.g. Google) are keyed by provider id, not email, so
      // unlink them too or the new account can't use the same Google login.
      const providersToUnlink = authUser.providerData
        .map((provider) => provider.providerId)
        .filter((providerId) => providerId !== "password");
      await adminAuth.updateUser(uid, {
        email: removedEmailFor(uid),
        disabled: true,
        ...(providersToUnlink.length ? { providersToUnlink } : {}),
      });
      await adminAuth.revokeRefreshTokens(uid);
    } catch (error) {
      // Auth account already deleted by hand: the email is free anyway.
      if ((error as { code?: string })?.code !== "auth/user-not-found") {
        throw error;
      }
    }

    const batch = adminDb.batch();
    batch.update(userRef, {
      email: null,
      removedEmail: email,
      entityStatus: false,
      removedAt: FieldValue.serverTimestamp(),
      removedBy: caller.uid,
    });
    batch.set(adminDb.collection("auditLogs").doc(), {
      userId: caller.uid,
      targetUserId: uid,
      action: "delete",
      description: `User removed: ${username}${email ? ` (${email})` : ""}`,
      entityStatus: true,
      createdAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();

    return NextResponse.json({ message: "User removed" });
  } catch (error) {
    console.error("Error removing user:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to remove user",
      },
      { status: 500 },
    );
  }
}
