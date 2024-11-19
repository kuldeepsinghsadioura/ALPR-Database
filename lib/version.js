export async function getVersionInfo() {
  try {
    const localVersion = require("../package.json").version;

    const response = await fetch(
      "https://raw.githubusercontent.com/algertc/ALPR-Database/main/package.json",
      { next: { revalidate: 3600 } } // check hourly
    );

    if (!response.ok) {
      throw new Error(`Version check failed: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      current: localVersion,
      latest: data.version,
      needsUpdate: localVersion !== data.version,
      checkError: null,
    };
  } catch (error) {
    console.error("Error checking version:", error);
    // Get local version even in error case
    const localVersion = require("../package.json").version;
    return {
      current: localVersion,
      latest: "unknown",
      needsUpdate: false,
      checkError: error.message,
    };
  }
}
