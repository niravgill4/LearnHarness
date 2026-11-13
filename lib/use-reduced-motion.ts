"use client";

import { useSyncExternalStore } from "react";

const query = "(prefers-reduced-motion: reduce)";
const snapshot = () => window.matchMedia(query).matches;
const serverSnapshot = () => true;
function subscribe(onChange: () => void) {
	const media = window.matchMedia(query);
	media.addEventListener("change", onChange);
	return () => media.removeEventListener("change", onChange);
}

/** Responds immediately when the OS preference changes in an open page. */
export function useReducedMotionPreference() {
	return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
