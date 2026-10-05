import type { Metadata } from "next";
import TasksModule from "@/components/TasksModule";
import { getTasks } from "@/lib/tasks";
import { captureTask, deleteTask, finishTask, planOn, reopen, saveTask } from "./actions";

export const metadata: Metadata = { title: "Pendientes" };

export default async function PendientesPage() {
  const summary = await getTasks();
  return (
    <TasksModule
      summary={summary}
      actions={{ capture: captureTask, save: saveTask, plan: planOn, finish: finishTask, reopen, remove: deleteTask }}
    />
  );
}
