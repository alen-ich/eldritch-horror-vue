import { locationIds, type LocationId } from "@eldritch/protocol";
import { z } from "zod";

export const routeTypes = ["train", "ship", "uncharted"] as const;
export type RouteType = (typeof routeTypes)[number];
export type SpaceType = "city" | "wilderness" | "sea";

export interface MapLocation {
  id: LocationId;
  name: string;
  type: SpaceType;
  x: number;
  y: number;
}

export interface MapRoute {
  source: LocationId;
  target: LocationId;
  type: RouteType;
}

const numbered = (number: number, type: SpaceType, x: number, y: number): MapLocation => ({
  id: `space_${number}` as LocationId,
  name: String(number),
  type,
  x,
  y,
});

export const baseGameLocations: readonly MapLocation[] = [
  { id: "san_francisco", name: "San Francisco", type: "city", x: 92, y: 192 },
  { id: "arkham", name: "Arkham", type: "city", x: 185, y: 112 },
  { id: "buenos_aires", name: "Buenos Aires", type: "city", x: 218, y: 342 },
  { id: "london", name: "London", type: "city", x: 326, y: 112 },
  { id: "rome", name: "Rome", type: "city", x: 386, y: 170 },
  { id: "istanbul", name: "Istanbul", type: "city", x: 456, y: 178 },
  { id: "shanghai", name: "Shanghai", type: "city", x: 570, y: 235 },
  { id: "sydney", name: "Sydney", type: "city", x: 596, y: 368 },
  { id: "tokyo", name: "Tokyo", type: "city", x: 637, y: 188 },
  { id: "the_amazon", name: "The Amazon", type: "wilderness", x: 255, y: 286 },
  { id: "the_pyramids", name: "The Pyramids", type: "wilderness", x: 409, y: 235 },
  { id: "the_heart_of_africa", name: "Heart of Africa", type: "wilderness", x: 376, y: 316 },
  { id: "the_himalayas", name: "The Himalayas", type: "wilderness", x: 508, y: 246 },
  { id: "tunguska", name: "Tunguska", type: "wilderness", x: 535, y: 112 },
  { id: "antarctica", name: "Antarctica", type: "sea", x: 404, y: 424 },
  numbered(1, "city", 94, 116), numbered(2, "sea", 36, 262),
  numbered(3, "sea", 103, 350), numbered(4, "wilderness", 132, 185),
  numbered(5, "city", 157, 146), numbered(6, "city", 220, 157),
  numbered(7, "city", 171, 241), numbered(8, "sea", 255, 202),
  numbered(9, "wilderness", 268, 102), numbered(10, "wilderness", 344, 218),
  numbered(11, "sea", 296, 326), numbered(12, "sea", 275, 410),
  numbered(13, "sea", 300, 65), numbered(14, "city", 382, 112),
  numbered(15, "city", 343, 273), numbered(16, "wilderness", 476, 213),
  numbered(17, "sea", 461, 346), numbered(18, "wilderness", 433, 272),
  numbered(19, "wilderness", 574, 151), numbered(20, "city", 620, 282),
  numbered(21, "wilderness", 535, 414),
] as const;

const train = (source: LocationId, target: LocationId): MapRoute => ({ source, target, type: "train" });
const ship = (source: LocationId, target: LocationId): MapRoute => ({ source, target, type: "ship" });
const uncharted = (source: LocationId, target: LocationId): MapRoute => ({ source, target, type: "uncharted" });

