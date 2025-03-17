export default function manifest() {
  return {
    theme_color: "#000000",
    background_color: "#09090b",
    icons: {
      icon: [
        {
          url: "/1024.png",
          sizes: "1024x1024",
          type: "image/png",
          purpose: "any",
        },
      ],
      apple: [{ url: "/1024.png" }],
    },
    orientation: "any",
    display: "standalone",
    dir: "auto",
    lang: "en-US",
    name: "ALPR Database",
    short_name: "ALPR",
    start_url: "/",
    scope: "/",
    description: "algertc/alpr-database",
  };
}
