export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { HttpError } from "@/lib/http";
import type { ReactNode } from "react";
export default async function PrivateLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
    redirect("/login?setup=1");
  try {
    await requireUser();
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) redirect("/login");
    throw error;
  }
  return children;
}
