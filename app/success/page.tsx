import { Suspense } from "react"
import { SuccessContent } from "./success-content"
import { Loader2 } from "lucide-react"

export default function SuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-svh flex flex-col items-center justify-center bg-background px-4">
          <div className="text-center space-y-4">
            <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
            <h1 className="text-xl font-semibold text-foreground">Loading...</h1>
          </div>
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  )
}
