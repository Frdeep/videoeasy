"use client";
import { useEffect, useState, type ReactNode } from "react";

/** The editor is part of VideoEasy: only signed-in VideoEasy users get in.
 * The session lives in VideoEasy's cookies (same domain, /editor zone). */
export function VideoEasyGate({ children }: { children: ReactNode }) {
	const [state, setState] = useState<"checking" | "ok">("checking");
	useEffect(() => {
		fetch("/api/editor/session", { credentials: "include", cache: "no-store" })
			.then((r) => {
				if (r.ok) setState("ok");
				else location.assign(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
			})
			.catch(() => location.assign("/login"));
	}, []);
	if (state !== "ok")
		return (
			<div className="flex h-screen w-screen items-center justify-center text-sm text-muted-foreground">
				VideoEasy…
			</div>
		);
	return <>{children}</>;
}
