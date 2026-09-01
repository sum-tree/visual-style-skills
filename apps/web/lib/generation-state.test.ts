import assert from "node:assert/strict";
import test from "node:test";
import { cancelOutstandingTasks } from "./generation-state";

test("cancels queued and generating tasks without changing settled results", () => {
  const tasks = [
    { id: "queued", status: "queued" as const },
    { id: "active", status: "generating" as const, error: "stale" },
    { id: "done", status: "success" as const },
    { id: "failed", status: "error" as const, error: "upstream" },
  ];

  assert.deepEqual(cancelOutstandingTasks(tasks), [
    { id: "queued", status: "cancelled", error: undefined },
    { id: "active", status: "cancelled", error: undefined },
    tasks[2],
    tasks[3],
  ]);
});
