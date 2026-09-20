"use client"
import { ApplicationStateProvider } from "@/lib/application-state"
import { StudentCheckIn } from "@/components/qr/student-check-in"
export default function CheckInPage() {
  return <ApplicationStateProvider><StudentCheckIn /></ApplicationStateProvider>
}
