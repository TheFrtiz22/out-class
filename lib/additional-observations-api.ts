'use client';
import type {z} from 'zod';
import {observationSave} from '@/lib/additional-observations';
import * as live from '@/actions/additional-observations';
const demo = () => import('@/lib/demo/additional-observations').catch((cause) => { throw new DemoUnavailableError(undefined, { cause }); });
import {demoGate} from "@/lib/demo/loader";
import {DemoUnavailableError} from "@/lib/demo/activation";
function fictional(input:unknown){return input&&typeof input==='object'&&'clubId'in input&&String(input.clubId).startsWith('de000000-');}
export async function getAdditionalObservations(input:unknown){if((await demoGate()))return (await demo()).getAdditionalObservations(input);if(fictional(input))throw Error('Enable Demo to access fictional observations.');return live.getAdditionalObservations(input);}
export async function saveAdditionalObservation(input:z.output<typeof observationSave>){if((await demoGate()))return (await demo()).saveAdditionalObservation(input);if(fictional(input))throw Error('Enable Demo to access fictional observations.');return live.saveAdditionalObservation(input);}
