import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	// elkjs conditionally requires 'web-worker' for Node.js environments only;
	// in the browser it falls back gracefully. Mark it external in both the
	// esbuild dep-optimizer (dev) and the Rollup bundler (build).
	optimizeDeps: {
		esbuildOptions: {
			plugins: [
				{
					name: 'exclude-web-worker',
					setup(build) {
						build.onResolve({ filter: /^web-worker$/ }, () => ({
							path: 'web-worker',
							external: true,
						}));
					},
				},
			],
		},
	},
	build: {
		// elkjs is ~1.4 MB minified — it's an inherently large layout engine.
		// The warning threshold is raised to avoid false-positive noise.
		chunkSizeWarningLimit: 1600,
		rollupOptions: {
			external: ['web-worker'],
		},
	},
});
