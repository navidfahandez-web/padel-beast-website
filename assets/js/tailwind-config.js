tailwind.config = {
  theme: {
    extend: {
      colors: {
        ink: "#12142B",
        "ink-soft": "#3D3F63",
        paper: "#F7EEDF",
        "paper-alt": "#EFE2C7",
        card: "#FFFFFF",
        muted: "#716C58",
        border: "#E3D6BA",
        red: "#93171D",
        "red-dark": "#5C0F14",
        olive: "#5A5E27",
        whatsapp: "#25D366",
      },
      fontFamily: {
        heading: ["Anton", "sans-serif"],
        sans: ["Inter", "sans-serif"],
      },
      boxShadow: {
        card: "0 6px 18px rgba(18,20,43,0.10)",
        "card-hover": "0 18px 36px rgba(18,20,43,0.16)",
        xl2: "0 26px 52px rgba(18,20,43,0.22)",
      },
      borderRadius: {
        xl2: "18px",
      },
    },
  },
};
