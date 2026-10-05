import type { Metadata } from "next";
import GoalsModule from "@/components/GoalsModule";
import { getGoalsAndHabits } from "@/lib/goals";
import {
  changeGoalStatus,
  deleteGoal,
  deleteHabit,
  saveGoal,
  saveHabit,
  setHabitArchived,
  stepGoal,
  toggleHabit,
} from "./actions";

export const metadata: Metadata = { title: "Metas y hábitos" };

export default async function MetasPage() {
  const summary = await getGoalsAndHabits();
  return (
    <GoalsModule
      summary={summary}
      actions={{
        saveGoal,
        setStatus: changeGoalStatus,
        step: stepGoal,
        removeGoal: deleteGoal,
        saveHabit,
        toggle: toggleHabit,
        archive: setHabitArchived,
        removeHabit: deleteHabit,
      }}
    />
  );
}
