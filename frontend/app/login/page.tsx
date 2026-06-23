import type { Metadata } from "next";
import LoginClient from "./LoginClient";

export const metadata: Metadata = {
  title: "Sign In — DebtMap",
  description: "Sign in to DebtMap to access your security dashboard.",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return <LoginClient />;
}
