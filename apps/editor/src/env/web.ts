import { z } from "zod";

// VideoEasy editor (stripped OpenCut classic): no database, no own auth.
// The session is checked against VideoEasy (same domain, /editor zone).
const webEnvSchema = z.object({
	NODE_ENV: z.enum(["development", "production", "test"]),
	ANALYZE: z.string().optional(),
	NEXT_RUNTIME: z.enum(["nodejs", "edge"]).optional(),
	NEXT_PUBLIC_SITE_URL: z.url().default("https://videoeasy-gamma.vercel.app"),
	FREESOUND_CLIENT_ID: z.string().optional(),
	FREESOUND_API_KEY: z.string().optional(),
});

export type WebEnv = z.infer<typeof webEnvSchema>;

export const webEnv = webEnvSchema.parse(process.env);
