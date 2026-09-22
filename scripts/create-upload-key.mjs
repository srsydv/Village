import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const androidDir = path.join(root, "android");
const storeFile = "safar-upload.jks";
const jks = path.join(androidDir, storeFile);
const propsPath = path.join(androidDir, "keystore.properties");

const javaHome =
  process.env.JAVA_HOME ||
  "/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home";
const keytool = path.join(javaHome, "bin", "keytool");
const bin = fs.existsSync(keytool) ? keytool : "keytool";

if (fs.existsSync(jks) && fs.existsSync(propsPath)) {
  console.log(`Upload key already exists:\n  ${jks}\n  ${propsPath}\nKeep both backed up. Never commit them.`);
  process.exit(0);
}

const password = process.env.SAFAR_KEYSTORE_PASSWORD || randomBytes(18).toString("base64url");
const result = spawnSync(
  bin,
  [
    "-genkeypair",
    "-v",
    "-keystore",
    jks,
    "-storetype",
    "JKS",
    "-keyalg",
    "RSA",
    "-keysize",
    "2048",
    "-validity",
    "10000",
    "-alias",
    "safar",
    "-storepass",
    password,
    "-keypass",
    password,
    "-dname",
    "CN=Safar, OU=Travel, O=Safar, L=India, ST=India, C=IN",
  ],
  { stdio: "inherit" },
);

if (result.status !== 0) {
  console.error("keytool failed. Install a JDK and set JAVA_HOME.");
  process.exit(result.status || 1);
}

fs.writeFileSync(
  propsPath,
  [
    `storeFile=${storeFile}`,
    `storePassword=${password}`,
    `keyAlias=safar`,
    `keyPassword=${password}`,
    "",
  ].join("\n"),
  { mode: 0o600 },
);

console.log(`\nCreated Play upload key:\n  ${jks}\n  ${propsPath}\n`);
console.log("Back these up somewhere private. If you lose them you cannot update the Play listing with the same upload key.");
