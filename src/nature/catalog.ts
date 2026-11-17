// @ts-expect-error Shared original procedural catalogue also runs in AudioWorklet/WAV workers.
import { ambienceCatalog } from "../../public/ambience.js";
export type AmbienceSound = "stream"|"river"|"waterfall"|"spring"|"fountain"|"droplets"|"cave"|"drizzle"|"rain"|"downpour"|"leaves"|"roof"|"shore"|"surf"|"coast"|"breeze"|"forest"|"bamboo"|"birds"|"dawn"|"crickets"|"fireplace"|"campfire"|"white"|"pink"|"brown"|"rainstick"|"ocean_drum";
export const natureCatalog=ambienceCatalog as Record<AmbienceSound,{name:string;family:string;kind:string;detail:string}>;
export const isNature=(id:string):id is AmbienceSound=>Object.prototype.hasOwnProperty.call(natureCatalog,id);
