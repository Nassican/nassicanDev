import type { ProjectTranslation } from "../types";

export const en: ProjectTranslation = {
  tagline: "Desktop app for watching downloaded courses locally.",
  summary:
    "CursoVisor is a desktop application built with Electron and React that organises and plays courses stored on disk. It came out of a problem of my own: folders holding hundreds of loose video files, with no progress tracking, no ordering and no way to pick up where you left off.",
  role: "Application development and design",
  highlights: [
    "Automatic reading and organisation of course folders",
    "Playback progress stored locally",
    "Packaged and distributed through GitHub Releases",
    "Works offline: all content stays on the machine",
  ],
  body: [
    {
      type: "heading",
      text: "The problem",
    },
    {
      type: "paragraph",
      text: "A downloaded course is usually a folder tree with inconsistent names. The system player does not know which module comes next, does not remember the timestamp you stopped at, and cannot tell a watched video from a pending one.",
    },
    {
      type: "heading",
      text: "How it is built",
    },
    {
      type: "paragraph",
      text: "The app pairs an Electron main process that reaches the file system with a local Express server that serves the content, and a React interface on top. Keeping the server separate from the window process meant the same catalogue logic could be reused if it ever runs in a browser.",
    },
    {
      type: "list",
      items: [
        "Electron for native disk access and packaging.",
        "Express to serve files with range request support, which the video scrubber depends on.",
        "React with TypeScript for the interface and player state.",
        "Local persistence for progress, with no accounts and no remote server.",
      ],
    },
    {
      type: "heading",
      text: "What I learned",
    },
    {
      type: "paragraph",
      text: "Serving local video is not just returning a file: without range requests the progress bar does not work at all. It was the detail that took the longest and changed the final experience the most.",
    },
  ],
};
