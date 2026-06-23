import assert from "node:assert/strict";
import { tennisPairOrientation } from "./tennisMatching.js";

assert.equal(tennisPairOrientation(
  { home: "Naomi Osaka", away: "Elise Mertens" },
  { home: "Mertens, Elise", away: "Osaka, Naomi" },
), "reversed");

assert.equal(tennisPairOrientation(
  { home: "Daniel Evans", away: "Tristan Schoolkate" },
  { home: "Evans, Daniel", away: "Schoolkate, Tristan" },
), "same");
