import TableTabs from "./components/table-tabs";

export default function Home() {
  return (
    <div className="min-h-screen h-full p-4 flex items-center justify-center font-sans">
      <div className="w-full h-full p-4 bg-zinc-100 rounded-lg overflow-y-auto">
        <TableTabs />
      </div>
    </div>
  );
}
