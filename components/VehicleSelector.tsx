"use client"

import type React from "react"
import { useState } from "react"
import type { Vehicle } from "@/types"
import { generateVehicleContextAction } from "@/app/actions/generateContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Car, Loader2 } from "lucide-react"

interface VehicleSelectorProps {
  onVehicleCreated: (vehicle: Vehicle) => void
}

const VehicleSelector: React.FC<VehicleSelectorProps> = ({ onVehicleCreated }) => {
  const [formData, setFormData] = useState({
    year: "",
    make: "",
    model: "",
    engine: "",
    vin: "",
  })
  const [loading, setLoading] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const contextString = await generateVehicleContextAction(formData)

      const newVehicle: Vehicle = {
        id: crypto.randomUUID(),
        ...formData,
        contextString,
        createdAt: Date.now(),
      }

      onVehicleCreated(newVehicle)
    } catch (err) {
      console.error(err)
      alert("Failed to initialize vehicle technician. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center flex-1 p-4 md:p-6">
      <Card className="max-w-md w-full bg-card border-border">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Car className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl text-foreground">Add Vehicle to Garage</CardTitle>
          <CardDescription className="text-muted-foreground">
            {"Enter vehicle details to initialize Revo's technical database"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="year" className="text-foreground">
                  Year
                </Label>
                <Input
                  required
                  type="text"
                  id="year"
                  name="year"
                  placeholder="2018"
                  value={formData.year}
                  onChange={handleChange}
                  className="min-h-[44px] bg-input border-border text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="make" className="text-foreground">
                  Make
                </Label>
                <Input
                  required
                  type="text"
                  id="make"
                  name="make"
                  placeholder="Ford"
                  value={formData.make}
                  onChange={handleChange}
                  className="min-h-[44px] bg-input border-border text-foreground"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="model" className="text-foreground">
                Model
              </Label>
              <Input
                required
                type="text"
                id="model"
                name="model"
                placeholder="F-150 Lariat"
                value={formData.model}
                onChange={handleChange}
                className="min-h-[44px] bg-input border-border text-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="engine" className="text-foreground">
                Engine (optional)
              </Label>
              <Input
                type="text"
                id="engine"
                name="engine"
                placeholder="5.0L Coyote V8"
                value={formData.engine}
                onChange={handleChange}
                className="min-h-[44px] bg-input border-border text-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vin" className="text-foreground">
                VIN (optional)
              </Label>
              <Input
                type="text"
                id="vin"
                name="vin"
                placeholder="1FTFW1E50JFA12345"
                value={formData.vin}
                onChange={handleChange}
                className="min-h-[44px] bg-input border-border text-foreground"
              />
            </div>

            <Button type="submit" disabled={loading} className="w-full min-h-[48px] text-base font-semibold mt-6">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Loading Database...
                </span>
              ) : (
                "Add to Garage"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default VehicleSelector
