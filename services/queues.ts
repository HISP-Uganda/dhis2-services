/* eslint-disable @typescript-eslint/no-explicit-any */
import Bull from "bull";
import type {
	Authentication,
	IMapping,
	IProgram,
	Mapping,
	StageMapping,
} from "data-import-wizard-utils";

export const almaQueue = new Bull<{
	data: unknown;
	scorecard: number;
	name: string;
}>("alma");

export const dhis2Queue = new Bull<{
	dx: string;
	pe: string;
	scorecard: number;
	level: number;
	ou: string;
}>("dhis2");

export const diwMappingQueue = new Bull<{ id: string; authentication: Partial<Authentication> }>(
	"diw",
);
export const diwProcessQueue = new Bull<{
	attributeMapping: Mapping;
	program: Partial<IProgram>;
	organisationUnitMapping: Mapping;
	programStageMapping: StageMapping;
	optionMapping: Record<string, string>;
	destinationAuth: Partial<Authentication>;
	sourceAuth: Partial<Authentication>;
	mapping: Partial<IMapping>;
}>("diw-processor");

export const eventUpdateQueue = new Bull<{
	programStage: string;
	dataElement: string;
	authentication: Partial<Authentication>;
	orgUnit: string;
	value: string;
}>("event-update-processor");
export const eventCreateQueue = new Bull<{
	programStage: string;
	program: string;
	authentication: Partial<Authentication>;
	orgUnit: string;
}>("event-create-processor");

export const eventDateUpdateQueue = new Bull<{
	programStage: string;
	authentication: Partial<Authentication>;
	orgUnit: string;
	eventDate: string;
}>("event-date-update-processor");
