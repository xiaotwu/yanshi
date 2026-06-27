import { defineConfig } from "vitepress";

const normalizeBasePath = (value: string | undefined) => {
  if (!value || value.trim() === "") return "/yanshi/";
  const trimmed = value.trim();
  if (trimmed === "/") return "/";
  return `/${trimmed.replace(/^\/+|\/+$/g, "")}/`;
};

const docsBase = normalizeBasePath(process.env.DOCS_BASE_PATH);

export default defineConfig({
  title: "Yanshi",
  description: "A macOS-first AI agent workspace with chats, tools, projects, and animated workers.",
  lang: "en-US",
  base: docsBase,
  cleanUrls: true,
  lastUpdated: true,
  appearance: "dark",
  head: [
    ["link", { rel: "icon", type: "image/svg+xml", href: `${docsBase}yanshi-mark.svg` }],
    ["meta", { name: "theme-color", content: "#2fc279" }],
    ["meta", { name: "color-scheme", content: "dark light" }],
  ],
  themeConfig: {
    logo: "/yanshi-mark.svg",
    siteTitle: "Yanshi",
    outline: { level: [2, 3], label: "On this page" },
    search: {
      provider: "local",
      options: {
        detailedView: true,
      },
    },
    nav: [
      { text: "Guide", link: "/getting-started/introduction" },
      { text: "Usage", link: "/usage" },
      { text: "Important Notes", link: "/important-notes" },
      { text: "Build", link: "/build-and-release" },
      { text: "GitHub", link: "https://github.com/xiaotwu/yanshi" },
    ],
    sidebar: [
      {
        text: "Yanshi",
        collapsed: false,
        items: [
          { text: "Introduction", link: "/getting-started/introduction" },
          { text: "Installation", link: "/getting-started/installation" },
          { text: "Quickstart", link: "/getting-started/quickstart" },
          { text: "Usage", link: "/usage" },
          { text: "Important Notes", link: "/important-notes" },
          { text: "Build and Release", link: "/build-and-release" },
        ],
      },
    ],
    socialLinks: [{ icon: "github", link: "https://github.com/xiaotwu/yanshi" }],
    footer: {
      message: "Yanshi · 偃师",
      copyright: "A macOS-first AI agent workspace.",
    },
    editLink: undefined,
  },
});
