/**
 * TypeScript type generator: converts the IR into TypeScript interface declarations.
 */

import { TypeNode, FieldNode, InferenceResult } from "./converter";

export function generateTypeScript(result: InferenceResult): string {
  const lines: string[] = [];

  for (const obj of result.objects) {
    lines.push(renderInterface(obj));
    lines.push("");
  }

  // If root is not an object (e.g. array), add a type alias
  if (result.root.kind !== "object") {
    lines.push(`export type Root = ${renderTypeRef(result.root)};`);
    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}

function renderInterface(
  obj: Extract<TypeNode, { kind: "object" }>
): string {
  const lines: string[] = [];
  lines.push(`export interface ${obj.name} {`);

  for (const field of obj.fields) {
    const opt = field.optional ? "?" : "";
    const type = renderTypeRef(field.type);
    lines.push(`  ${safeKey(field.key)}${opt}: ${type};`);
  }

  lines.push("}");
  return lines.join("\n");
}

function renderTypeRef(node: TypeNode): string {
  switch (node.kind) {
    case "string":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "null":
      return "null";
    case "unknown":
      return "unknown";
    case "array":
      const inner = renderTypeRef(node.element);
      // Wrap union types in parens for readability
      return inner.includes("|") ? `(${inner})[]` : `${inner}[]`;
    case "union":
      return node.members.map(renderTypeRef).join(" | ");
    case "object":
      return node.name;
  }
}

function safeKey(key: string): string {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : `"${key}"`;
}
