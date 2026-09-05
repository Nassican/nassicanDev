/**
 * Single entry point for every editable content file in this folder.
 * Components keep importing from `@/lib/data`, so a file can be split
 * further without touching call sites.
 */
export { profile } from "./profile";
export type { CvFile, SocialLink } from "./profile";

export { skills, skillsRegistry } from "./skills";
export type { SkillConfig } from "./skills";

export { experience } from "./experience";
export type { ExperienceItem } from "./experience";

export { education } from "./education";
export type { EducationItem } from "./education";

// Project queries are NOT re-exported here: this barrel is imported by
// client components and the query module reaches Prisma. Import them from
// "@/lib/data/projects" in server code instead.
export type {
  ProjectItem,
  ProjectMeta,
  ProjectTranslation,
} from "./projects/types";

// Post queries are NOT re-exported here on purpose: this barrel is imported
// by client components, and the query module reaches Prisma. Import them from
// "@/lib/data/posts" in server code instead.
export type { Post, PostMeta, PostTranslation } from "./posts/types";

export { certificates } from "./certificates";
export type { Certificate } from "./certificates";

export { readingMinutes, wordCount, headingId } from "./content";
export type { ContentBlock } from "./content";
