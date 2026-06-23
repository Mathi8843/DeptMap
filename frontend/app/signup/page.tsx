import type { Metadata } from "next";
import SignupClient from "./SignupClient";

export const metadata: Metadata = {
  title: "Sign Up — DebtMap",
  description: "Create your DebtMap account. Free forever for 1 repository.",
  robots: { index: false, follow: false },
};

export default function SignupPage() {
  return <SignupClient />;
}
