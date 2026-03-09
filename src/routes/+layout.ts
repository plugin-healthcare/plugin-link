// Pure client-side SPA — no SSR.
// prerender is intentionally omitted: Tauri requires SPA mode (single index.html entry point),
// and GitHub Pages works fine with the 404.html fallback without full prerender.
export const ssr = false;
