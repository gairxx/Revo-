"use client"

import { searchTSBs } from "../app/actions/searchTSBs"
import { useState } from "react"

const TSBModal = () => {
  const [query, setQuery] = useState("")
  const [vehicle, setVehicle] = useState("")
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState([])

  const handleSearch = async () => {
    if (!query.trim()) return
    setSearching(true)
    try {
      const results = await searchTSBs(vehicle, query)
      setResults(results)
    } catch (error) {
      console.error("Search failed:", error)
    } finally {
      setSearching(false)
    }
  }

  return <div>{/* Modal content */}</div>
}

export default TSBModal
