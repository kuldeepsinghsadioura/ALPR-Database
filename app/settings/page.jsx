import SettingsForm from "./SettingsForm";
import { getConfig } from "@/lib/settings";
import { getAuthConfig } from "@/lib/auth";

// Force dynamic behavior since config can change
export const dynamic = "force-dynamic";
// Optionally, also disable caching
export const revalidate = 0;

export default async function SettingsPage() {
  const [settings, authConfig] = await Promise.all([
    getConfig(),
    getAuthConfig(),
  ]);

  return (
    <SettingsForm
      initialSettings={settings}
      initialApiKey={authConfig.apiKey}
    />
  );
}
