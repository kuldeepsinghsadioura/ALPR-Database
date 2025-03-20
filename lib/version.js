export async function getVersionInfo() {
  try {
    const localVersion = require("../package.json").version;

    const [packageResponse, changelogResponse] = await Promise.all([
      fetch(
        "https://raw.githubusercontent.com/algertc/ALPR-Database/main/package.json",
        { next: { revalidate: 3600 } }
      ),
      fetch(
        "https://raw.githubusercontent.com/algertc/ALPR-Database/main/CHANGELOG.md",
        { next: { revalidate: 3600 } }
      ),
    ]);

    if (!packageResponse.ok) {
      throw new Error(`Version check failed: ${packageResponse.statusText}`);
    }

    const data = await packageResponse.json();
    let changelog = null;

    if (changelogResponse.ok) {
      const changelogText = await changelogResponse.text();
      changelog = parseChangelog(changelogText);
    }

    return {
      current: localVersion,
      latest: data.version,
      needsUpdate: localVersion !== data.version,
      changelog,
      checkError: null,
    };
  } catch (error) {
    console.error("Error checking version:", error);
    const localVersion = require("../package.json").version;
    return {
      current: localVersion,
      latest: "unknown",
      needsUpdate: false,
      changelog: null,
      checkError: error.message,
    };
  }
}

export async function getLocalVersionInfo() {
  try {
    const localVersion = require("../package.json").version;
    return localVersion;
  } catch (error) {
    console.error("Error getting local version:", error);
    return "unknown";
  }
}

function parseChangelog(markdown) {
  const versions = [];
  let currentVersion = null;
  let currentChanges = [];
  let inVersionSection = false;

  const lines = markdown.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Match version headers like "## [0.1.8] - 03-19-2025"
    const versionMatch = line.match(
      /^##\s*\[([\d.]+)\]\s*-\s*(\d{2}-\d{2}-\d{4})/
    );

    if (versionMatch) {
      // If we were already processing a version, save it before starting a new one
      if (currentVersion) {
        versions.push({ ...currentVersion, changes: currentChanges });
      }

      currentVersion = {
        version: versionMatch[1],
        date: versionMatch[2],
      };
      currentChanges = [];
      inVersionSection = true;

      // Look ahead to see if there's a paragraph after the version
      let j = i + 1;
      let paragraphText = "";

      // Skip empty lines
      while (j < lines.length && lines[j].trim() === "") {
        j++;
      }

      // Collect paragraph text (text that's not a bullet point and not a header)
      while (
        j < lines.length &&
        !lines[j].trim().startsWith("-") &&
        !lines[j].trim().startsWith("##") &&
        lines[j].trim() !== ""
      ) {
        paragraphText += " " + lines[j].trim();
        j++;
      }

      // If we found paragraph text, add it as the first item
      if (paragraphText.trim()) {
        currentChanges.push(paragraphText.trim());
      }
    } else if (inVersionSection && line.startsWith("- ")) {
      // Add bullet points as usual
      currentChanges.push(line.substring(2));
    } else if (line.startsWith("##")) {
      // Another header that's not a version - end the current section
      inVersionSection = false;
    }
  }

  // Don't forget to add the last version
  if (currentVersion) {
    versions.push({ ...currentVersion, changes: currentChanges });
  }

  return versions;
}
