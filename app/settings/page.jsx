// app/settings/page.jsx
import SettingsForm from "./SettingsForm";
import { getSettings } from "@/app/actions";
import { getAuthConfig } from "@/lib/auth";

// Force dynamic behavior since config can change
export const dynamic = "force-dynamic";
// Optionally, also disable caching
export const revalidate = 0;

export default async function SettingsPage() {
  const [settings, authConfig] = await Promise.all([
    getSettings(),
    getAuthConfig(),
  ]);

  if (!settings) {
    throw new Error("Failed to load settings");
  }

  return (
    <SettingsForm
      initialSettings={settings}
      initialApiKey={authConfig.apiKey}
    />
  );
}
