/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */
/* eslint-disable no-await-in-loop */
/* eslint-disable import/no-extraneous-dependencies */
// eslint-disable-next-line import/no-extraneous-dependencies
import type {
	Authentication,
	IMapping,
	IProgram,
	Mapping,
	StageMapping,
} from "data-import-wizard-utils";
import {
	fetchTrackedEntityInstances,
	flattenTrackedEntityInstances,
	getPreviousProgramMapping,
	insertTrackerData,
	loadPreviousMapping,
	makeRemoteApi,
	processInstances,
	programStageUniqElements,
	programUniqAttributes,
} from "data-import-wizard-utils";
import { diwProcessQueue } from "./queues";

export const another = (): number => {
	const x = 5;
	const y = 12;
	return x * y;
};

export const readMapping = async ({
	id,
	authentication,
}: {
	id: string;
	authentication: Partial<Authentication>;
}): Promise<void> => {
	const destinationAuth: Partial<Authentication> | undefined = authentication;
	let sourceAuth: Partial<Authentication> | undefined = authentication;
	const previousMappings = await loadPreviousMapping(
		{ axios: makeRemoteApi(authentication) },
		["iw-mapping"],
		id,
	);
	const mapping: Partial<IMapping> = previousMappings["iw-mapping"] ?? {};

	const {
		attributeMapping,
		program,
		organisationUnitMapping,
		programStageMapping,
		optionMapping,
	} = await getPreviousProgramMapping(
		{ axios: makeRemoteApi(authentication) },
		mapping,
		(message: string) => console.log(message),
	);

	if (!mapping.isCurrentInstance) {
		sourceAuth = mapping.authentication;
	}

	if (sourceAuth && destinationAuth) {
		await diwProcessQueue.add({
			attributeMapping,
			program,
			organisationUnitMapping,
			programStageMapping,
			optionMapping,
			mapping,
			destinationAuth,
			sourceAuth,
		});
	}
};

const updateResponse = (
	response: {
		conflicts: any[];
		imported: number;
		updated: number;
		deleted: number;
		total: number;
		ignored: number;
	},
	conflictsUpdate: (conflicts: any[]) => void,
	feedBackUpdate: (feedback: {
		total: number;
		updated: number;
		deleted: number;
		ignored: number;
		imported: number;
	}) => void,
) => {
	if (response.conflicts && response.conflicts.flat().length > 0) {
		conflictsUpdate(response.conflicts.flat());
	}
	feedBackUpdate({
		deleted: response.deleted,
		total: response.total,
		ignored: response.ignored,
		updated: response.updated,
		imported: response.imported,
	});
};
export const processMapping = async ({
	attributeMapping,
	program,
	organisationUnitMapping,
	programStageMapping,
	optionMapping,
	mapping,
	destinationAuth,
	sourceAuth,
}: {
	attributeMapping: Mapping;
	program: Partial<IProgram>;
	organisationUnitMapping: Mapping;
	programStageMapping: StageMapping;
	optionMapping: Record<string, string>;
	destinationAuth: Partial<Authentication>;
	sourceAuth: Partial<Authentication>;
	mapping: Partial<IMapping>;
}): Promise<void> => {
	let instancesConflicts: any[] = [];
	let enrollmentsConflicts: any[] = [];
	let eventsConflicts: any[] = [];
	let enrollmentsFeedback: {
		total: number;
		updated: number;
		deleted: number;
		ignored: number;
		imported: number;
	} = {
		total: 0,
		updated: 0,
		deleted: 0,
		ignored: 0,
		imported: 0,
	};
	let eventsFeedback: {
		total: number;
		updated: number;
		deleted: number;
		ignored: number;
		imported: number;
	} = {
		total: 0,
		updated: 0,
		deleted: 0,
		ignored: 0,
		imported: 0,
	};
	let instancesFeedback: {
		total: number;
		updated: number;
		deleted: number;
		ignored: number;
		imported: number;
	} = {
		total: 0,
		updated: 0,
		deleted: 0,
		ignored: 0,
		imported: 0,
	};

	if (mapping.dataSource === "dhis2-program" && mapping.isCurrentInstance) {
		const programStageUniqueElements = programStageUniqElements(programStageMapping);
		const uniqAttributes = programUniqAttributes(attributeMapping);

		const destinationApi = makeRemoteApi(destinationAuth);
		const sourceApi = makeRemoteApi(sourceAuth);

		await fetchTrackedEntityInstances(
			{
				api: { axios: sourceApi },
				program: mapping.program?.remoteProgram,
				withAttributes: false,
				uniqueAttributeValues: [],
				additionalParams: {},
				trackedEntityInstances: [],
			},
			async (trackedEntityInstances, { pager }) => {
				console.log(`Finished fetching data for page ${pager?.page} from source`);
				processInstances(
					{
						api: { axios: destinationApi },
						trackedEntityInstances,
						programMapping: mapping,
						version: 10,
						attributeMapping,
						program,
						programStageMapping,
						optionMapping,
						organisationUnitMapping,
						programStageUniqueElements,
						programUniqAttributes: uniqAttributes,
						setMessage: (message: string) => console.log(message),
					},
					async (data) => {
						await insertTrackerData({
							processedData: data,
							callBack: (message: string) => console.log(message),
							api: { axios: destinationApi },
							instanceCallBack: (response) =>
								updateResponse(
									response,
									(r) => {
										instancesConflicts = instancesConflicts.concat(r);
									},
									(r) => {
										instancesFeedback = {
											total: r.total + instancesFeedback.total,
											updated: r.updated + instancesFeedback.updated,
											deleted: r.deleted + instancesFeedback.deleted,
											ignored: r.ignored + instancesFeedback.ignored,
											imported: r.imported + instancesFeedback.imported,
										};
										console.log(instancesFeedback);
									},
								),
							enrollmentsCallBack: (response) =>
								updateResponse(
									response,
									(r) => {
										enrollmentsConflicts = enrollmentsConflicts.concat(r);
									},
									(r) => {
										enrollmentsFeedback = {
											total: r.total + enrollmentsFeedback.total,
											updated: r.updated + enrollmentsFeedback.updated,
											deleted: r.deleted + enrollmentsFeedback.deleted,
											ignored: r.ignored + enrollmentsFeedback.ignored,
											imported: r.imported + enrollmentsFeedback.imported,
										};
										console.log(enrollmentsFeedback);
									},
								),
							eventsCallBack: (response) => {
								updateResponse(
									response,
									(r) => {
										eventsConflicts = eventsConflicts.concat(r);
									},
									(r) => {
										eventsFeedback = {
											total: r.total + eventsFeedback.total,
											updated: r.updated + eventsFeedback.updated,
											deleted: r.deleted + eventsFeedback.deleted,
											ignored: r.ignored + eventsFeedback.ignored,
											imported: r.imported + eventsFeedback.imported,
										};
										console.log(eventsFeedback);
									},
								);
							},
						});
					},
				);
			},
		);
	}
};
