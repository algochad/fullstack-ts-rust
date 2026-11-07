// Refresh the bundled archlast-forge skill from its source repository (https://github.com/algochad/archlast-forge-skills).
// node scripts/sync-archlast-forge.mjs [path to a checkout, default ../archlast-forge-skills]; then bump the version and note the commit in the README.
import { cpSync, existsSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const src = resolve(process.argv[2] || join(import.meta.dirname, "..", "..", "archlast-forge-skills"), "skills", "archlast-forge");
if (!existsSync(join(src, "SKILL.md"))) { console.error("no archlast-forge skill at " + src); process.exit(1); }
const dest = join(import.meta.dirname, "..", "skills", "archlast-forge");
rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, { recursive: true });
console.log("synced from " + src);
