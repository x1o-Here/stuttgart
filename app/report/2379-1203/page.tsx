import { Progress } from "@/components/ui/progress";
import { Regex } from "lucide-react";
import { Bodoni_Moda } from "next/font/google";

const bodoniModa = Bodoni_Moda({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700", "800", "900"],
});

export default function Page() {
    return (
        <div className="h-screen bg-black/90 flex items-center justify-center">
            <div className="flex flex-col items-center gap-16">
                <div className="flex items-center gap-4">
                    <Regex className="size-24 text-red-500" strokeWidth={1} />
                    <p className={`${bodoniModa.className} text-white text-8xl font-thin`}>Stuttgart</p>
                </div>

                <div className="flex flex-col items-center gap-2">
                    <Progress className="w-96" value={61} />
                    <p className="text-white font-light">Report is being generated... (61%)</p>
                </div>
            </div>
        </div>
    )
}