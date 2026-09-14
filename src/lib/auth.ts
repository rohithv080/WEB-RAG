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
