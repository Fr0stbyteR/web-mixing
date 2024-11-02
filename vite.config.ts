import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig((configEnv) => ({
    base: './',
    build: {
        rollupOptions: {
            output: {
                entryFileNames: `[name].js`,
                chunkFileNames: `[name].js`,
                assetFileNames: `assets/[name].[ext]`
            }
        },
        emptyOutDir: true,
        minify: configEnv.mode !== "development",
        sourcemap: configEnv.mode === "development" ? "inline" as const : false
    },
    plugins: [react()],
    css: {
        preprocessorOptions: {
            scss: {
                api: 'modern-compiler' // or "modern"
            }
        }
    }
}));
