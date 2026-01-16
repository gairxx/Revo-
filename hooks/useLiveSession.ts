"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { ConnectionState } from "../types"

interface UseLiveSessionProps {
  systemInstruction: string
  onTranscript: (text: string, sender: "user" | "model") => void
  onToolCall?: (toolCall: { name: string; args: any; id: string }) => Promise<any> | any
  tools?: any[]
}

// Audio processing utilities
function floatTo16BitPCM(float32Array: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(float32Array.length * 2)
  const view = new DataView(buffer)
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]))
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return buffer
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes.buffer
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export const useLiveSession = ({ systemInstruction, onTranscript, onToolCall, tools }: UseLiveSessionProps) => {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED)
  const [volume, setVolume] = useState(0)
  const [isAiSpeaking, setIsAiSpeaking] = useState(false)

  const audioContextRef = useRef<AudioContext | null>(null)
  const inputContextRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const analyzerRef = useRef<AnalyserNode | null>(null)
  const isRecordingRef = useRef(false)
  const audioChunksRef = useRef<string[]>([])
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const systemInstructionRef = useRef(systemInstruction)

  // Keep system instruction up to date
  useEffect(() => {
    systemInstructionRef.current = systemInstruction
  }, [systemInstruction])

  // Process and send audio to server
  const processAudioChunk = useCallback(
    async (audioBase64: string) => {
      try {
        const response = await fetch("/api/live-audio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audioData: audioBase64,
            systemInstruction: systemInstructionRef.current,
          }),
        })

        const data = await response.json()

        if (data.error) {
          console.error("Audio processing error:", data.error)
          return
        }

        // Handle text transcript
        if (data.text) {
          onTranscript(data.text, "model")
        }

        // Handle audio response
        if (data.audioData) {
          setIsAiSpeaking(true)
          await playAudioResponse(data.audioData)
          setIsAiSpeaking(false)
        }
      } catch (error) {
        console.error("Failed to process audio:", error)
      }
    },
    [onTranscript],
  )

  // Play audio response from AI
  const playAudioResponse = async (base64Audio: string) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext({ sampleRate: 24000 })
    }

    try {
      const audioBuffer = base64ToArrayBuffer(base64Audio)
      const audioData = new Int16Array(audioBuffer)
      const floatData = new Float32Array(audioData.length)

      for (let i = 0; i < audioData.length; i++) {
        floatData[i] = audioData[i] / 32768
      }

      const buffer = audioContextRef.current.createBuffer(1, floatData.length, 24000)
      buffer.getChannelData(0).set(floatData)

      const source = audioContextRef.current.createBufferSource()
      source.buffer = buffer
      source.connect(audioContextRef.current.destination)
      source.start()

      await new Promise<void>((resolve) => {
        source.onended = () => resolve()
      })
    } catch (error) {
      console.error("Failed to play audio:", error)
    }
  }

  // Disconnect function
  const disconnect = useCallback(() => {
    isRecordingRef.current = false

    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current)
      silenceTimeoutRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }

    if (inputContextRef.current) {
      inputContextRef.current.close()
      inputContextRef.current = null
    }

    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    // Notify server session ended
    fetch("/api/live-audio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isEnd: true }),
    }).catch(() => {})

    setConnectionState(ConnectionState.DISCONNECTED)
    setIsAiSpeaking(false)
    setVolume(0)
  }, [])

  // Connect and start recording
  const connect = useCallback(async () => {
    try {
      setConnectionState(ConnectionState.CONNECTING)

      // Initialize session on server
      const initResponse = await fetch("/api/live-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isStart: true, systemInstruction: systemInstructionRef.current }),
      })

      if (!initResponse.ok) {
        throw new Error("Failed to initialize audio session")
      }

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })

      streamRef.current = stream
      inputContextRef.current = new AudioContext({ sampleRate: 16000 })
      audioContextRef.current = new AudioContext({ sampleRate: 24000 })

      const source = inputContextRef.current.createMediaStreamSource(stream)
      const processor = inputContextRef.current.createScriptProcessor(4096, 1, 1)
      const analyzer = inputContextRef.current.createAnalyser()
      analyzer.fftSize = 256

      processorRef.current = processor
      analyzerRef.current = analyzer

      source.connect(analyzer)
      analyzer.connect(processor)
      processor.connect(inputContextRef.current.destination)

      isRecordingRef.current = true
      let audioBuffer: Float32Array[] = []
      let silenceFrames = 0
      const SILENCE_THRESHOLD = 0.01
      const SILENCE_FRAMES_NEEDED = 15 // ~0.4 seconds of silence

      processor.onaudioprocess = (e) => {
        if (!isRecordingRef.current) return

        const inputData = e.inputBuffer.getChannelData(0)

        // Calculate volume for visualization
        const dataArray = new Uint8Array(analyzer.frequencyBinCount)
        analyzer.getByteFrequencyData(dataArray)
        const avg = dataArray.reduce((a, b) => a + b) / dataArray.length
        setVolume(avg / 255)

        // Check for silence
        const maxAmplitude = Math.max(...Array.from(inputData).map(Math.abs))

        if (maxAmplitude < SILENCE_THRESHOLD) {
          silenceFrames++
        } else {
          silenceFrames = 0
        }

        // Accumulate audio
        audioBuffer.push(new Float32Array(inputData))

        // When we detect silence after speech, send the audio
        if (silenceFrames >= SILENCE_FRAMES_NEEDED && audioBuffer.length > SILENCE_FRAMES_NEEDED) {
          const totalLength = audioBuffer.reduce((sum, chunk) => sum + chunk.length, 0)
          const combinedBuffer = new Float32Array(totalLength)
          let offset = 0

          for (const chunk of audioBuffer) {
            combinedBuffer.set(chunk, offset)
            offset += chunk.length
          }

          const pcmData = floatTo16BitPCM(combinedBuffer)
          const base64Audio = arrayBufferToBase64(pcmData)

          // Transcribe user speech (simplified - in production you'd use speech-to-text)
          onTranscript("[Voice input received]", "user")

          // Send to server for processing
          processAudioChunk(base64Audio)

          // Reset buffer
          audioBuffer = []
          silenceFrames = 0
        }
      }

      setConnectionState(ConnectionState.CONNECTED)
    } catch (error: any) {
      console.error("Failed to connect:", error)
      setConnectionState(ConnectionState.DISCONNECTED)

      if (error.name === "NotAllowedError") {
        alert("Microphone access denied. Please allow microphone access to use voice mode.")
      } else {
        alert("Failed to start voice mode: " + error.message)
      }
    }
  }, [onTranscript, processAudioChunk])

  useEffect(() => {
    return () => disconnect()
  }, [disconnect])

  return {
    connect,
    disconnect,
    connectionState,
    volume,
    isAiSpeaking,
  }
}
