'use client';
import type {z} from 'zod';
import {observationSave} from '@/lib/additional-observations';
import * as live from '@/actions/additional-observations';
import * as demo from '@/lib/demo/additional-observations';
import {demoStore} from '@/lib/demo/store';
function fictional(input:unknown){return input&&typeof input==='object'&&'clubId'in input&&String(input.clubId).startsWith('de000000-');}
export async function getAdditionalObservations(input:unknown){if(demoStore.active())return demo.getAdditionalObservations(input);if(fictional(input))throw Error('Enable Demo to access fictional observations.');return live.getAdditionalObservations(input);}
export async function saveAdditionalObservation(input:z.output<typeof observationSave>){if(demoStore.active())return demo.saveAdditionalObservation(input);if(fictional(input))throw Error('Enable Demo to access fictional observations.');return live.saveAdditionalObservation(input);}
