const { fontFamily } = require("tailwindcss/defaultTheme");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Montserrat", "Arial", "Verdana", ...fontFamily.sans],
      },
      borderRadius: {
        DEFAULT: "8px",
        secondary: "4px",
        container: "12px",
      },
      boxShadow: {
        DEFAULT: "0 1px 4px rgba(0,0,0,0.1)",
        hover: "0 2px 8px rgba(0,0,0,0.12)",
      },
      colors: {
        primary: {
          DEFAULT: "#224c87",
          hover: "#1a3a6b",
          light: "#e8eef7",
        },
        danger: {
          DEFAULT: "#da3832",
          hover: "#b82e29",
        },
        grey: {
          DEFAULT: "#919090",
          light: "#f5f5f5",
          border: "#e0e0e0",
        },
        secondary: {
          DEFAULT: "#6B7280",
          hover: "#4B5563",
        },
        accent: {
          DEFAULT: "#224c87",
          hover: "#1a3a6b",
        },
      },
      spacing: {
        "form-field": "16px",
        section: "32px",
      },
    },
  },
  plugins: [],
};