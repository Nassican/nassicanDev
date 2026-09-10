import { getPageDirectory } from "./pages";
import { getPublishedPosts } from "./posts";
import { getProjectsByDate } from "./projects";
import { buildDiscoveryEntries } from "../discovery";

/** Sitemap and llms.txt advertise the same published, indexable translations. */
export async function getDiscoveryEntries() {
  const [pages, posts, projects] = await Promise.all([
    getPageDirectory(), getPublishedPosts(), getProjectsByDate(),
  ]);
  return buildDiscoveryEntries(pages, posts, projects);
}
