// Regenerates src/types/database.ts from the local database.
// Writes the file only when generation succeeds, so a stopped database (Docker off)
// never overwrites the types with an error message.
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const OUT = "src/types/database.ts";
// One command string (no args array): avoids Node DEP0190 when a shell is used on Windows
const result = spawnSync("npx supabase gen types typescript", {
  encoding: "utf8",
  shell: true,
  maxBuffer: 32 * 1024 * 1024,
});

const output = result.stdout ?? "";
if (result.status !== 0 || !output.includes("export type Database")) {
  process.stderr.write(result.stderr || output);
  console.error(`\nType generation failed; ${OUT} was left unchanged. Is the local database running (npm run db:start)?`);
  process.exit(1);
}

writeFileSync(OUT, output);
console.log(`Wrote ${OUT}`);
