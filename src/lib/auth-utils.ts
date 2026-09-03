import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";

export { formatIST, formatDateIST, utcNow, todayDate, daysBetween } from "./date-utils";

export async function getSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session;
}

export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

export async function requireAdmin() {
  const session = await requireAuth();
  if (session.user.role !== "admin") {
    redirect("/today");
  }
  return session;
}
