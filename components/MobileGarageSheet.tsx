"use client"

import type React from "react"
import type { Vehicle } from "@/types"
import { createClient } from "@/lib/supabase/client"
import { Plus, Car, LogOut, Wrench, Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { useRouter } from "next/navigation"
import { useState } from "react"

interface MobileGarageSheetProps {
  vehicles: Vehicle[]
  currentVehicleId: string | null
  onSelectVehicle: (id: string) => void
  onNewVehicle: () => void
  onDeleteVehicle: (id: string) => void
  isSubscribed: boolean
}

const MobileGarageSheet: React.FC<MobileGarageSheetProps> = ({
  vehicles,
  currentVehicleId,
  onSelectVehicle,
  onNewVehicle,
  onDeleteVehicle,
  isSubscribed,
}) => {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/")
  }

  const handleSelectVehicle = (id: string) => {
    onSelectVehicle(id)
    setOpen(false)
  }

  const handleNewVehicle = () => {
    onNewVehicle()
    setOpen(false)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden min-w-[44px] min-h-[44px]">
          <Menu className="w-5 h-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[300px] bg-sidebar p-0">
        <SheetHeader className="p-6 border-b border-sidebar-border">
          <SheetTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Wrench className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-sidebar-foreground">REVO</span>
            {isSubscribed && (
              <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded border border-primary/30">
                PRO
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="p-4">
          <Button onClick={handleNewVehicle} className="w-full gap-2 min-h-[44px]" size="lg">
            <Plus className="w-5 h-5" />
            <span className="font-semibold">New Vehicle</span>
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <div className="flex items-center gap-2 mb-3">
            <Car className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">My Garage</span>
          </div>

          {vehicles.length === 0 ? (
            <div className="text-sm text-muted-foreground italic px-2 py-4 text-center">
              No vehicles in your garage yet
            </div>
          ) : (
            <div className="space-y-2">
              {vehicles.map((v) => (
                <div
                  key={v.id}
                  onClick={() => handleSelectVehicle(v.id)}
                  className={`group p-3 rounded-lg cursor-pointer transition-all border ${
                    currentVehicleId === v.id
                      ? "bg-sidebar-accent border-primary/50"
                      : "bg-card/50 border-transparent hover:bg-sidebar-accent"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate text-sidebar-foreground">
                        {v.year} {v.make}
                      </div>
                      <div className="text-sm text-muted-foreground truncate">{v.model}</div>
                    </div>
                    {currentVehicleId === v.id && <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-sidebar-border mt-auto">
          <Button variant="ghost" onClick={handleLogout} className="w-full gap-2 text-muted-foreground min-h-[44px]">
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export default MobileGarageSheet
