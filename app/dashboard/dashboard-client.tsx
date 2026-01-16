"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import VehicleSelector from "@/components/VehicleSelector"
import AudioVisualizer from "@/components/AudioVisualizer"
import SubscriptionModal from "@/components/SubscriptionModal"
import RepairGuideCard from "@/components/RepairGuideCard"
import WiringDiagramViewer from "@/components/WiringDiagramViewer"
import TSBSearchModal from "@/components/TSBSearchModal"
import OBDDashboard from "@/components/OBDDashboard"
import GarageSidebar from "@/components/GarageSidebar"
import MobileGarageSheet from "@/components/MobileGarageSheet"
import {
  type Vehicle,
  type ChatMessage,
  type WiringNode,
  type WiringConnection,
  ConnectionState,
  type ChatSessionMap,
  type TSB,
  type OBDData,
} from "@/types"
import { useLiveSession } from "@/hooks/useLiveSession"
import { repairGuideTool, wiringDiagramTool } from "@/services/tools"
import { OBDService } from "@/services/obdService"
import { sendChatMessage } from "@/app/actions/sendChatMessage"
import { Wrench, Mic, Send, AlertTriangle, ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface DatabaseVehicle {
  id: string
  user_id: string
  year: number
  make: string
  model: string
  engine: string | null
  vin: string | null
  nickname: string | null
  context_string: string | null
  created_at: string
  updated_at: string
}

interface DashboardClientProps {
  initialVehicles: DatabaseVehicle[]
  userId: string
}

export default function DashboardClient({ initialVehicles, userId }: DashboardClientProps) {
  // Convert DB vehicles to app format
  const convertDbVehicle = (dbVehicle: DatabaseVehicle): Vehicle => ({
    id: dbVehicle.id,
    year: String(dbVehicle.year),
    make: dbVehicle.make,
    model: dbVehicle.model,
    engine: dbVehicle.engine || undefined,
    vin: dbVehicle.vin || undefined,
    contextString: dbVehicle.context_string || undefined,
    createdAt: new Date(dbVehicle.created_at).getTime(),
  })

  // Subscription State
  const [isSubscribed, setIsSubscribed] = useState(false)

  // State for managing multiple vehicles and their chat histories
  const [vehicles, setVehicles] = useState<Vehicle[]>(initialVehicles.map(convertDbVehicle))
  const [currentVehicleId, setCurrentVehicleId] = useState<string | null>(null)
  const [sessions, setSessions] = useState<ChatSessionMap>({})

  // UI State
  const [isLiveMode, setIsLiveMode] = useState(false)
  const [inputText, setInputText] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [showTSBModal, setShowTSBModal] = useState(false)
  const [showObdDashboard, setShowObdDashboard] = useState(false)

  // OBD State
  const [obdData, setObdData] = useState<OBDData>({
    rpm: 0,
    speed: 0,
    temp: 0,
    voltage: 0,
    dtcs: [],
    isConnected: false,
  })
  const obdServiceRef = useRef<OBDService | null>(null)

  const chatContainerRef = useRef<HTMLDivElement>(null)

  const currentVehicle = vehicles.find((v) => v.id === currentVehicleId) || null
  const currentHistory = currentVehicleId ? sessions[currentVehicleId] || [] : []

  // Init OBD Service
  useEffect(() => {
    obdServiceRef.current = new OBDService((data) => {
      setObdData((prev) => ({ ...prev, ...data }))
    })
    return () => {
      obdServiceRef.current?.disconnect()
    }
  }, [])

  const handleConnectOBD = async () => {
    if (obdServiceRef.current) {
      const success = await obdServiceRef.current.connect()
      if (success) {
        setObdData((prev) => ({ ...prev, isConnected: true }))
        setShowObdDashboard(true)
        setTimeout(() => {
          obdServiceRef.current?.scanDTCs()
        }, 2000)
      }
    }
  }

  const handleDisconnectOBD = () => {
    obdServiceRef.current?.disconnect()
    setObdData((prev) => ({ ...prev, isConnected: false }))
    setShowObdDashboard(false)
  }

  const handleScanDTCs = async () => {
    if (obdServiceRef.current) {
      await obdServiceRef.current.scanDTCs()
    }
  }

  const handleDiscussDTCs = (codes: string[]) => {
    setShowObdDashboard(false)
    const codeList = codes.join(", ")
    sendMessageToChat(
      `I have detected the following DTCs: ${codeList}. What do these mean for a ${currentVehicle?.year} ${currentVehicle?.model}, and how should I proceed?`,
    )
  }

  // Helper to update history for a specific vehicle
  const updateHistory = (vehicleId: string, message: ChatMessage) => {
    setSessions((prev) => ({
      ...prev,
      [vehicleId]: [...(prev[vehicleId] || []), message],
    }))
  }

  // Construct dynamic system instruction with Live Data
  const getDynamicContext = () => {
    let context = currentVehicle?.contextString || ""
    if (obdData.isConnected) {
      context += `\n\n[HIDDEN REAL-TIME TELEMETRY STREAM - USE THIS DATA TO ASSIST DIAGNOSIS BUT DO NOT RECITE IT UNLESS RELEVANT]\nCURRENT RPM: ${obdData.rpm}\nSPEED: ${obdData.speed} km/h\nCOOLANT TEMP: ${obdData.temp}°C\nIf values are abnormal (e.g. Temp > 110C), warn the user immediately.`
    }
    if (obdData.dtcs.length > 0) {
      context += `\n\n[ACTIVE FAULT CODES DETECTED]: ${obdData.dtcs.join(", ")}. The user may not know these codes exist. Use this information to guide your diagnosis.`
    }
    return context
  }

  // --- Live Session Hook ---
  const { connect, disconnect, connectionState, volume, isAiSpeaking } = useLiveSession({
    systemInstruction: getDynamicContext(),
    tools: [repairGuideTool, wiringDiagramTool],
    onTranscript: (text, sender) => {
      if (!currentVehicleId) return

      const newMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: sender,
        text: text,
        timestamp: Date.now(),
      }

      setSessions((prev) => {
        const vehicleHistory = prev[currentVehicleId] || []
        const lastMsg = vehicleHistory[vehicleHistory.length - 1]

        if (
          lastMsg &&
          lastMsg.role === sender &&
          Date.now() - lastMsg.timestamp < 5000 &&
          !lastMsg.repairGuide &&
          !lastMsg.wiringDiagram
        ) {
          const updatedHistory = [...vehicleHistory]
          updatedHistory[updatedHistory.length - 1] = {
            ...lastMsg,
            text: lastMsg.text + text,
            timestamp: Date.now(),
          }
          return { ...prev, [currentVehicleId]: updatedHistory }
        }

        return {
          ...prev,
          [currentVehicleId]: [...vehicleHistory, newMessage],
        }
      })
    },
    onToolCall: (toolCall) => {
      if (!currentVehicleId) return null

      if (toolCall.name === "create_repair_guide") {
        try {
          const guideData = toolCall.args as Record<string, unknown>
          const systemMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: "model",
            text: `I've prepared a repair checklist for: ${guideData.title}`,
            timestamp: Date.now(),
            repairGuide: {
              title: guideData.title as string,
              tools: (guideData.tools as string[]) || [],
              estimatedTime: (guideData.estimatedTime as string) || "Unknown",
              steps: ((guideData.steps as string[]) || []).map((step: string) => ({
                id: crypto.randomUUID(),
                text: step,
                isCompleted: false,
              })),
            },
          }
          updateHistory(currentVehicleId, systemMsg)
          return "Checklist created and displayed to user."
        } catch (e) {
          console.error("Error processing voice tool", e)
          return "Failed to create checklist."
        }
      }

      if (toolCall.name === "create_wiring_diagram") {
        try {
          const diagramData = toolCall.args as Record<string, unknown>
          const systemMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: "model",
            text: `I've generated a wiring diagram for: ${diagramData.title}`,
            timestamp: Date.now(),
            wiringDiagram: {
              title: diagramData.title as string,
              nodes: (diagramData.nodes as WiringNode[]) || [],
              connections: (diagramData.connections as WiringConnection[]) || [],
            },
          }
          updateHistory(currentVehicleId, systemMsg)
          return "Wiring diagram displayed."
        } catch (e) {
          console.error("Error processing wiring tool", e)
          return "Failed to create wiring diagram."
        }
      }
      return null
    },
  })

  // Scroll to bottom on new messages
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [currentHistory, currentVehicleId])

  // Cleanup live session when switching vehicles
  useEffect(() => {
    if (connectionState === ConnectionState.CONNECTED || connectionState === ConnectionState.CONNECTING) {
      disconnect()
      setIsLiveMode(false)
    }
  }, [currentVehicleId])

  const handleVehicleCreated = async (vehicle: Vehicle) => {
    // Save to Supabase
    const supabase = createClient()
    const { data, error } = await supabase
      .from("vehicles")
      .insert({
        user_id: userId,
        year: Number.parseInt(vehicle.year),
        make: vehicle.make,
        model: vehicle.model,
        engine: vehicle.engine || null,
        vin: vehicle.vin || null,
        context_string: vehicle.contextString || null,
      })
      .select()
      .single()

    if (error) {
      console.error("Error saving vehicle:", error)
      alert("Failed to save vehicle to garage")
      return
    }

    const savedVehicle = convertDbVehicle(data)
    setVehicles((prev) => [savedVehicle, ...prev])
    setCurrentVehicleId(savedVehicle.id)

    const initMsg: ChatMessage = {
      id: "init",
      role: "system",
      text: `Vehicle Connected: ${savedVehicle.year} ${savedVehicle.make} ${savedVehicle.model}.\nTech Database Loaded.\n\nModes Available:\n1. Text Chat (Standard)\n2. Live Voice (Say "Hey Revo")\n3. TSB Database Search`,
      timestamp: Date.now(),
    }
    setSessions((prev) => ({ ...prev, [savedVehicle.id]: [initMsg] }))
  }

  const handleSelectVehicle = (id: string) => {
    setCurrentVehicleId(id)

    // Initialize session if not exists
    if (!sessions[id]) {
      const vehicle = vehicles.find((v) => v.id === id)
      if (vehicle) {
        const initMsg: ChatMessage = {
          id: "init",
          role: "system",
          text: `Vehicle Connected: ${vehicle.year} ${vehicle.make} ${vehicle.model}.\nTech Database Loaded.`,
          timestamp: Date.now(),
        }
        setSessions((prev) => ({ ...prev, [id]: [initMsg] }))
      }
    }
  }

  const handleDeleteVehicle = async (id: string) => {
    const supabase = createClient()
    const { error } = await supabase.from("vehicles").delete().eq("id", id)

    if (error) {
      console.error("Error deleting vehicle:", error)
      return
    }

    setVehicles((prev) => prev.filter((v) => v.id !== id))
    if (currentVehicleId === id) {
      setCurrentVehicleId(null)
    }
    setSessions((prev) => {
      const newSessions = { ...prev }
      delete newSessions[id]
      return newSessions
    })
  }

  const toggleLiveMode = () => {
    const isLiveAudioEnabled = true

    if (!isLiveAudioEnabled) {
      alert("Live audio mode is temporarily disabled. Please use text chat.")
      return
    }

    if (isLiveMode) {
      disconnect()
      setIsLiveMode(false)
    } else {
      setIsLiveMode(true)
      connect()
    }
  }

  // Helper to process message sending
  const sendMessageToChat = async (text: string) => {
    if (!text.trim() || !currentVehicle) return

    setIsGenerating(true)

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: text,
      timestamp: Date.now(),
    }
    updateHistory(currentVehicle.id, userMsg)

    try {
      const historyForModel = currentHistory
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role,
          parts: [{ text: m.text }],
        }))

      const result = await sendChatMessage({
        text,
        vehicleContext: currentVehicle.contextString,
        history: historyForModel,
        obdData: obdData.isConnected ? obdData : undefined,
      })

      const toolCalls = result.toolCalls
      const responseText = result.text

      if (toolCalls && toolCalls.length > 0) {
        const call = toolCalls[0]

        if (call.name === "create_repair_guide") {
          const args = call.args as Record<string, unknown>
          const guideMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: "model",
            text: responseText || `Here is the repair guide for ${args.title}:`,
            timestamp: Date.now(),
            repairGuide: {
              title: args.title as string,
              tools: (args.tools as string[]) || [],
              estimatedTime: (args.estimatedTime as string) || "Unknown",
              steps: ((args.steps as string[]) || []).map((step: string) => ({
                id: crypto.randomUUID(),
                text: step,
                isCompleted: false,
              })),
            },
          }
          updateHistory(currentVehicle.id, guideMsg)
          setIsGenerating(false)
          return
        }

        if (call.name === "create_wiring_diagram") {
          const args = call.args as Record<string, unknown>
          const diagramMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: "model",
            text: responseText || `Here is the wiring diagram for ${args.title}:`,
            timestamp: Date.now(),
            wiringDiagram: {
              title: args.title as string,
              nodes: (args.nodes as WiringNode[]) || [],
              connections: (args.connections as WiringConnection[]) || [],
            },
          }
          updateHistory(currentVehicle.id, diagramMsg)
          setIsGenerating(false)
          return
        }
      }

      const modelMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "model",
        text: responseText,
        timestamp: Date.now(),
      }
      updateHistory(currentVehicle.id, modelMsg)
    } catch (error) {
      console.error("Chat Error:", error)
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "system",
        text: error instanceof Error ? error.message : "Error: Could not connect to Revo database.",
        timestamp: Date.now(),
      }
      updateHistory(currentVehicle.id, errorMsg)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSendText = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!inputText.trim()) return
    sendMessageToChat(inputText.trim())
    setInputText("")
  }

  const handleDiscussTSB = (tsb: TSB) => {
    setShowTSBModal(false)
    sendMessageToChat(
      `I found TSB ${tsb.bulletinNumber}: "${tsb.title}". The summary is: ${tsb.summary}. Can you explain the repair procedure for this?`,
    )
  }

  const handleNewSession = () => {
    setCurrentVehicleId(null)
  }

  return (
    <div className="flex h-svh bg-background text-foreground overflow-hidden font-sans relative">
      {/* Subscription Gate */}
      {!isSubscribed && <SubscriptionModal onSubscribe={() => setIsSubscribed(true)} />}

      {/* TSB Modal */}
      {showTSBModal && currentVehicle && (
        <TSBSearchModal vehicle={currentVehicle} onClose={() => setShowTSBModal(false)} onDiscuss={handleDiscussTSB} />
      )}

      {/* Desktop Sidebar */}
      <GarageSidebar
        vehicles={vehicles}
        currentVehicleId={currentVehicleId}
        onSelectVehicle={handleSelectVehicle}
        onNewVehicle={handleNewSession}
        onDeleteVehicle={handleDeleteVehicle}
        isSubscribed={isSubscribed}
      />

      {/* Main Content */}
      <main
        className={`flex-1 flex flex-col relative h-full transition-opacity duration-500 ${!isSubscribed ? "opacity-0 pointer-events-none" : "opacity-100"}`}
      >
        {!currentVehicle ? (
          <div className="flex-1 flex flex-col">
            {/* Mobile Header when no vehicle selected */}
            <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 md:hidden">
              <MobileGarageSheet
                vehicles={vehicles}
                currentVehicleId={currentVehicleId}
                onSelectVehicle={handleSelectVehicle}
                onNewVehicle={handleNewSession}
                onDeleteVehicle={handleDeleteVehicle}
                isSubscribed={isSubscribed}
              />
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <Wrench className="w-4 h-4 text-primary-foreground" />
                </div>
                <span className="font-semibold text-foreground">REVO</span>
              </div>
              <div className="w-10" />
            </header>
            <VehicleSelector onVehicleCreated={handleVehicleCreated} />
          </div>
        ) : (
          <>
            {/* Top Bar */}
            <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 z-10 shrink-0">
              <div className="flex items-center gap-3">
                {/* Mobile Menu */}
                <MobileGarageSheet
                  vehicles={vehicles}
                  currentVehicleId={currentVehicleId}
                  onSelectVehicle={handleSelectVehicle}
                  onNewVehicle={handleNewSession}
                  onDeleteVehicle={handleDeleteVehicle}
                  isSubscribed={isSubscribed}
                />
                <button
                  onClick={() => setCurrentVehicleId(null)}
                  className="hidden md:flex items-center text-muted-foreground hover:text-foreground"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div>
                  <h2 className="font-bold text-foreground text-base md:text-lg leading-none">
                    {currentVehicle.year} {currentVehicle.make} {currentVehicle.model}
                  </h2>
                  {currentVehicle.engine && (
                    <span className="text-xs text-primary font-mono">{currentVehicle.engine}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 md:gap-4">
                {/* OBD Toggle */}
                <div className="hidden sm:flex items-center bg-secondary rounded-lg p-1 border border-border">
                  <button
                    onClick={!obdData.isConnected ? handleConnectOBD : handleDisconnectOBD}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition min-h-[32px] ${
                      obdData.isConnected
                        ? "bg-green-500/20 text-green-400"
                        : "bg-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <div
                      className={`w-2 h-2 rounded-full ${obdData.isConnected ? "bg-green-500 animate-pulse" : "bg-muted-foreground"}`}
                    />
                    {obdData.isConnected ? "OBD Active" : "Link OBD"}
                  </button>
                  {obdData.isConnected && (
                    <button
                      onClick={() => setShowObdDashboard(!showObdDashboard)}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition border-l border-border min-h-[32px] ${
                        showObdDashboard
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      View Data
                    </button>
                  )}
                </div>

                {/* TSB Search Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTSBModal(true)}
                  className="gap-2 min-h-[36px] hidden sm:flex"
                >
                  <AlertTriangle className="w-4 h-4 text-orange-400" />
                  <span className="hidden lg:inline">Search TSBs</span>
                </Button>

                {/* Mode Toggle */}
                <div className="flex items-center gap-1 bg-secondary rounded-full p-1 border border-border">
                  <button
                    onClick={() => isLiveMode && toggleLiveMode()}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all min-h-[32px] ${!isLiveMode ? "bg-card text-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    TEXT
                  </button>
                  <button
                    onClick={() => !isLiveMode && toggleLiveMode()}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1 transition-all min-h-[32px] ${isLiveMode ? "bg-destructive text-destructive-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <Mic className="w-3 h-3" />
                    LIVE
                  </button>
                </div>
              </div>
            </header>

            {/* Chat Area */}
            <div
              ref={chatContainerRef}
              className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scroll-smooth bg-background"
            >
              {/* OBD Dashboard Overlay */}
              {showObdDashboard && obdData.isConnected && (
                <div className="mb-6 animate-in slide-in-from-top-4 fade-in">
                  <OBDDashboard
                    data={obdData}
                    connectionStatus={obdData.isConnected}
                    onConnect={handleConnectOBD}
                    onDisconnect={handleDisconnectOBD}
                    onScanDTCs={handleScanDTCs}
                    onDiscussDTCs={handleDiscussDTCs}
                  />
                </div>
              )}

              {currentHistory.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2`}
                >
                  <div
                    className={`max-w-[90%] md:max-w-[75%] rounded-2xl p-4 shadow-md ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-none"
                        : msg.role === "system"
                          ? "bg-muted border border-border text-muted-foreground w-full text-center text-sm font-mono my-4"
                          : "bg-card text-card-foreground border border-border rounded-bl-none"
                    }`}
                  >
                    <div
                      className={`flex items-center gap-2 mb-1 text-[10px] uppercase tracking-wider font-bold ${msg.role === "user" ? "text-primary-foreground/70" : "text-primary"}`}
                    >
                      {msg.role === "model" ? "REVO" : msg.role === "system" ? "SYSTEM" : "YOU"}
                    </div>
                    <p className="leading-relaxed whitespace-pre-wrap text-sm md:text-base">{msg.text}</p>
                    {msg.repairGuide && (
                      <div className="mt-4">
                        <RepairGuideCard guide={msg.repairGuide} />
                      </div>
                    )}
                    {msg.wiringDiagram && (
                      <div className="mt-4">
                        <WiringDiagramViewer diagram={msg.wiringDiagram} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div className="h-4" />
            </div>

            {/* Input Area */}
            <div className="bg-card border-t border-border p-4 z-20">
              <div className="max-w-4xl mx-auto">
                {isLiveMode ? (
                  <div className="flex items-center justify-between gap-4 bg-destructive/10 p-2 rounded-2xl border border-destructive/30 mt-4">
                    <div className="flex-1 relative h-16">
                      <AudioVisualizer
                        isActive={connectionState === ConnectionState.CONNECTED}
                        isSpeaking={isAiSpeaking}
                        volume={volume}
                      />
                      {connectionState === ConnectionState.CONNECTING && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-xl backdrop-blur-sm">
                          <span className="text-primary text-xs font-mono animate-pulse">
                            CONNECTING SECURE UPLINK...
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <div className="text-[10px] text-destructive font-mono text-center animate-pulse">
                        LIVE FEED ACTIVE
                      </div>
                      <Button onClick={toggleLiveMode} variant="destructive" className="min-h-[44px]">
                        Disconnect
                      </Button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSendText} className="relative flex gap-2 mt-4">
                    <Input
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="Describe the issue or ask for specs..."
                      className="flex-1 min-h-[48px] bg-input border-border text-foreground"
                      disabled={isGenerating}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={toggleLiveMode}
                      className="absolute right-14 top-1 bottom-1 min-w-[44px]"
                      title="Switch to Voice Mode"
                    >
                      <Mic className="w-5 h-5 text-muted-foreground" />
                    </Button>
                    <Button
                      type="submit"
                      disabled={!inputText.trim() || isGenerating}
                      className="min-h-[48px] min-w-[48px]"
                    >
                      {isGenerating ? (
                        <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      ) : (
                        <Send className="w-5 h-5" />
                      )}
                    </Button>
                  </form>
                )}
                <div className="text-center mt-2">
                  <p className="text-[10px] text-muted-foreground font-mono">
                    {isLiveMode ? 'LISTENING FOR "HEY REVO"' : "REVO v2.5 DIAGNOSTIC SYSTEM READY"}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
