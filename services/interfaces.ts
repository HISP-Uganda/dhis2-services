/* eslint-disable @typescript-eslint/no-empty-interface */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Service } from "moleculer";

export interface Params {
	pe: string;
	dx: string;
	scorecard: number;
	level: number;
	ou: string;
	includeChildren: boolean;
}

export interface DIWParams {}

export interface Settings {}
export interface DIWSettings {}

export interface Methods {}
export interface DIWMethods {}

export interface Vars {}

export type Alma = Service<Settings> & Methods & Vars;

export type DIW = Service<DIWSettings> & DIWMethods;
