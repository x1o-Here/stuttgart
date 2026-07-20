"use client";

import { Building, ChevronRight, Forklift, Tags } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const SETTINGS = [
  {
    name: "Account Types",
    description: "Manage account types",
    icon: <Tags />,
    path: "/settings/account-types",
  },
  {
    name: "Departments",
    description: "Manage departments",
    icon: <Building />,
    path: "/settings/departments",
  },
  {
    name: "Vehicles",
    description: "Manage vehicles",
    icon: <Forklift />,
    path: "/settings/vehicles",
  },
];

export default function SettingsPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen h-full p-4 flex items-center justify-center font-sans">
      <div className="w-full h-full flex flex-col gap-4 p-4 bg-zinc-100 rounded-lg overflow-y-auto">
        <h1 className="text-2xl font-bold mb-4">Settings</h1>

        <div className="p-4 bg-white rounded-md flex flex-col gap-6">
          <h2 className="text-lg font-semibold">System Settings</h2>
          <div className="grid grid-cols-2 gap-2">
            {SETTINGS.map((setting) => (
              <div
                key={setting.name}
                className="w-full rounded-md flex justify-between border p-2"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-sm aspect-square bg-gray-100">
                    {setting.icon}
                  </div>
                  <div className="flex flex-col">
                    <p className="font-medium">{setting.name}</p>
                    <p className="text-xs font-light text-gray-500">
                      {setting.description}
                    </p>
                  </div>
                </div>

                <div className="border-l px-2 flex items-center justify-center">
                  <Button
                    variant="secondary"
                    size="icon-sm"
                    className="rounded-full cursor-pointer"
                    onClick={() => router.push(setting.path)}
                  >
                    <ChevronRight />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
