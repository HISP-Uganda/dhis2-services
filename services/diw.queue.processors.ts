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
	Event,
	IMapping,
	IProgram,
	Mapping,
	StageMapping,
	TrackedEntityInstance,
} from "data-import-wizard-utils";
import {
	fetchTrackedEntityInstances,
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

export const updateEVents = async ({
	programStage,
	authentication,
	dataElement,
	orgUnit,
}: {
	programStage: string;
	dataElement: string;
	authentication: Partial<Authentication>;
	orgUnit: string;
}): Promise<void> => {
	console.log("Making authentication");
	const axios = makeRemoteApi(authentication);

	for (const ou of orgUnit.split(";")) {
		console.log(`Working on ${ou}`);
		try {
			const { data } = await axios.get<{
				events: Partial<Event>[];
				pager: {
					page: number;
					pageCount: number;
					total: number;
					pageSize: number;
				};
			}>("api/events.json", {
				params: {
					programStage,
					totalPages: true,
					orgUnit: ou,
					ouMode: "DESCENDANTS",
					page: 1,
				},
			});

			console.log(`Updating page 1`);

			const r2 = await axios.post(
				`api/events`,
				{
					events: data.events.map((e) => ({
						...e,
						dataValues: e.dataValues?.map((d) => {
							if (d.dataElement === dataElement) {
								return {
									dataElement,
									value: "2023",
									providedElsewhere: false,
								};
							}
							return d;
						}),
					})),
				},
				// { params: { async: true } },
			);
			console.log(r2.data.response.updated);
			if (data.pager.pageCount > 1) {
				for (let page = 2; page <= data.pager.pageCount; page += 1) {
					console.log(`Working on page ${page} of ${data.pager.pageCount}`);
					try {
						const {
							data: { events },
						} = await axios.get<{
							events: Partial<Event>[];
						}>("api/events.json", {
							params: {
								programStage,
								page,
								orgUnit: ou,
								ouMode: "DESCENDANTS",
							},
						});

						const r1 = await axios.post(
							`api/events`,
							{
								events: events.map((e) => ({
									...e,
									dataValues: e.dataValues?.map((d) => {
										if (d.dataElement === dataElement) {
											return {
												dataElement,
												value: "2023",
												providedElsewhere: false,
											};
										}
										return d;
									}),
								})),
							},
							// { params: { async: true } },
						);

						console.log(r1.data.response.updated);
					} catch (error) {
						console.log(error.response.data.response);
					}
				}
			}
		} catch (error) {
			console.log(
				error.response.data.response.importSummaries.flatMap((x: any) => x.conflicts),
			);
		}
	}
};

export const createEmptyEvents = async ({
	programStage,
	authentication,
	orgUnit,
	program,
}: {
	programStage: string;
	authentication: Partial<Authentication>;
	orgUnit: string;
	program: string;
}): Promise<void> => {
	console.log("Making authentication");
	const axios = makeRemoteApi(authentication);

	for (const ou of orgUnit.split(";")) {
		console.log(`Working on ${ou}`);
		try {
			const { data } = await axios.get<{
				trackedEntityInstances: Partial<TrackedEntityInstance>[];
				pager: {
					page: number;
					pageCount: number;
					total: number;
					pageSize: number;
				};
			}>("api/trackedEntityInstances.json", {
				params: {
					totalPages: true,
					ou,
					ouMode: "DESCENDANTS",
					page: 1,
					fields: "trackedEntityInstance",
				},
			});

			console.log(`Updating page 1`);

			const events = data.trackedEntityInstances.map(
				({ trackedEntityInstance, orgUnit: unit }) => ({
					dataValues: [],
					trackedEntityInstance,
					programStage,
					program,
					orgUnit: ou,
					eventDate: "2023-10-01",
				}),
			);

			const r2 = await axios.post(`api/events`, {
				events,
			});
			console.log(r2.data.response.updated);
			if (data.pager.pageCount > 1) {
				for (let page = 2; page <= data.pager.pageCount; page += 1) {
					console.log(`Working on page ${page} of ${data.pager.pageCount}`);
					try {
						const {
							data: { trackedEntityInstances },
						} = await axios.get<{
							trackedEntityInstances: Partial<TrackedEntityInstance>[];
						}>("api/trackedEntityInstances.json", {
							params: {
								programStage,
								page,
								ou,
								ouMode: "DESCENDANTS",
								fields: "trackedEntityInstance",
							},
						});

						const r1 = await axios.post(`api/events`, {
							events: trackedEntityInstances.map(({ trackedEntityInstance }) => ({
								dataValues: [],
								trackedEntityInstance,
								programStage,
								program,
								orgUnit: ou,
								eventDate: "2023-10-01",
							})),
						});

						console.log(r1.data.response.updated);
					} catch (error) {
						console.log(error.response.data.response);
					}
				}
			}
		} catch (error) {
			console.log(
				error.response.data.response.importSummaries.flatMap((x: any) => x.conflicts),
			);
		}
	}
};
