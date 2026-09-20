"use client"
import { useState } from "react"
import { eventsAttended, type Attendance } from "@/lib/attendance"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
export function LeadsTable({ attendance, applicantIds, clubId }: { attendance: Attendance[]; applicantIds: Set<string>; clubId: string }) {
  const [search, setSearch] = useState("")
  const students = Array.from(new Map(attendance.filter(row => row.clubId === clubId && !applicantIds.has(row.studentId)).map(row => [row.studentId, row.student])).values())
  const visible = students.filter(student => `${student.name} ${student.email} ${student.major} ${student.year}`.toLowerCase().includes(search.toLowerCase()))
  return <section className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5 font-sans text-black shadow-none">
    <div><h2 className="font-semibold">Interested Leads <span className="text-neutral-500">({students.length})</span></h2><p className="mt-1 text-sm text-neutral-500">Students who checked in at an event and haven’t started an application.</p></div>
    <Input aria-label="Search interested leads" placeholder="Search leads…" value={search} onChange={event => setSearch(event.target.value)} className="max-w-sm shadow-none" />
    <Table><TableHeader><TableRow>{["Name", "Year", "Major", "Events Attended"].map(label => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader><TableBody>
      {visible.map(student => <TableRow key={student.id}><TableCell className="font-medium">{student.name}</TableCell><TableCell>{student.year}</TableCell><TableCell>{student.major}</TableCell><TableCell className="tabular-nums">{eventsAttended(attendance, clubId, student.id)}</TableCell></TableRow>)}
      {!visible.length && <TableRow><TableCell colSpan={4} className="py-12 text-center text-neutral-500">{students.length ? "No leads match your search." : "No interested leads yet. Share an event QR code to start capturing interest."}</TableCell></TableRow>}
    </TableBody></Table>
  </section>
}
