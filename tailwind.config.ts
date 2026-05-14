import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";
import plugin from "tailwindcss/plugin";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [
    tailwindcssAnimate,
    // base-ui data-* variants (shadcn/tailwind.css 대체)
    plugin(({ addVariant }) => {
      addVariant("data-open", [
        "&[data-state='open']",
        "&[data-open]:not([data-open='false'])",
      ]);
      addVariant("data-closed", [
        "&[data-state='closed']",
        "&[data-closed]:not([data-closed='false'])",
      ]);
      addVariant("data-checked", [
        "&[data-state='checked']",
        "&[data-checked]:not([data-checked='false'])",
      ]);
      addVariant("data-unchecked", [
        "&[data-state='unchecked']",
        "&[data-unchecked]:not([data-unchecked='false'])",
      ]);
      addVariant("data-selected", ["&[data-selected='true']"]);
      addVariant("data-disabled", ["&[data-disabled]"]);
      addVariant("data-highlighted", ["&[data-highlighted]"]);
    }),
  ],
};
export default config;
