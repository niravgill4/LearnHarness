"use client";

import type { ComponentProps } from "react";

/** The core and controlled plugin pickers share the very same trigger renderer. */
export function ModelPickerPill({ children, ...props }: ComponentProps<"button">) {
	return <button type="button" {...props}
		className="model-picker-trigger flex min-w-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 font-ui text-xs transition-colors hover:bg-accent">
		<span className="min-w-0 truncate text-card-foreground">{children}</span>
		<span aria-hidden className="text-xs text-muted-foreground">▾</span>
	</button>;
}
