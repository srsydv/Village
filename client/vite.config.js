import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const root = path.dirname(fileURLToPath(import.meta.url));

// Tailwind v4 emits a relative-color @supports probe. Android WebViews
// older than Chrome 111 drop the whole page when they parse it.
// https://tailwindcss.com/docs/compatibility#browser-support
function androidWebViewCss() {
  const probes = [
    "@supports (((-webkit-hyphens:none)) and (not (margin-trim:inline))) or ((-moz-orient:inline) and (not (color:rgb(from red r g b))))",
    "@supports (((-webkit-hyphens: none)) and (not (margin-trim: inline))) or ((-moz-orient: inline) and (not (color: rgb(from red r g b))))",
  ];

  return {
    name: "android-webview-css",
    enforce: "post",
    generateBundle(_options, bundle) {
      for (const item of Object.values(bundle)) {
        if (item.type !== "asset" || !String(item.fileName).endsWith(".css")) continue;
        let css = typeof item.source === "string" ? item.source : new TextDecoder().decode(item.source);
        for (const probe of probes) css = css.split(probe).join("@supports (display:block)");
        css = css.replace(/@supports\s*\(\s*color:\s*color-mix\([^)]*\)\s*\)/g, "@supports (display:block)");
        css = css.replace(/@property\s+--[\w-]+\s*\{[^}]*\}/g, "");
        css = css.replace(/color-mix\(in oklab,[^)]*\)/g, "rgba(107,114,128,.55)");
        css = css.replace(/ in oklab/g, "");
        css = css.replace(/oklab\(14\.9994%\s*-\.00205025\s*-\.0207038\/\.25\)/g, "rgba(7,11,20,.25)");
        css = css.replace(/oklab\(14\.9994%\s*-\.00205025\s*-\.0207038\/\.45\)/g, "rgba(7,11,20,.45)");
        for (const needle of ["rgb(from", "margin-trim", "@property", "oklab"]) {
          const at = css.indexOf(needle);
          if (at >= 0) {
            this.error(`Android WebView CSS still contains ${needle}: ${css.slice(Math.max(0, at - 80), at + 120)}`);
          }
        }
        item.source = css;
      }
    },
  };
}

function capacitorHtml() {
  return {
    name: "capacitor-webview-html",
    transformIndexHtml(html) {
      return html.replaceAll(" crossorigin", "");
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), androidWebViewCss(), capacitorHtml()],
  build: {
    target: "chrome89",
    modulePreload: false,
  },
  base: "/",
  resolve: {
    alias: {
      "@": path.join(root, "src"),
    },
  },
  server: {
    port: 5173,
    host: "127.0.0.1",
    proxy: {
      "/api": "http://127.0.0.1:3001",
    },
  },
});
