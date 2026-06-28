import test from "node:test";
import assert from "node:assert/strict";
import { espnFantasyStats } from "./fantasyScoring.js";

test("espnFantasyStats convierte resumen ESPN a stats fantasy", () => {
  const keyEvents = [
    {
      type: { type: "substitution" },
      clock: { displayValue: "72'" },
      participants: [{ athlete: { id: "20" } }, { athlete: { id: "10" } }],
    },
  ];

  const starter = espnFantasyStats({
    starter: true,
    subbedOut: true,
    athlete: { id: "10" },
    stats: [
      { name: "totalGoals", value: 1 },
      { name: "goalAssists", value: 1 },
      { name: "yellowCards", value: 1 },
    ],
  }, keyEvents);

  const sub = espnFantasyStats({
    starter: false,
    subbedIn: true,
    athlete: { id: "20" },
    stats: [
      { name: "appearances", value: 1 },
      { name: "redCards", value: 1 },
    ],
  }, keyEvents);

  const keeper = espnFantasyStats({
    starter: true,
    athlete: { id: "1" },
    stats: [
      { name: "saves", value: 4 },
      { name: "goalsConceded", value: 0 },
    ],
  }, keyEvents);

  assert.deepEqual(starter, {
    games: { minutes: 72 },
    goals: { total: 1, assists: 1, saves: 0, conceded: 0 },
    cards: { yellow: 1, red: 0 },
    penalty: { missed: 0, saved: 0 },
  });
  assert.equal(sub.games.minutes, 18);
  assert.equal(sub.cards.red, 1);
  assert.equal(keeper.goals.saves, 4);
  assert.equal(keeper.goals.conceded, 0);
});
