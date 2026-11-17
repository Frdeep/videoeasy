"use client";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useEditor } from "@/editor/use-editor";
import { importFromVideoEasy } from "./bridge";

/** Runs once when the editor is opened from VideoEasy with ?import=<ref>. */
export function VideoEasyImport() {
	const editor = useEditor();
	const project = useEditor((e) => e.project.getActive());
	const done = useRef(false);
	useEffect(() => {
		if (done.current || !project) return;
		const ref = new URLSearchParams(location.search).get("import");
		if (!ref) return;
		done.current = true;
		history.replaceState(null, "", location.pathname);
		const p = importFromVideoEasy(editor, ref);
		toast.promise(p, {
			loading: "Ouverture de votre vidéo…",
			success: (d) => (d.cues.length ? "Vidéo et sous-titres prêts à modifier." : "Vidéo prête à modifier."),
			error: "Impossible d’ouvrir la vidéo. Réessayez depuis VideoEasy.",
		});
	}, [project, editor]);
	return null;
}
