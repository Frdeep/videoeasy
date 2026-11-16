import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
export default async function Admin() {
  await requireUser();
  notFound();
}
