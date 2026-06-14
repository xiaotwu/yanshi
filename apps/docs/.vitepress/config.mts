import { defineConfig } from "vitepress";

const normalizeBasePath = (value: string | undefined) => {
  if (!value || value.trim() === "") return "/yanshi/";
  const trimmed = value.trim();
  if (trimmed === "/") return "/";
  return `/${trimmed.replace(/^\/+|\/+$/g, "")}/`;
};

const docsBase = normalizeBasePath(process.env.DOCS_BASE_PATH);

// Yanshi documentation site. For GitHub Project Pages, set DOCS_BASE_PATH to /<repo>/.
// The default remains /yanshi/ for this repository and local previews.
export default defineConfig({
  title: "Yanshi",
  description: "A desktop AI agent workspace where real tools, projects, and animated workers come together.",
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
      { text: "Docs", link: "/getting-started/introduction" },
      { text: "Integrations", link: "/integrations/overview" },
      { text: "Desktop", link: "/desktop/macos" },
      { text: "Reference", link: "/reference/error-catalog" },
      {
        text: "v0.1",
        items: [
          { text: "Status: Local Final Candidate", link: "/release/limitations" },
          { text: "Build & Release", link: "/release/build" },
          { text: "GitHub", link: "https://github.com/xiaotwu/yanshi" },
        ],
      },
    ],
    sidebar: [
      {
        text: "Getting Started",
        collapsed: false,
        items: [
          { text: "Introduction", link: "/getting-started/introduction" },
          { text: "Installation", link: "/getting-started/installation" },
          { text: "Quickstart", link: "/getting-started/quickstart" },
          { text: "First Chat", link: "/getting-started/first-chat" },
        ],
      },
      {
        text: "Core Concepts",
        collapsed: false,
        items: [
          { text: "Yanshi Runtime", link: "/concepts/runtime" },
          { text: "Chats and Projects", link: "/concepts/projects-chats" },
          { text: "Yanshi Atelier", link: "/concepts/atelier" },
          { text: "Library and Files", link: "/concepts/library" },
          { text: "Tools and Permissions", link: "/concepts/tools-permissions" },
        ],
      },
      {
        text: "AI Integrations",
        collapsed: false,
        items: [
          { text: "Overview", link: "/integrations/overview" },
          { text: "LLM Providers", link: "/integrations/providers" },
          { text: "ACP External Agents", link: "/integrations/acp" },
          { text: "MCP Servers", link: "/integrations/mcp" },
          { text: "Skills", link: "/integrations/skills" },
          { text: "Provider Secrets", link: "/integrations/secrets" },
        ],
      },
      {
        text: "Desktop App",
        collapsed: false,
        items: [
          { text: "macOS App", link: "/desktop/macos" },
          { text: "DMG Packaging", link: "/desktop/packaging" },
          { text: "Keyboard Shortcuts", link: "/desktop/shortcuts" },
          { text: "Notifications", link: "/desktop/notifications" },
          { text: "macOS Permissions", link: "/desktop/permissions" },
          { text: "Troubleshooting", link: "/desktop/troubleshooting" },
        ],
      },
      {
        text: "Customization",
        collapsed: true,
        items: [
          { text: "Workshop", link: "/customization/workshop" },
          { text: "Agent Editor", link: "/customization/agent-editor" },
          { text: "Office Editor", link: "/customization/office-editor" },
          { text: "Worker Design", link: "/customization/worker-design" },
        ],
      },
      {
        text: "Reference",
        collapsed: true,
        items: [
          { text: "Error Catalog", link: "/reference/error-catalog" },
          { text: "Settings", link: "/reference/settings" },
          { text: "Runtime Events", link: "/reference/runtime-events" },
          { text: "Security Model", link: "/reference/security" },
          { text: "No-Mock Policy", link: "/reference/no-mock" },
        ],
      },
      {
        text: "Release",
        collapsed: true,
        items: [
          { text: "Build and Release", link: "/release/build" },
          { text: "Codesign and Notarization", link: "/release/codesign" },
          { text: "Known Limitations", link: "/release/limitations" },
        ],
      },
    ],
    socialLinks: [{ icon: "github", link: "https://github.com/xiaotwu/yanshi" }],
    footer: {
      message: "Yanshi · 偃师 — a craftsman of animated mechanisms.",
      copyright: "v0.1 Local Final Candidate · honest about what is built and what is planned.",
    },
    editLink: undefined,
  },
});