export const baseGameRoutes: readonly MapRoute[] = [
  train("space_5", "arkham"), train("space_5", "san_francisco"), train("space_6", "space_7"),
  train("space_6", "arkham"), train("space_6", "san_francisco"), train("space_14", "space_16"),
  train("space_14", "london"), train("space_14", "rome"), train("space_15", "space_18"),
  train("istanbul", "rome"), train("london", "rome"),

  ship("space_1", "san_francisco"), ship("space_2", "space_3"), ship("space_2", "space_4"),
  ship("space_2", "san_francisco"), ship("space_3", "buenos_aires"), ship("space_3", "sydney"),
  ship("space_7", "space_8"), ship("space_7", "buenos_aires"), ship("space_7", "san_francisco"),
  ship("space_8", "arkham"), ship("space_8", "buenos_aires"), ship("space_10", "space_8"),
  ship("space_11", "space_15"), ship("space_11", "buenos_aires"), ship("space_11", "the_amazon"),
  ship("space_12", "antarctica"), ship("space_12", "buenos_aires"), ship("space_13", "space_9"),
  ship("space_13", "london"), ship("space_15", "space_17"), ship("space_17", "space_20"),
  ship("space_17", "antarctica"), ship("space_17", "the_heart_of_africa"), ship("space_20", "sydney"),
  ship("space_20", "tokyo"), ship("space_21", "antarctica"), ship("antarctica", "sydney"),
  ship("arkham", "london"), ship("shanghai", "tokyo"),

  uncharted("space_1", "space_4"), uncharted("space_1", "space_19"), uncharted("space_4", "space_5"),
  uncharted("space_7", "the_amazon"), uncharted("space_9", "arkham"), uncharted("space_9", "london"),
  uncharted("space_10", "space_15"), uncharted("space_10", "rome"), uncharted("space_10", "the_pyramids"),
  uncharted("space_15", "the_heart_of_africa"), uncharted("space_16", "space_18"),
  uncharted("space_16", "istanbul"), uncharted("space_16", "the_himalayas"), uncharted("space_16", "tunguska"),
  uncharted("space_18", "the_heart_of_africa"), uncharted("space_18", "the_himalayas"),
  uncharted("space_18", "the_pyramids"), uncharted("space_19", "shanghai"), uncharted("space_19", "tokyo"),
  uncharted("space_19", "tunguska"), uncharted("space_20", "shanghai"), uncharted("space_21", "sydney"),
  uncharted("buenos_aires", "the_amazon"), uncharted("istanbul", "the_himalayas"),
  uncharted("rome", "the_pyramids"), uncharted("shanghai", "the_himalayas"),
  uncharted("the_heart_of_africa", "the_pyramids"), uncharted("the_himalayas", "the_pyramids"),
  uncharted("the_himalayas", "tunguska"), uncharted("tokyo", "tunguska"),
] as const;

export const baseGameMap = {
  startingLocationId: "san_francisco" as LocationId,
  adjacentLocationIds: Object.fromEntries(locationIds.map((id) => [
    id,
    baseGameRoutes
      .filter((route) => route.source === id || route.target === id)
      .map((route) => route.source === id ? route.target : route.source),
  ])),
};

const locationSchema = z.object({
  id: z.enum(locationIds), name: z.string().min(1), type: z.enum(["city", "wilderness", "sea"]),
  x: z.number().min(0).max(680), y: z.number().min(0).max(460),
});
const routeSchema = z.object({ source: z.enum(locationIds), target: z.enum(locationIds), type: z.enum(routeTypes) });

export function validateMapContent(locations: readonly MapLocation[], routes: readonly MapRoute[]): void {
  const parsedLocations = z.array(locationSchema).parse(locations);
  const parsedRoutes = z.array(routeSchema).parse(routes);
  const ids = new Set(parsedLocations.map((location) => location.id));
  if (ids.size !== parsedLocations.length) throw new Error("Map contains duplicate location IDs.");
  const edges = new Set<string>();
  for (const route of parsedRoutes) {
    if (!ids.has(route.source) || !ids.has(route.target)) throw new Error(`Route references a missing location: ${route.source}-${route.target}`);
    if (route.source === route.target) throw new Error(`Self-referencing route: ${route.source}`);
    const edge = [route.source, route.target].sort().join("::");
    if (edges.has(edge)) throw new Error(`Duplicate route: ${edge}`);
    edges.add(edge);
  }
}

validateMapContent(baseGameLocations, baseGameRoutes);
