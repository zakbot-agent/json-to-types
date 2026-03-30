/**
 * Zod schema generator: converts the IR into Zod schema declarations.
 */

import { TypeNode, InferenceResult } from "./converter";

export function generateZod(result: InferenceResult): string {
  const lines: string[] = [];
  lines.push('import { z } from "zod";');
  lines.push("");

  for (const obj of result.objects) {
    lines.push(renderSchema(obj));
    lines.push("");
  }

  // Type aliases from schemas
  for (const obj of result.objects) {
    const varName = camelCase(obj.name);
    lines.push(
      `export type ${obj.name} = z.infer<typeof ${varName}Schema>;`
    );
  }

  // If root is not an object, add root schema
  if (result.root.kind !== "object") {
    lines.push("");
    lines.push(`export const rootSchema = ${renderZodType(result.root)};`);
    lines.push(`export type Root = z.infer<typeof rootSchema>;`);
  }

  return lines.join("\n").trimEnd() + "\n";
}

function renderSchema(
  obj: Extract<TypeNode, { kind: "object" }>
): string {
  const varName = camelCase(obj.name);
  const lines: string[] = [];
  lines.push(`export const ${varName}Schema = z.object({`);

  for (const field of obj.fields) {
    let zodType = renderZodType(field.type);
    if (field.optional) {
      zodType += ".optional()";
    }
    lines.push(`  ${safeKey(field.key)}: ${zodType},`);
  }

  lines.push("});");
  return lines.join("\n");
}

function renderZodType(node: TypeNode): string {
  switch (node.kind) {
    case "string":
      return "z.string()";
    case "number":
      return "z.number()";
    case "boolean":
      return "z.boolean()";
    case "null":
      return "z.null()";
    case "unknown":
      return "z.unknown()";
    case "array":
      return `z.array(${renderZodType(node.element)})`;
    case "union": {
      if (node.members.length === 2) {
        return `z.union([${node.members.map(renderZodType).join(", ")}])`;
      }
      return `z.union([${node.members.map(renderZodType).join(", ")}])`;
    }
    case "object":
      return `${camelCase(node.name)}Schema`;
  }
}

function camelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

function safeKey(key: string): string {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : `"${key}"`;
}
