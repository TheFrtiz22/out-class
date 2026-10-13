"use server"
import { requireAuth } from "@/utils/auth"
import { prisma } from "@/utils/prisma"
import { ownPanelAssignments } from "@/utils/official-panel-schedule"
export async function getMyInterviewPanelSchedule(){const {user}=await requireAuth();return prisma.$transaction(tx=>ownPanelAssignments(tx,user.id))}
