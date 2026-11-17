import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	// Served by VideoEasy under /editor (Next.js multi-zones).
	basePath: "/editor",
	// Same repo as VideoEasy: keep Turbopack and file tracing inside this app,
	// otherwise Next picks up VideoEasy's root files (src/proxy.ts…).
	turbopack: { root: path.resolve(__dirname) },
	outputFileTracingRoot: path.resolve(__dirname),
	compiler: {
		removeConsole: process.env.NODE_ENV === "production",
	},
	reactStrictMode: true,
	productionBrowserSourceMaps: true,
		images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "plus.unsplash.com",
			},
			{
				protocol: "https",
				hostname: "images.unsplash.com",
			},
			{
				protocol: "https",
				hostname: "images.marblecms.com",
			},
			{
				protocol: "https",
				hostname: "lh3.googleusercontent.com",
			},
			{
				protocol: "https",
				hostname: "avatars.githubusercontent.com",
			},
			{
				protocol: "https",
				hostname: "api.iconify.design",
			},
			{
				protocol: "https",
				hostname: "api.simplesvg.com",
			},
			{
				protocol: "https",
				hostname: "api.unisvg.com",
			},
			{
				protocol: "https",
				hostname: "cdn.brandfetch.io",
			},
		],
	},
};

export default nextConfig;
