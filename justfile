# plugin-link justfile

# Default recipe: start the dev server
default:
    npm run dev

# Start Tauri desktop dev (wraps Vite dev server in a native window)
tauri-dev:
    npm run tauri:dev

# Build Tauri desktop app bundle (.app / .exe / .deb)
tauri-build:
    npm run tauri:build
