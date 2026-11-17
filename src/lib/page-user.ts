import "server-only";
import { redirect } from "next/navigation";
import { requireUser } from "./auth";
import { HttpError } from "./http";
// Pages and layouts render independently. Each page that reads private data
// redirects on its own, rather than throwing an unhandled 401 during rendering.
export async function requirePageUser() {
  try {
    return await requireUser();
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) redirect("/login");
    throw error;
  }
}
