"use server"

import { GoogleGenAI } from "@google/genai"

const API_KEY = process.env.GEMINI_API_KEY || process.env.API_KEY || ""

interface ChatMessage {
  role: string
  parts: { text: string }[]
}

interface SendMessageParams {
  text: string
  vehicleContext: string
  history: ChatMessage[]
  obdData?: {
    isConnected: boolean
    rpm: number
    speed: number
    temp: number
    dtcs: string[]
  }
}

const repairGuideTool = {
  functionDeclarations: [
    {
      name: "create_repair_guide",
      description: "Create a step-by-step repair guide for a specific vehicle issue",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Title of the repair" },
          tools: { type: "array", items: { type: "string" }, description: "List of required tools" },
          estimatedTime: { type: "string", description: "Estimated time to complete (e.g., '1-2 hours')" },
          steps: { type: "array", items: { type: "string" }, description: "Detailed repair steps" },
        },
        required: ["title", "steps"],
      },
    },
  ],
}

const wiringDiagramTool = {
  functionDeclarations: [
    {
      name: "create_wiring_diagram",
      description:
        "Generate a simplified interactive wiring diagram for electrical troubleshooting. Use a 100x100 grid coordinate system. Place Power sources at the top (y around 10-20), Grounds at the bottom (y around 80-90), and switches/loads in between. Spread nodes horizontally (x from 10-90) for clarity.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Title of the circuit (e.g., 'Fuel Pump Circuit')" },
          nodes: {
            type: "array",
            description: "List of components in the circuit. Each node must have x,y coordinates on a 100x100 grid.",
            items: {
              type: "object",
              properties: {
                id: { type: "string", description: "Unique ID (e.g. 'n1', 'n2')" },
                type: {
                  type: "string",
                  enum: ["power", "ground", "fuse", "relay", "switch", "load", "connector", "module", "sensor"],
                  description: "Component type",
                },
                label: { type: "string", description: "Component name (e.g., 'Fuel Pump Relay', 'PCM')" },
                x: { type: "number", description: "X coordinate (0-100). Spread components horizontally." },
                y: {
                  type: "number",
                  description: "Y coordinate (0-100). Power at top (~10-20), Ground at bottom (~80-90).",
                },
                description: { type: "string", description: "Technical details (e.g., '15A Fuse', 'PCM Pin C4')" },
              },
              required: ["id", "type", "label", "x", "y"],
            },
          },
          connections: {
            type: "array",
            description: "Wires connecting the components",
            items: {
              type: "object",
              properties: {
                from: { type: "string", description: "Source Node ID" },
                to: { type: "string", description: "Target Node ID" },
                color: { type: "string", description: "Wire color code (e.g., 'BLK/WHT', 'RED', 'GRN/YEL')" },
                label: { type: "string", description: "Pin or circuit number" },
              },
              required: ["from", "to", "color"],
            },
          },
        },
        required: ["title", "nodes", "connections"],
      },
    },
  ],
}

export async function sendChatMessage(params: SendMessageParams) {
  if (!API_KEY) {
    throw new Error("API key is missing. Please provide a valid API key.")
  }

  const { text, vehicleContext, history, obdData } = params

  try {
    const ai = new GoogleGenAI({ apiKey: API_KEY })

    // Inject Live Data into system instruction if connected
    let systemInstruction = vehicleContext
    if (obdData?.isConnected) {
      systemInstruction += `\n[SYSTEM UPDATE]: Live Telemetry: RPM=${obdData.rpm}, Speed=${obdData.speed}, Temp=${obdData.temp}C.`
      if (obdData.dtcs.length > 0) {
        systemInstruction += ` ACTIVE DTCs: ${obdData.dtcs.join(", ")}.`
      }
    }

    const chat = ai.chats.create({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: systemInstruction,
        tools: [repairGuideTool, wiringDiagramTool],
      },
      history: history,
    })

    const result = await chat.sendMessage({ message: text })

    const toolCalls = result.functionCalls || []
    const responseText = result.text || ""

    return {
      text: responseText,
      toolCalls: toolCalls.map((call) => ({
        name: call.name,
        args: call.args,
      })),
    }
  } catch (error) {
    console.error("Chat Error:", error)
    throw new Error("Could not connect to Revo database.")
  }
}
