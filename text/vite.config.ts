import { defineConfig } from "vite";

export default defineConfig({
    root: "./src",
    clearScreen: false,
    server: {
        port: 8398,
        strictPort: true,
    },
    build: {
        outDir: "./build",
        minify: false,
        sourcemap: true,
    },
});
