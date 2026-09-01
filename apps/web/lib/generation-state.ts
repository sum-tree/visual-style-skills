export type GenerationTaskStatus =
  | "queued"
  | "generating"
  | "success"
  | "error"
  | "cancelled";

type CancellableTask = {
  status: GenerationTaskStatus;
  error?: string;
};

export function cancelOutstandingTasks<T extends CancellableTask>(
  tasks: readonly T[],
): T[] {
  return tasks.map((task) =>
    task.status === "queued" || task.status === "generating"
      ? ({ ...task, status: "cancelled", error: undefined } as T)
      : task,
  );
}
