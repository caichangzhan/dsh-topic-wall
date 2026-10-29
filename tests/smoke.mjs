import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

if (pkg.name !== "dsh-topic-wall") throw new Error("unexpected package name");
if (!/^\d+\.\d+\.\d+$/.test(pkg.version)) throw new Error("invalid version");
if (pkg.private === true) throw new Error("package must not be private for release");
if (pkg.license !== "MIT") throw new Error("license must be MIT");
for (const file of ["index.js", "client.js", "cordis.patch.yml", "icon.svg", "README.md", "LICENSE", "CHANGELOG.md"]) {
  if (!existsSync(join(root, file))) throw new Error(`missing ${file}`);
}

execFileSync(process.execPath, ["--check", join(root, "index.js")]);
execFileSync(process.execPath, ["--check", join(root, "client.js")]);

const index = readFileSync(join(root, "index.js"), "utf8");
if (!index.includes("DSH_TOPIC_WALL_TOS_GUARD")) throw new Error("TOS guard switch missing");

console.log("smoke: ok");
