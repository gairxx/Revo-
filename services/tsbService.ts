import type { Vehicle, TSB } from "../types"

const API_KEY = process.env.GEMINI_API_KEY || ""

export const searchTSBs = async (vehicle: Vehicle, query: string): Promise<TSB[]> => {
  console.warn("This function is deprecated. Use the server action at app/actions/searchTSBs.ts instead.")
  throw new Error("Please use the server action for TSB search")
}
