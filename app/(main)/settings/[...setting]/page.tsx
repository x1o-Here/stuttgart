import { SettingsPage } from "@/modules/catalog";

export default function Page({
  params,
}: {
  params: Promise<{ setting: string[] }>;
}) {
  return <SettingsPage params={params} />;
}
