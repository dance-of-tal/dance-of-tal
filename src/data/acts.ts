import actsData from "./acts.json" with { type: "json" };
import type { Act } from "./types.js";

export const acts: Act[] = actsData.acts as Act[];
