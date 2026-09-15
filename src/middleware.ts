import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Define public routes that do not require authentication
const isPublicRoute = createRouteMatcher([
  "/",
  "/embed/(.*)",
  "/widget.js",
  "/api/chat(.*)",
  "/api/telegram(.*)",
  "/api/discord(.*)",
  "/api/sites(.*)",
  "/api/feedback(.*)",
  "/api/cron(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    // Permit CLI scripts / automated runners with valid admin secret
    const adminSecret = process.env.ADMIN_SECRET;
    const providedSecret = request.headers.get("x-admin-secret");
    if (adminSecret && providedSecret && providedSecret === adminSecret) {
      return;
    }

    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
