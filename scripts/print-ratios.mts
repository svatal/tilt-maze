import { LEVELS } from "../src/levels";
import { hasClearStraightCorridor, pathToGoalLengthRatio, shortestPathLength } from "../src/levelSolvability";

for (const lvl of LEVELS) {
  const ratio = pathToGoalLengthRatio(lvl);
  console.log(
    [
      lvl.id,
      lvl.name,
      ratio == null ? "—" : ratio.toFixed(3),
      hasClearStraightCorridor(lvl) ? "straight" : "blocked",
      shortestPathLength(lvl)
    ].join("\t")
  );
}
