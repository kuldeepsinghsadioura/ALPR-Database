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

function parseChangelog(markdown) {
  const versions = [];
  let currentVersion = null;
  let currentChanges = [];

  const lines = markdown.split("\n");

  for (const line of lines) {
    const versionMatch = line.match(
      /^##\s*\[([\d.]+)\]\s*-\s*(\d{4}-\d{2}-\d{2})/
    );

    if (versionMatch) {
      if (currentVersion) {
        versions.push({ ...currentVersion, changes: currentChanges });
      }
      currentVersion = {
        version: versionMatch[1],
        date: versionMatch[2],
      };
      currentChanges = [];
    } else if (line.trim().startsWith("- ")) {
      currentChanges.push(line.trim().substring(2));
    }
  }

  if (currentVersion) {
    versions.push({ ...currentVersion, changes: currentChanges });
  }

  return versions;
}
