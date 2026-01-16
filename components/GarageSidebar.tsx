"use client"

import type React from "react"
import { useState } from "react"
import type { Vehicle } from "@/types"
import { createClient } from "@/lib/supabase/client"
import { Plus, Car, Trash2, LogOut, Wrench } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

interface GarageSidebarProps {
  vehicles: Vehicle[]
  currentVehicleId: string | null
  onSelectVehicle: (id: string) => void
  onNewVehicle: () => void
  onDeleteVehicle: (id: string) => void
  isSubscribed: boolean
}

const GarageSidebar: React.FC<GarageSidebarProps> = ({
  vehicles,
  currentVehicleId,
  onSelectVehicle,
  onNewVehicle,
  onDeleteVehicle,
  isSubscribed,
}) => {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/")
  }

  const handleDelete = async (e: React.MouseEvent, vehicleId: string) => {
    e.stopPropagation()
    if (confirm("Are you sure you want to remove this vehicle from your garage?")) {
      setDeletingId(vehicleId)
      onDeleteVehicle(vehicleId)
      setDeletingId(null)
    }
  }

  return (
    <aside className="w-72 bg-sidebar border-r border-sidebar-border flex-shrink-0 hidden md:flex flex-col z-20">
      {/* Header */}
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Wrench className="w-4 h-4 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold text-sidebar-foreground cursor-pointer" onClick={onNewVehicle}>
            REVO
          </h1>
        </div>
        <div className="flex items-center gap-1 mt-1">
          <p className="text-xs text-muted-foreground tracking-wider">AI MASTER TECH</p>
          {isSubscribed && (
            <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded border border-primary/30">
              PRO
            </span>
          )}
        </div>
      </div>

      {/* New Vehicle Button */}
      <div className="p-4">
        <Button onClick={onNewVehicle} className="w-full gap-2 min-h-[44px]" size="lg">
          <Plus className="w-5 h-5" />
          <span className="font-semibold">New Vehicle</span>
        </Button>
      </div>

      {/* Garage Section */}
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
                onClick={() => onSelectVehicle(v.id)}
                className={`group p-3 rounded-lg cursor-pointer transition-all border ${
                  currentVehicleId === v.id
                    ? "bg-sidebar-accent border-primary/50"
                    : "bg-card/50 border-transparent hover:bg-sidebar-accent hover:border-border"
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <div
                      className={`font-semibold truncate ${currentVehicleId === v.id ? "text-sidebar-foreground" : "text-muted-foreground"}`}
                    >
                      {v.year} {v.make}
                    </div>
                    <div className="text-sm text-muted-foreground truncate">{v.model}</div>
                    {v.engine && <div className="text-xs text-muted-foreground/70 truncate mt-0.5">{v.engine}</div>}
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    {currentVehicleId === v.id && <div className="w-2 h-2 bg-primary rounded-full"></div>}
                    <button
                      onClick={(e) => handleDelete(e, v.id)}
                      disabled={deletingId === v.id}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all"
                      title="Remove from garage"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Logout Button */}
      <div className="p-4 border-t border-sidebar-border">
        <Button variant="ghost" onClick={handleLogout} className="w-full gap-2 text-muted-foreground min-h-[44px]">
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </Button>
      </div>
    </aside>
  )
}

export default GarageSidebar
