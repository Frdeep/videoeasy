"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useEditor } from "@/editor/use-editor";

/** /editor/open?ref=short:<id>:<n> — creates a project and opens it with the
 * VideoEasy video (and its captions) loaded. */
export default function OpenFromVideoEasy() {
	const editor = useEditor();
	const router = useRouter();
	const started = useRef(false);
	useEffect(() => {
		if (started.current) return;
		started.current = true;
		const ref = new URLSearchParams(location.search).get("ref") ?? "";
		if (!/^(job|montage|short):/.test(ref)) {
			router.replace("/projects");
			return;
		}
		const name = ref.startsWith("short:") ? "Short VideoEasy" : ref.startsWith("job:") ? "Vidéo IA VideoEasy" : "Montage VideoEasy";
		void editor.project
			.createNewProject({ name })
			.then((id) => router.replace(`/editor/${id}?import=${encodeURIComponent(ref)}`));
	}, [editor, router]);
	return (
		<div className="flex h-screen w-screen items-center justify-center text-sm text-muted-foreground">
			Préparation de l’éditeur…
		</div>
	);
}
