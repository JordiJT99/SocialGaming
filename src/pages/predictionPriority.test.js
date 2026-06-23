import assert from "node:assert/strict";
import { matchPriority } from "./predictionPriority.js";

assert(matchPriority({ sportKey: "tennis", league: "ATP - Wimbledon" })
  > matchPriority({ sportKey: "tennis", league: "ATP - Mallorca" }));
assert(matchPriority({ sportKey: "football", league: "UEFA Champions League", home: "Real Madrid", away: "Arsenal" })
  > matchPriority({ sportKey: "football", league: "Ligue 1", home: "Angers", away: "Brest" }));
