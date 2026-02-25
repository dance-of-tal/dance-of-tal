import { tals as talItems } from "./catalog.js";

export const tals = talItems;
export const talCategories = Array.from(new Set(tals.map((tal) => tal.category)));
