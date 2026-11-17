import type { EditorCore } from "@/core";
import { processMediaAssets } from "@/media/processing";
import { AddMediaAssetCommand } from "@/commands/media";
import { InsertElementCommand } from "@/commands/timeline";
import { BatchCommand } from "@/commands";
import { buildElementFromMedia } from "@/timeline/element-utils";
import { mediaTimeFromSeconds } from "@/wasm";
import { insertCaptionChunksAsTextTrack } from "@/subtitles/insert";
import type { SubtitleCue, SubtitleStyleOverrides } from "@/subtitles/types";

// VideoEasy ⇄ editor bridge. All calls go to VideoEasy's own API on the same
// domain (absolute /api/... paths are outside the /editor zone).

export type Ref = string; // job:<id> | montage:<id> | short:<id>:<n>

type Opened = {
	url: string;
	name: string;
	ratio: "9:16" | "16:9" | "1:1";
	captionStyle: string | null;
	cues: { start: number; end: number; text: string }[];
};

const SIZES = {
	"9:16": { width: 1080, height: 1920 },
	"16:9": { width: 1920, height: 1080 },
	"1:1": { width: 1080, height: 1080 },
} as const;

/** Same looks as the burned-in shorts captions, as editable text. */
function captionLook(style: string | null): SubtitleStyleOverrides {
	const placement = { verticalAlign: "bottom" as const, marginVerticalRatio: 0.27 };
	switch (style) {
		case "bold":
			return { fontFamily: "Anton", fontSizeRatioOfPlayHeight: 0.085, color: "#ffffff", fontWeight: "normal", placement };
		case "box":
			return {
				fontFamily: "Poppins",
				fontSizeRatioOfPlayHeight: 0.045,
				color: "#141414",
				fontWeight: "bold",
				background: { enabled: true, color: "#FFC800" },
				placement,
			};
		case "pop":
			return { fontFamily: "Poppins", fontSizeRatioOfPlayHeight: 0.062, color: "#ffffff", fontWeight: "bold", placement };
		case "minimal":
			return { fontFamily: "Inclusive Sans", fontSizeRatioOfPlayHeight: 0.04, color: "#ffffff", fontWeight: "normal", placement };
		default:
			return { fontFamily: "Poppins", fontSizeRatioOfPlayHeight: 0.055, color: "#ffffff", fontWeight: "bold", placement };
	}
}

export async function importFromVideoEasy(editor: EditorCore, ref: Ref) {
	const r = await fetch(`/api/editor/import?ref=${encodeURIComponent(ref)}`, { credentials: "include" });
	if (!r.ok) throw new Error("import_failed");
	const data = (await r.json()) as Opened;
	const project = editor.project.getActive();
	if (!project) throw new Error("no_project");

	await editor.project.updateSettings({
		settings: { canvasSize: SIZES[data.ratio] ?? SIZES["9:16"], canvasSizeMode: "custom" },
		pushHistory: false,
	});

	const blob = await fetch(data.url).then((x) => {
		if (!x.ok) throw new Error("download_failed");
		return x.blob();
	});
	const file = new File([blob], `${data.name}.mp4`, { type: blob.type || "video/mp4" });
	const [asset] = await processMediaAssets({ files: [file] });
	if (!asset) throw new Error("process_failed");
	const addMedia = new AddMediaAssetCommand({ projectId: project.metadata.id, asset });
	const element = buildElementFromMedia({
		mediaId: addMedia.getAssetId(),
		mediaType: asset.type,
		name: asset.name,
		duration: mediaTimeFromSeconds({ seconds: asset.duration ?? 5 }),
		startTime: mediaTimeFromSeconds({ seconds: 0 }),
	});
	editor.command.execute({
		command: new BatchCommand([addMedia, new InsertElementCommand({ element, placement: { mode: "auto", trackType: "video" } })]),
	});

	if (data.cues.length) {
		const style = captionLook(data.captionStyle);
		const captions: SubtitleCue[] = data.cues
			.filter((c) => c.text.trim() && c.end > c.start)
			.map((c) => ({ text: c.text, startTime: c.start, duration: c.end - c.start, style }));
		insertCaptionChunksAsTextTrack({ editor, captions });
	}
	return data;
}

/** Sends an exported video back to VideoEasy (it appears in Créations). */
export async function sendToVideoEasy({
	buffer,
	mimeType,
	name,
	ratio,
}: {
	buffer: ArrayBuffer;
	mimeType: string;
	name: string;
	ratio: "9:16" | "16:9" | "1:1";
}) {
	const id = crypto.randomUUID();
	const type = mimeType.startsWith("video/webm") ? "video/webm" : "video/mp4";
	const start = await fetch("/api/editor/export", {
		method: "POST",
		credentials: "include",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ id, bytes: buffer.byteLength, type, ratio, name: name.slice(0, 120) }),
	});
	if (!start.ok) throw new Error("export_refused");
	const { uploadUrl, key } = (await start.json()) as { uploadUrl: string; key: string };
	const put = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": type }, body: buffer });
	if (!put.ok) throw new Error("upload_failed");
	const done = await fetch(`/api/editor/export/${id}`, {
		method: "POST",
		credentials: "include",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ key }),
	});
	if (!done.ok) throw new Error("finish_failed");
	return id;
}

export function ratioOf(size: { width: number; height: number }): "9:16" | "16:9" | "1:1" {
	const r = size.width / size.height;
	return r > 1.2 ? "16:9" : r < 0.85 ? "9:16" : "1:1";
}
