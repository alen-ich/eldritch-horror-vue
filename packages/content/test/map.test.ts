import { describe, expect, it } from "vitest";
import { baseGameLocations, baseGameRoutes, validateMapContent } from "../src/index.js";

describe("base game map content", () => {
  it("contains the PDF's 36 spaces and 70 unique typed routes", () => {
    expect(baseGameLocations).toHaveLength(36);
    expect(baseGameRoutes).toHaveLength(70);
    expect(baseGameRoutes.filter((route) => route.type === "train")).toHaveLength(11);
    expect(baseGameRoutes.filter((route) => route.type === "ship")).toHaveLength(29);
    expect(baseGameRoutes.filter((route) => route.type === "uncharted")).toHaveLength(30);
  });

  it("matches representative degrees from the source directory", () => {
    const degree = (id: string) => baseGameRoutes.filter((route) => route.source === id || route.target === id).length;
    expect(degree("san_francisco")).toBe(5);
    expect(degree("buenos_aires")).toBe(6);
    expect(degree("the_himalayas")).toBe(6);
    expect(degree("space_12")).toBe(2);
  });

  it("registers every named space to a geographic reference", () => {
    expect(baseGameLocations.filter((location) => location.name !== String(Number(location.name))).every((location) => location.geographic)).toBe(true);
    expect(baseGameLocations.every((location) => location.positionSource === "prototype-layout")).toBe(true);
  });

  it("rejects duplicate routes", () => {
    expect(() => validateMapContent(baseGameLocations, [...baseGameRoutes, baseGameRoutes[0]!])).toThrow(/Duplicate route/);
  });
});
