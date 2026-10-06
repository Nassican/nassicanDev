import type { Metadata } from "next";
import CoursesModule from "@/components/CoursesModule";
import { certificateCategories, getCourses } from "@/lib/courses";
import {
  changeCourseStatus,
  deleteCourse,
  publishCourseCertificate,
  quickEditCourse,
  saveCourse,
} from "./actions";

export const metadata: Metadata = { title: "Aprendizaje" };

export default async function AprendizajePage() {
  const [summary, categories] = await Promise.all([getCourses(), certificateCategories()]);
  return (
    <CoursesModule
      summary={summary}
      categories={categories}
      actions={{
        save: saveCourse,
        remove: deleteCourse,
        setStatus: changeCourseStatus,
        quick: quickEditCourse,
        publish: publishCourseCertificate,
      }}
    />
  );
}
