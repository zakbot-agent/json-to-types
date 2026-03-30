#!/usr/bin/env node

/**
 * CLI entry point for json-to-types.
 *
 * Usage:
 *   echo '{"a":1}' | json-to-types
 *   json-to-types --file data.json
 *   json-to-types --serve [--port 3000]
 */

import * as fs from "node:fs";
import { inferSchema } from "./converter";
import { generateTypeScript } from "./typescript";
import { generateZod } from "./zod";
import { startServer } from "./server";

// ── Argument parsing (zero deps) ────────────────────────────────────────────

interface Args {
  serve: boolean;
  port: number;
  file?: string;
  rootName: string;
  help: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    serve: false,
    port: 3000,
    rootName: "Root",
    help: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--serve" || a === "-s") args.serve = true;
    else if (a === "--port" || a === "-p") args.port = parseInt(argv[++i], 10);
    else if (a === "--file" || a === "-f") args.file = argv[++i];
    else if (a === "--name" || a === "-n") args.rootName = argv[++i];
    else if (a === "--help" || a === "-h") args.help = true;
  }

  return args;
}

function printHelp(): void {
  console.log(`
json-to-types - Convert JSON to TypeScript types & Zod schemas

Usage:
  echo '{"a":1}' | json-to-types          Read from stdin
  json-to-types -f data.json              Read from file
  json-to-types --serve                   Start web UI
  json-to-types --serve --port 8080       Custom port

Options:
  -f, --file <path>    Input JSON file
  -n, --name <name>    Root type name (default: Root)
  -s, --serve          Start web interface
  -p, --port <port>    Server port (default: 3000)
  -h, --help           Show this help
`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (args.serve) {
    startServer(args.port);
    return;
  }

  // Read JSON from file or stdin
  let input: string;

  if (args.file) {
    input = fs.readFileSync(args.file, "utf-8");
  } else {
    input = await readStdin();
  }

  if (!input.trim()) {
    console.error("Error: No JSON input provided. Use --help for usage.");
    process.exit(1);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    console.error("Error: Invalid JSON input.");
    process.exit(1);
  }

  const result = inferSchema(parsed, args.rootName);
  const ts = generateTypeScript(result);
  const zod = generateZod(result);

  console.log("// ─── TypeScript Types ───────────────────────────────────");
  console.log();
  console.log(ts);
  console.log("// ─── Zod Schemas ────────────────────────────────────────");
  console.log();
  console.log(zod);
}

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve("");
      return;
    }

    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
