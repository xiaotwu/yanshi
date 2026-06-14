import DefaultTheme from "vitepress/theme";
import type { Theme } from "vitepress";

import "./custom.css";

// Default VitePress theme (left sidebar, right "On this page" outline, ⌘K local search,
// dark/light toggle, responsive) restyled to the Yanshi black/white + mint-glow identity in
// custom.css. No layout overrides needed beyond CSS tokens.
const theme: Theme = {
  extends: DefaultTheme,
};

export default theme;
