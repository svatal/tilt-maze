import type { LevelDef } from "./levels";

export type MenuLevelGroup = {
  id: "walls" | "traps" | "slopes";
  title: string;
  /** Indexy v poli LEVELS */
  indices: number[];
};

/** Tři skupiny po pět: zdi, pasti, lokální sklon — odvozeno z dat úrovně. */
export function menuLevelGroups(levels: LevelDef[]): MenuLevelGroup[] {
  const walls: number[] = [];
  const traps: number[] = [];
  const slopes: number[] = [];
  levels.forEach((lvl, i) => {
    if (lvl.slopes.length > 0) slopes.push(i);
    else if (lvl.traps.length > 0) traps.push(i);
    else walls.push(i);
  });
  return [
    { id: "walls", title: "Bez pastí — jen zdi", indices: walls },
    { id: "traps", title: "S pastmi a propady", indices: traps },
    { id: "slopes", title: "Lokální sklon podlahy", indices: slopes }
  ];
}

export function levelMenuGroupId(lvl: LevelDef): MenuLevelGroup["id"] {
  if (lvl.slopes.length > 0) return "slopes";
  return lvl.traps.length > 0 ? "traps" : "walls";
}
