import depot, { type DepotTypeMap } from "../index";

/* ── Declare depot types via module augmentation ─────────────── */
declare module "../index" {
  interface DepotTypeMap {
    color: string;
    size: number;
  }
}

/* ── Usage ───────────────────────────────────────────────────── */
const colors = depot.group("colors");

// Register a color – value must be string since type "color" maps to string
colors.register("green", "#008000", "color");
colors.register("red", "#FF0000", "color");
colors.register("blue", "#0000FF", "color");

// Register sizes in a different group
const sizes = depot.group("sizes");
sizes.register("small", 12, "size");
sizes.register("medium", 16, "size");
sizes.register("large", 24, "size");

// Retrieve values
const green = colors.get<"color">("green");
if (green) {
  console.log(`Green color: ${green.value}`); // typed as string
}

// Check existence
console.log(`Has green: ${colors.has("green")}`);
console.log(`Has purple: ${colors.has("purple")}`);

// Unregister
colors.unregister("blue");
console.log(`Has blue after unregister: ${colors.has("blue")}`);

// Full path
console.log(`Path: ${depot.path("colors", "green")}`);

// Same group reference on repeated calls
const colors2 = depot.group("colors");
console.log(`Same group: ${colors === colors2}`);

// These should cause type errors (uncomment to verify):
// colors.register("bad", 123, "color"); // Error: number not assignable to string
// sizes.register("bad", "text", "size"); // Error: string not assignable to number

// Use DepotTypeMap for type safety (suppresses unused import warning)
const _typeCheck: keyof DepotTypeMap = "color";
void _typeCheck;
