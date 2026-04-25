// Sprint 5 PR #1 — Storybook preview config.
//
// globals.css'i hem light hem dark mode tema değişkenleriyle yükler.
// Tailwind 4 inline @theme ile tokenize edildiği için preview
// dahili olarak globalleri çeker.

import type { Preview } from "@storybook/react";
import "../src/app/globals.css";

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: "^on[A-Z].*" },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    backgrounds: {
      default: "cream",
      values: [
        { name: "cream", value: "#f6f3ed" }, // light --background
        { name: "white", value: "#ffffff" }, // light --card
        { name: "dark", value: "#172126" },  // dark --background
      ],
    },
    a11y: {
      // Sprint 4 PR #3 ile aynı kontrast/aria kuralları.
      element: "#storybook-root",
      manual: false,
    },
  },
  globalTypes: {
    theme: {
      description: "Light / dark theme",
      defaultValue: "light",
      toolbar: {
        title: "Tema",
        icon: "circlehollow",
        items: [
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, context) => {
      // Story render'ından önce <html>'e .dark class'ını uygula.
      // Tailwind 4 dark mode `.dark` selector kullanıyor.
      if (typeof document !== "undefined") {
        const html = document.documentElement;
        if (context.globals.theme === "dark") {
          html.classList.add("dark");
        } else {
          html.classList.remove("dark");
        }
      }
      return Story();
    },
  ],
};

export default preview;
