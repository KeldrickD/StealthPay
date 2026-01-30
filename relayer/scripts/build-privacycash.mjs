import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

function run(cmd, cwd) {
  execSync(cmd, { cwd, stdio: "inherit", env: process.env })
}

const sdkPath = path.resolve("node_modules/@privacy-cash/privacy-cash-sdk")
const distPath = path.join(sdkPath, "dist", "index.js")

if (!fs.existsSync(sdkPath)) {
  console.log("[privacycash] SDK not found in node_modules. Skipping build.")
  process.exit(0)
}

if (fs.existsSync(distPath)) {
  console.log("[privacycash] dist already exists. Skipping build.")
  process.exit(0)
}

console.log("[privacycash] dist missing — building SDK…")

// Build the git dependency in-place
run("npm install", sdkPath)
run("npm run build", sdkPath)

if (!fs.existsSync(distPath)) {
  console.log("[privacycash] Build finished but dist still missing.")
  process.exit(1)
}

console.log("[privacycash] SDK built successfully.")
