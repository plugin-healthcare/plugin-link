import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	build: {
		// elkjs/lib/elk.bundled.js is ~1.4 MB minified — it's an inherently large layout engine.
		// The warning threshold is raised to avoid false-positive noise.
		chunkSizeWarningLimit: 1600,
	},
});
