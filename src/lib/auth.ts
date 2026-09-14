import { auth, currentUser } from "@clerk/nextjs/server";

export type AuthContext = {
  userId: string | null;
  email: string | null;
  isAdmin: boolean;
};

/**
 * Retrieves the current authenticated user and determines if they possess Super Admin privileges.
 */
export async function getAuthUser(): Promise<AuthContext> {
  try {
    const authData = await auth();
    const userId = authData.userId || null;
    if (!userId) {
      return { userId: null, email: null, isAdmin: false };
    }

    const user = await currentUser();
    const userEmails =
      user?.emailAddresses?.map((e) => e.emailAddress.toLowerCase()) || [];

    const configuredAdmins = (process.env.ADMIN_EMAIL || "rohithjune05@gmail.com")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    const isAdmin = userEmails.some((email) => configuredAdmins.includes(email));

    return {
      userId,
      email: userEmails[0] || null,
      isAdmin,
    };
  } catch (err) {
    console.error("[auth] Failed to resolve auth context:", err);
    return { userId: null, email: null, isAdmin: false };
  }
}

/**
 * Verifies that an incoming request is authorized to ingest data (scrape, upload, crawl).
 * Permitted if:
 * 1. Has an active Clerk user session (`userId`).
 * 2. OR provides a valid `x-admin-secret` header matching ADMIN_SECRET.
 */
export async function verifyIngestionAuth(headers?: Headers): Promise<{
  authorized: boolean;
  userId: string | null;
  isAdmin: boolean;
  error?: string;
  status: number;
}> {
  // 1. Check admin secret header (CLI scripts / maintenance tools)
  const adminSecret = process.env.ADMIN_SECRET;
  if (adminSecret && headers) {
    const providedSecret = headers.get("x-admin-secret");
    if (providedSecret && providedSecret === adminSecret) {
      return { authorized: true, userId: null, isAdmin: true, status: 200 };
    }
  }

  // 2. Check Clerk user session
  const { userId, isAdmin } = await getAuthUser();
  if (userId) {
    return { authorized: true, userId, isAdmin, status: 200 };
  }

  return {
    authorized: false,
    userId: null,
    isAdmin: false,
    error: "Authentication required to create or modify knowledge bots. Please sign in.",
    status: 401,
  };
}
