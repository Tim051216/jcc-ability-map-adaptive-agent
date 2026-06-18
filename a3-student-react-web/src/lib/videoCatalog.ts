export type VideoLicenseRecord = {
  id: string;
  file: string;
  status: "placeholder" | "licensed" | "public-domain";
  intended_use: string;
  source_url: string;
  author: string;
  license: string;
  license_url: string;
};

export type CourseVideoInsightMeta = {
  src: string;
  fileId: number;
  resourceId: number;
  fileName: string;
};

export const COURSE_VIDEO_PLAYLISTS: Record<string, string[]> = {
  "series-1": [
    "/videos/software-engineering-4th/project-demo.mp4",
    "/videos/software-engineering-4th/visio-flow-demo.mp4",
    "/videos/software-engineering-4th/cloud-app-demo.mp4",
  ],
  "series-2": [
    "/videos/software-engineering-4th/project-demo.mp4",
    "/videos/software-engineering-4th/visio-flow-demo.mp4",
    "/videos/software-engineering-4th/cloud-app-demo.mp4",
  ],
  "series-3": [
    "/videos/software-engineering-4th/cloud-app-demo.mp4",
    "/videos/software-engineering-4th/project-demo.mp4",
    "/videos/software-engineering-4th/visio-flow-demo.mp4",
  ],
  "course-4": [
    "/videos/software-engineering-4th/project-demo.mp4",
    "/videos/software-engineering-4th/cloud-app-demo.mp4",
    "/videos/software-engineering-4th/visio-flow-demo.mp4",
  ],
};

export const HERO_BACKGROUND_VIDEO = "/videos/software-engineering-4th/project-demo.mp4";
export const WORKSPACE_ATMOSPHERE_VIDEO = "/videos/software-engineering-4th/cloud-app-demo.mp4";
export const PROCESS_DEMO_VIDEO = "/videos/software-engineering-4th/visio-flow-demo.mp4";

const VIDEO_INSIGHT_META_BY_SRC: Record<string, CourseVideoInsightMeta> = {
  "/videos/software-engineering-4th/project-demo.mp4": {
    src: "/videos/software-engineering-4th/project-demo.mp4",
    fileId: 91001,
    resourceId: 81001,
    fileName: "project-demo.mp4",
  },
  "/videos/software-engineering-4th/visio-flow-demo.mp4": {
    src: "/videos/software-engineering-4th/visio-flow-demo.mp4",
    fileId: 91002,
    resourceId: 81002,
    fileName: "visio-flow-demo.mp4",
  },
  "/videos/software-engineering-4th/cloud-app-demo.mp4": {
    src: "/videos/software-engineering-4th/cloud-app-demo.mp4",
    fileId: 91003,
    resourceId: 81003,
    fileName: "cloud-app-demo.mp4",
  },
};

export function getCourseVideoPlaylist(courseId: string) {
  return COURSE_VIDEO_PLAYLISTS[courseId] || COURSE_VIDEO_PLAYLISTS["series-2"] || [];
}

export function getCourseVideoInsightMeta(src?: string | null) {
  if (!src) return undefined;
  return VIDEO_INSIGHT_META_BY_SRC[src];
}
