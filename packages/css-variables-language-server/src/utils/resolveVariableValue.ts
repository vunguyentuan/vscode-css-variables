import { CSSVariable } from '../CSSVariableManager';

const MAX_DEPTH = 5;

/**
 * Parses a var() reference and extracts the variable name and fallback value
 * Examples:
 *   "var(--color)" => { varName: "--color", fallback: undefined }
 *   "var(--color, blue)" => { varName: "--color", fallback: "blue" }
 *   "var(--color, var(--other))" => { varName: "--color", fallback: "var(--other)" }
 */
function parseVarReference(varRef: string): { varName: string; fallback?: string } | null {
  const match = varRef.match(/^var\(\s*(--[a-zA-Z0-9-_]+)\s*(?:,\s*(.+))?\s*\)$/);
  if (!match) {
    return null;
  }

  return {
    varName: match[1],
    fallback: match[2]?.trim(),
  };
}

/**
 * Resolves CSS variable references (var(--name)) recursively up to a maximum depth
 *
 * @param value - The CSS value that may contain var() references
 * @param variableMap - Map of all CSS variables for lookup
 * @param depth - Current recursion depth (starts at 0)
 * @param visited - Set of variable names already visited (for circular reference detection)
 * @returns The resolved value or the original value if unresolvable
 */
export function resolveVariableValue(
  value: string,
  variableMap: Map<string, CSSVariable>,
  depth: number = 0,
  visited: Set<string> = new Set()
): string {
  // Stop if we've reached max depth
  if (depth >= MAX_DEPTH) {
    return value;
  }

  // Check if the entire value is a single var() reference
  const parsed = parseVarReference(value);

  if (parsed) {
    const { varName, fallback } = parsed;

    // Check for circular reference
    if (visited.has(varName)) {
      // Circular reference detected, try fallback or return original
      return fallback ? resolveVariableValue(fallback, variableMap, depth + 1, visited) : value;
    }

    // Look up the variable
    const referencedVar = variableMap.get(varName);

    if (referencedVar) {
      // Add to visited set to detect cycles
      const newVisited = new Set(visited);
      newVisited.add(varName);

      // Recursively resolve the referenced variable's value
      return resolveVariableValue(referencedVar.symbol.value, variableMap, depth + 1, newVisited);
    } else if (fallback) {
      // Variable not found, use fallback
      return resolveVariableValue(fallback, variableMap, depth + 1, visited);
    }

    // Variable not found and no fallback
    return value;
  }

  // Handle complex values with multiple var() references
  // e.g., "rgba(var(--r), var(--g), var(--b), 0.5)"
  const varPattern = /var\(\s*--[a-zA-Z0-9-_]+(?:\s*,\s*[^)]+)?\s*\)/g;

  if (varPattern.test(value)) {
    return value.replace(varPattern, (match) => {
      // Recursively resolve each var() reference
      return resolveVariableValue(match, variableMap, depth + 1, visited);
    });
  }

  // No var() references found, return as-is
  return value;
}
