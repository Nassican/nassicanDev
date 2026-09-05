/**
 * Types and presentation config for the content layer.
 *
 * **This barrel is imported by client components, so it must never re-export
 * anything that reaches Prisma.** Every query lives in its own module and is
 * imported directly from server code:
 *
 *   getProfile      -> "@/lib/data/profile"
 *   getExperience   -> "@/lib/data/experience"
 *   getEducation    -> "@/lib/data/education"
 *   getCertificates -> "@/lib/data/certificates"
 *   getPublishedPosts, getPost      -> "@/lib/data/posts"
 *   getProjectsByDate, getProject   -> "@/lib/data/projects"
 *
 * What stays here is what a client component may safely hold: types, pure
 * helpers, and the skill registry - colours and icon names, which are design
 * tokens rather than editable content.
 */
export type { CvFile, SocialLink, Profile } from "./profile";

export { skills, skillsRegistry } from "./skills";
export type { SkillConfig } from "./skills";

export type { ExperienceItem } from "./experience";
export type { EducationItem } from "./education";
export type { Certificate } from "./certificates";

export type {
  ProjectItem,
  ProjectMeta,
  ProjectTranslation,
} from "./projects/types";

export type { Post, PostMeta, PostTranslation } from "./posts/types";

export { readingMinutes, wordCount, headingId } from "./content";
export type { ContentBlock } from "./content";
