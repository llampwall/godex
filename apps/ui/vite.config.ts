import dotenv from "dotenv";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

dotenv.config({ path: "../../.env" });

const uiHost = process.env.UI_HOST && process.env.UI_HOST.trim() ? process.env.UI_HOST : "0.0.0.0";
const uiPort = Number(process.env.UI_PORT ?? 7777);

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
    VitePWA({
      registerType: "autoUpdate",
      manifest,
      includeAssets: ["godex.png", "pwa-192.png", "pwa-512.png"],
      manifestFilename: "manifest.webmanifest",
      workbox: {
        navigateFallback: "/ui/index.html",
        navigateFallbackAllowlist: [/^\/ui\//]
      }
    })
  ],
  server: {
    host: uiHost,
    port: uiPort,
    allowedHosts: ["central-command"]
  }
});
