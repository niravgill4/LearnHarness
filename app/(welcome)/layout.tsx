import { OnboardingFrame } from "@/components/onboarding/onboarding-shell";

/** The artwork survives navigation between sign-in and account setup. */
export default function WelcomeLayout({ children }: { children: React.ReactNode }) {
	return <OnboardingFrame>{children}</OnboardingFrame>;
}
