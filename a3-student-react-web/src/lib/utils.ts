type ClassValue =
  | string
  | number
  | false
  | null
  | undefined
  | ClassValue[]
  | Record<string, boolean | null | undefined>;

function flattenClasses(input: ClassValue, output: string[]) {
  if (!input) {
    return;
  }

  if (typeof input === "string" || typeof input === "number") {
    output.push(String(input));
    return;
  }

  if (Array.isArray(input)) {
    for (const item of input) {
      flattenClasses(item, output);
    }
    return;
  }

  for (const [key, enabled] of Object.entries(input)) {
    if (enabled) {
      output.push(key);
    }
  }
}

export function cn(...inputs: ClassValue[]) {
  const output: string[] = [];
  for (const input of inputs) {
    flattenClasses(input, output);
  }
  return output.join(" ");
}
