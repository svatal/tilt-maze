import type { LevelDef } from "./levels";

export type MenuLevelGroup = {
  id: "walls" | "traps";
  title: string;
  /** Indexy v poli LEVELS */
  indices: number[];
};

/** Dvě skupiny po pět: bez pastí vs. s pastmi — odvozeno z dat úrovně. */
export function menuLevelGroups(levels: LevelDef[]): MenuLevelGroup[] {
  const walls: number[] = [];
  const traps: number[] = [];
  levels.forEach((lvl, i) => {
    (lvl.traps.length > 0 ? traps : walls).push(i);
  });
  return [
    { id: "walls", title: "Bez pastí — jen zdi", indices: walls },
    { id: "traps", title: "S pastmi a propady", indices: traps }
  ];
}

export function levelMenuGroupId(lvl: LevelDef): MenuLevelGroup["id"] {
  return lvl.traps.length > 0 ? "traps" : "walls";
}
