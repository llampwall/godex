import dotenv from "dotenv";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

dotenv.config({ path: "../../.env" });

const uiHost = process.env.UI_HOST?.trim() || "0.0.0.0";
const uiPort = Number(process.env.UI_PORT ?? 5174);

const manifest = {
  name: "godex",
  short_name: "godex",
  start_url: "/ui",
  scope: "/ui/",
  display: "standalone",
  background_color: "#000000",
  theme_color: "#000000",
  icons: [
    { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
    { src: "pwa-512.png", sizes: "512x512", type: "image/png" }
  ],
  share_target: {
    action: "/ui/share",
    method: "GET",
    enctype: "application/x-www-form-urlencoded",
    params: {
      title: "title",
      text: "text",
      url: "url"
    }
  }
};

export default defineConfig({
  base: "/ui/",
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      manifest,
      includeAssets: ["godex.png", "pwa-192.png", "pwa-512.png"],
      manifestFilename: "manifest.webmanifest",
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: "/ui/index.html",
        navigateFallbackAllowlist: [/^\/ui\//]
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  server: {
    host: uiHost,
    port: uiPort,
    allowedHosts: ["central-command"]
  }
});
