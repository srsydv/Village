import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const root = path.dirname(fileURLToPath(import.meta.url));

// Tailwind's @supports probe uses relative color syntax. Some Android
// WebViews treat that as a broken stylesheet and paint nothing.
function androidWebViewCss() {
  const unsafeSupports = [
    "@supports (((-webkit-hyphens:none)) and (not (margin-trim:inline))) or ((-moz-orient:inline) and (not (color:rgb(from red r g b))))",
    "@supports (((-webkit-hyphens: none)) and (not (margin-trim: inline))) or ((-moz-orient: inline) and (not (color: rgb(from red r g b))))",
  ];

  function stripSupports(css, atRule) {
    const re = new RegExp(atRule.source, "g");
    let out = "";
    let cursor = 0;
    for (let match = re.exec(css); match; match = re.exec(css)) {
      out += css.slice(cursor, match.index);
      const open = match.index + match[0].length;
      if (css[open] !== "{") {
        cursor = open;
        continue;
      }
      let depth = 0;
      let end = open;
      for (; end < css.length; end += 1) {
        if (css[end] === "{") depth += 1;
        else if (css[end] === "}") {
          depth -= 1;
          if (depth === 0) {
            end += 1;
            break;
          }
        }
      }
      cursor = end;
      re.lastIndex = end;
    }
    return out + css.slice(cursor);
  }

  return {
    name: "android-webview-css",
    enforce: "post",
    transformIndexHtml(html) {
      return html.replaceAll(" crossorigin", "");
    },
    generateBundle(_options, bundle) {
      for (const item of Object.values(bundle)) {
        if (item.type !== "asset" || !String(item.fileName).endsWith(".css")) continue;
        let css = typeof item.source === "string" ? item.source : new TextDecoder().decode(item.source);
        for (const probe of unsafeSupports) css = css.split(probe).join("@supports (display:block)");
        css = stripSupports(css, /@supports\s*\(\s*color:\s*color-mix\([^)]*\)\s*\)/);
        css = css.replace(/@property\s+--[\w-]+\s*\{[^}]*\}/g, "");
        css = css.replace(/ in oklab/g, "");
        css = css.replace(/oklab\(14\.9994%\s*-\.00205025\s*-\.0207038\/\.25\)/g, "rgba(7,11,20,.25)");
        css = css.replace(/oklab\(14\.9994%\s*-\.00205025\s*-\.0207038\/\.45\)/g, "rgba(7,11,20,.45)");
        if (css.includes("margin-trim") || css.includes("rgb(from") || css.includes("@property") || css.includes("oklab")) {
          this.error("Android WebView CSS still contains a parser-breaking rule");
        }
        item.source = css;
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), androidWebViewCss()],
  base: process.env.VITE_CAPACITOR === "1" ? "./" : "/",
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
