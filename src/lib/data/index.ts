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

export { projects } from "./projects";
export type { ProjectItem } from "./projects";

export { certificates } from "./certificates";
export type { Certificate } from "./certificates";
