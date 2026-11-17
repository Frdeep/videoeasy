import { AuthCallback } from "@/components/auth-callback";
export const metadata = {
  title: "Vérification de connexion · VideoEasy",
  referrer: "no-referrer",
};
export const dynamic = "force-dynamic";
export default function Callback() {
  return <AuthCallback />;
}
