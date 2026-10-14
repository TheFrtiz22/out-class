"use client"

import { createContext, useContext, useState, type ReactNode } from "react"

const initial = {
  question: "What draws you to investing?",
  answer: "I want to turn research into a clear recommendation, and learn from people who challenge how I think.",
  time: "6:30 PM",
  required: true,
}
const ExampleContext = createContext({ ...initial, setQuestion: (_value: string) => {}, setAnswer: (_value: string) => {}, setTime: (_value: string) => {}, setRequired: (_value: boolean) => {} })
export const useJourneyExample = () => useContext(ExampleContext)

/** Marketing-only state: carry a visitor's example edits into the next chapter. */
export function JourneyExampleProvider({ children }: { children: ReactNode }) {
  const [question, setQuestion] = useState(initial.question)
  const [answer, setAnswer] = useState(initial.answer)
  const [time, setTime] = useState(initial.time)
  const [required, setRequired] = useState(initial.required)
  return <ExampleContext.Provider value={{ question, answer, time, required, setQuestion, setAnswer, setTime, setRequired }}>{children}</ExampleContext.Provider>
}
