/**
 * Core conversion engine: analyzes JSON values and produces a type schema (IR).
 * This intermediate representation is consumed by both the TS and Zod generators.
 */

// ── Intermediate Representation ──────────────────────────────────────────────

export type TypeNode =
  | { kind: "string" }
  | { kind: "number" }
  | { kind: "boolean" }
  | { kind: "null" }
  | { kind: "unknown" }
  | { kind: "array"; element: TypeNode }
  | { kind: "union"; members: TypeNode[] }
  | { kind: "object"; name: string; fields: FieldNode[] };

export interface FieldNode {
  key: string;
  type: TypeNode;
  optional: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Convert a key like "user_profile" or "user-profile" to "UserProfile" */
export function toPascalCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^[a-z]/, (c) => c.toUpperCase());
}

/** Deduplicate type nodes by structural equality */
function dedup(nodes: TypeNode[]): TypeNode[] {
  const seen = new Map<string, TypeNode>();
  for (const n of nodes) {
    const key = typeKey(n);
    if (!seen.has(key)) seen.set(key, n);
  }
  return [...seen.values()];
}

function typeKey(node: TypeNode): string {
  switch (node.kind) {
    case "string":
    case "number":
    case "boolean":
    case "null":
    case "unknown":
      return node.kind;
    case "array":
      return `array<${typeKey(node.element)}>`;
    case "union":
      return `union<${node.members.map(typeKey).sort().join("|")}>`;
    case "object":
      return `object:${node.name}`;
  }
}

// ── Main Inference ───────────────────────────────────────────────────────────

export interface InferenceResult {
  root: TypeNode;
  /** All named object types discovered (root + nested), in discovery order */
  objects: Extract<TypeNode, { kind: "object" }>[];
}

export function inferSchema(json: unknown, rootName = "Root"): InferenceResult {
  const objects: Extract<TypeNode, { kind: "object" }>[] = [];
  const root = infer(json, rootName, objects);
  return { root, objects };
}

function infer(
  value: unknown,
  name: string,
  objects: Extract<TypeNode, { kind: "object" }>[]
): TypeNode {
  if (value === null) return { kind: "null" };
  if (value === undefined) return { kind: "unknown" };

  switch (typeof value) {
    case "string":
      return { kind: "string" };
    case "number":
      return { kind: "number" };
    case "boolean":
      return { kind: "boolean" };
  }

  if (Array.isArray(value)) {
    return inferArray(value, name, objects);
  }

  if (typeof value === "object" && value !== null) {
    return inferObject(value as Record<string, unknown>, name, objects);
  }

  return { kind: "unknown" };
}

function inferArray(
  arr: unknown[],
  parentName: string,
  objects: Extract<TypeNode, { kind: "object" }>[]
): TypeNode {
  if (arr.length === 0) {
    return { kind: "array", element: { kind: "unknown" } };
  }

  // Singular name for element: "Tags" -> "Tag", "items" -> "Item"
  const singular = singularize(parentName);

  // Collect element objects separately so we can merge before adding to the main list
  const childObjects: Extract<TypeNode, { kind: "object" }>[] = [];
  const elementTypes = arr.map((item) => infer(item, singular, childObjects));
  const merged = mergeTypes(elementTypes);

  // Deduplicate: only add unique child objects (by name + structure)
  const seen = new Set<string>();
  for (const obj of childObjects) {
    const key = objStructureKey(obj);
    if (!seen.has(key)) {
      seen.add(key);
      objects.push(obj);
    }
  }

  // If the merged result is an object and differs from individual elements, replace
  if (merged.kind === "object" && !childObjects.some((o) => o === merged)) {
    objects.push(merged);
  }

  return { kind: "array", element: merged };
}

function inferObject(
  obj: Record<string, unknown>,
  name: string,
  objects: Extract<TypeNode, { kind: "object" }>[]
): TypeNode {
  const fields: FieldNode[] = Object.entries(obj).map(([key, val]) => {
    const fieldTypeName = toPascalCase(key);
    const fieldType = infer(val, fieldTypeName, objects);
    const optional = val === null;

    // If the inferred type is null, mark optional and widen to unknown
    if (fieldType.kind === "null") {
      return { key, type: { kind: "unknown" } as TypeNode, optional: true };
    }

    return { key, type: fieldType, optional };
  });

  const node: Extract<TypeNode, { kind: "object" }> = {
    kind: "object",
    name,
    fields,
  };
  objects.push(node);
  return node;
}

/** Merge multiple type nodes into one (union or single) */
function mergeTypes(types: TypeNode[]): TypeNode {
  const unique = dedup(types);
  if (unique.length === 0) return { kind: "unknown" };
  if (unique.length === 1) return unique[0];

  // If all are objects, merge their fields
  if (unique.every((t) => t.kind === "object")) {
    return mergeObjectTypes(
      unique as Extract<TypeNode, { kind: "object" }>[]
    );
  }

  return { kind: "union", members: unique };
}

/** Merge multiple object types into a single one with optional fields */
function mergeObjectTypes(
  types: Extract<TypeNode, { kind: "object" }>[]
): TypeNode {
  const allKeys = new Set<string>();
  for (const t of types) {
    for (const f of t.fields) allKeys.add(f.key);
  }

  const fields: FieldNode[] = [...allKeys].map((key) => {
    const fieldTypes: TypeNode[] = [];
    let presentCount = 0;

    for (const t of types) {
      const f = t.fields.find((ff) => ff.key === key);
      if (f) {
        fieldTypes.push(f.type);
        presentCount++;
      }
    }

    const merged = mergeTypes(fieldTypes);
    const optional = presentCount < types.length;

    return { key, type: merged, optional };
  });

  // Reuse the first type's name
  return { kind: "object", name: types[0].name, fields };
}

function objStructureKey(obj: Extract<TypeNode, { kind: "object" }>): string {
  const fields = obj.fields
    .map((f) => `${f.key}:${typeKey(f.type)}:${f.optional}`)
    .join(",");
  return `${obj.name}{${fields}}`;
}

function singularize(name: string): string {
  if (name.endsWith("ies")) return name.slice(0, -3) + "y";
  if (name.endsWith("ses")) return name.slice(0, -2);
  if (name.endsWith("s") && !name.endsWith("ss")) return name.slice(0, -1);
  return name + "Item";
}
