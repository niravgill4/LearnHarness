/**
 * Cognera's compact cognition mark: a C-shaped neural path with three
 * connected points. It is stroke-based so it inherits the active theme color.
 */
export function CogneraMark({ className = "" }: { className?: string }) {
	return (
		<svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
			<path d="M23.5 7.5A11.5 11.5 0 1 0 24 24" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
			<path d="M11 16h5.2l3.4-4.5M16.2 16l3.4 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
			<circle cx="10.5" cy="16" r="2.1" fill="currentColor" />
			<circle cx="20.2" cy="11.1" r="2.1" fill="currentColor" />
			<circle cx="20.2" cy="20.9" r="2.1" fill="currentColor" />
		</svg>
	);
}
