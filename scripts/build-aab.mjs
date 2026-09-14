import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv(file) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) return;
  for (const line of fs.readFileSync(full, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null) process.env[key] = value;
  }
}

function run(cmd, args, extraEnv = {}, cwd = root) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: "inherit",
      env: { ...process.env, ...extraEnv },
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(" ")} exited ${code}`));
    });
  });
}

loadEnv(".env");
loadEnv(".env.local");

const publicUrl = String(process.env.PUBLIC_APP_URL || "").replace(/\/$/, "");
if (!publicUrl.startsWith("https://")) {
  console.error("Set PUBLIC_APP_URL to your live HTTPS origin, e.g. https://aurea.example.com");
  console.error("Host the Node app first (Docker / Railway / Render). The Play bundle must not contain GEMINI_API_KEY.");
  process.exit(1);
}

const androidDir = path.join(root, "android");
const propsPath = path.join(androidDir, "keystore.properties");
if (!fs.existsSync(propsPath)) {
  console.error("No upload key yet. Run: npm run play:key");
  process.exit(1);
}

const javaHome =
  process.env.JAVA_HOME ||
  "/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home";
const androidHome =
  process.env.ANDROID_HOME ||
  process.env.ANDROID_SDK_ROOT ||
  "/opt/homebrew/share/android-commandlinetools";

process.env.JAVA_HOME = javaHome;
process.env.ANDROID_HOME = androidHome;
process.env.ANDROID_SDK_ROOT = androidHome;
process.env.PATH = [
  path.join(javaHome, "bin"),
  path.join(androidHome, "platform-tools"),
  path.join(androidHome, "cmdline-tools", "latest", "bin"),
  process.env.PATH,
].join(path.delimiter);

console.log("Building web app for Play (no Gemini key in the bundle)…");
await run("npm", ["run", "build", "-w", "client"], {
  VITE_CAPACITOR: "1",
  VITE_API_BASE: publicUrl,
  VITE_GEMINI_API_KEY: "",
  VITE_GEMINI_MODEL: "",
});

if (!fs.existsSync(androidDir)) {
  console.log("Adding Android platform…");
  await run("npx", ["cap", "add", "android"]);
}

console.log("Syncing Capacitor…");
await run("npx", ["cap", "sync", "android"]);

const localProps = path.join(androidDir, "local.properties");
fs.writeFileSync(localProps, `sdk.dir=${androidHome.replaceAll("\\", "\\\\")}\n`);

console.log("Bundling signed release AAB…");
const gradlew = path.join(androidDir, "gradlew");
fs.chmodSync(gradlew, 0o755);
await run("./gradlew", ["bundleRelease"], { JAVA_HOME: javaHome, ANDROID_HOME: androidHome }, androidDir);

const built = path.join(androidDir, "app/build/outputs/bundle/release/app-release.aab");
if (!fs.existsSync(built)) {
  console.error("Gradle did not produce app-release.aab. Check signing (npm run play:key).");
  process.exit(1);
}

const outDir = path.join(root, "release");
fs.mkdirSync(outDir, { recursive: true });
const dest = path.join(outDir, "Aurea-play.aab");
fs.copyFileSync(built, dest);
console.log(`\nPlay bundle:\n${dest}\n`);
console.log("Upload this AAB in Play Console (internal testing first).");
console.log(`Privacy policy URL: ${publicUrl}/privacy.html`);
console.log("Keep GEMINI_API_KEY only on the server. Do not put it in the Android app.");
