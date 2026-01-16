import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, Wrench } from "lucide-react"
import Link from "next/link"

export default async function AuthErrorPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams

  return (
    <div className="flex min-h-svh w-full flex-col items-center justify-center p-4 bg-background">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          {/* Logo */}
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <Wrench className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-xl text-foreground">RevoAI</span>
          </div>

          <Card className="border-border bg-card">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8 text-destructive" />
              </div>
              <CardTitle className="text-2xl text-foreground">Authentication Error</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-sm text-muted-foreground mb-6">
                {params?.error || "An unexpected error occurred during authentication."}
              </p>
              <Link href="/" className="text-primary underline underline-offset-4 hover:text-primary/80 text-sm">
                Try again
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
