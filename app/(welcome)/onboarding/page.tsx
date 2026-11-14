import { SetupScreen } from "@/components/onboarding/setup-screen";
import { InteractionLayersProvider } from "@/components/interaction-layers";
import { ChatGPTUIProvider } from "@/components/settings/chatgpt-connection";
import { NativeSubscriptionUIProvider } from "@/components/settings/subscription-connections";

export const metadata = { title: "Make it yours · Cognera" };

export default function OnboardingPage() {
	return (
		<InteractionLayersProvider>
			<ChatGPTUIProvider>
				<NativeSubscriptionUIProvider>
					<SetupScreen />
				</NativeSubscriptionUIProvider>
			</ChatGPTUIProvider>
		</InteractionLayersProvider>
	);
}
