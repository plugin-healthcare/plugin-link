import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	build: {
		// elkjs is ~1.4 MB minified — it's an inherently large layout engine.
		// The warning threshold is raised to avoid false-positive noise.
		chunkSizeWarningLimit: 1600,
		rollupOptions: {
			// elkjs conditionally requires 'web-worker' for Node.js environments only;
			// in the browser it falls back gracefully — mark it external to silence the warning.
			external: ['web-worker'],
		},
	},
});
