import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf8"));
const version = packageJson.version;

const releaseRoot = join(projectRoot, "dist-release");
const portableDir = join(releaseRoot, `cline-desktop-pet-${version}-win-portable`);
const zipPath = join(releaseRoot, `cline-desktop-pet-${version}-win-portable.zip`);
const appDir = join(portableDir, "resources/app");

function assertExists(path, label) {
  if (!existsSync(path)) {
    throw new Error(`${label} not found: ${path}`);
  }
}

function copyDirectory(source, target) {
  assertExists(source, "Required release input");
  rmSync(target, { recursive: true, force: true });
  mkdirSync(dirname(target), { recursive: true });
  cpSync(source, target, { recursive: true });
}

rmSync(portableDir, { recursive: true, force: true });
rmSync(zipPath, { force: true });
mkdirSync(appDir, { recursive: true });

copyDirectory(join(projectRoot, "node_modules/electron/dist"), portableDir);

const electronExe = join(portableDir, "electron.exe");
const appExe = join(portableDir, "Cline Desktop Pet.exe");
assertExists(electronExe, "Electron executable");
renameSync(electronExe, appExe);

copyDirectory(join(projectRoot, "dist"), join(appDir, "dist"));
copyDirectory(join(projectRoot, "node_modules/zod"), join(appDir, "node_modules/zod"));

writeFileSync(join(appDir, "package.json"), JSON.stringify({
  name: packageJson.name,
  version,
  private: true,
  type: packageJson.type,
  main: packageJson.main
}, null, 2), "utf8");

writeFileSync(join(portableDir, "README-PORTABLE.txt"), [
  "Cline Desktop Pet Windows Portable Release",
  "",
  "Run: Cline Desktop Pet.exe",
  "",
  "The app keeps local data under %APPDATA%/cline-desktop-pet.",
  "Use the tray icon to show, hide, diagnose, or quit the pet.",
  ""
].join("\r\n"), "utf8");

mkdirSync(releaseRoot, { recursive: true });

const compress = spawnSync("powershell.exe", [
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-Command",
  `Compress-Archive -Path '${portableDir}' -DestinationPath '${zipPath}' -Force`
], { stdio: "inherit" });

if (compress.status !== 0) {
  throw new Error(`Compress-Archive failed with exit code ${compress.status}`);
}

console.log(`Portable release folder: ${portableDir}`);
console.log(`Portable release zip: ${zipPath}`);