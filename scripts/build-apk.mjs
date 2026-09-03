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

if (!process.env.GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY is missing in .env — the test APK needs it to answer on a phone.");
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

console.log("Building web app for Android…");
await run("npm", ["run", "build", "-w", "client"], {
  VITE_CAPACITOR: "1",
  VITE_GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  VITE_GEMINI_MODEL: process.env.GEMINI_MODEL || "",
});

const androidDir = path.join(root, "android");
if (!fs.existsSync(androidDir)) {
  console.log("Adding Android platform…");
  await run("npx", ["cap", "add", "android"]);
}

console.log("Syncing Capacitor…");
await run("npx", ["cap", "sync", "android"]);

const localProps = path.join(androidDir, "local.properties");
fs.writeFileSync(localProps, `sdk.dir=${androidHome.replaceAll("\\", "\\\\")}\n`);

console.log("Assembling debug APK…");
const gradlew = path.join(androidDir, "gradlew");
fs.chmodSync(gradlew, 0o755);
await run("./gradlew", ["assembleDebug"], { JAVA_HOME: javaHome, ANDROID_HOME: androidHome }, androidDir);

const built = path.join(androidDir, "app/build/outputs/apk/debug/app-debug.apk");
const outDir = path.join(root, "release");
fs.mkdirSync(outDir, { recursive: true });
const dest = path.join(outDir, "Aurea-testing.apk");
fs.copyFileSync(built, dest);
console.log(`\nAPK ready:\n${dest}\n`);
console.log("Send that file. On Android: open it, allow Install from this source, then Install.");
