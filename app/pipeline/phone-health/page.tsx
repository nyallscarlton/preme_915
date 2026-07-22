import { PhoneHealthPanel } from "@/components/pipeline/phone-health"

export const dynamic = "force-dynamic"

export default function PhoneHealthPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Phone Health</h1>
        <p className="text-sm text-gray-500">Number pool status, spam-label monitoring, and dial health</p>
      </div>
      <PhoneHealthPanel />
    </div>
  )
}
