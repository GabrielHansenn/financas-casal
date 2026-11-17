// Manual backup of the PRODUCTION database (the project linked with `npx supabase link`, via --remote).
// Writes schema and data dumps to ./backups/<timestamp>-{schema,data}.sql (git-ignored).
// Requires Docker running (the CLI uses pg_dump in a container).
// Usage: npm run db:backup
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
mkdirSync("backups", { recursive: true });

const dumps = [
  ["schema", []],
  ["data", ["--data-only", "--use-copy"]],
];

for (const [kind, flags] of dumps) {
  const file = `backups/${stamp}-${kind}.sql`;
  console.log(`\n> dumping ${kind} to ${file}`);
  const result = spawnSync("npx", ["supabase", "db", "dump", "--remote", ...flags, "-f", file], {
    stdio: "inherit",
    shell: process.platform === "win32", // npx is a .cmd shim on Windows
  });
  if (result.status !== 0) {
    console.error(`\nBackup failed while dumping ${kind}.`);
    process.exit(result.status ?? 1);
  }
}

console.log(`\nBackup complete: backups/${stamp}-*.sql. Store a copy somewhere safe (not in git).`);
