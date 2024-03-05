/* eslint-disable no-nested-ternary */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable no-await-in-loop */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable no-console */
import type { AxiosInstance } from "axios";
import axios from "axios";
import Bull from "bull";
import type { Context, Service, ServiceSchema } from "moleculer";

export interface Params {
	pe: string;
	dx: string;
	scorecard: number;
	level: number;
	ou: string;
}

interface Settings {
	defaultName: string;
	api: AxiosInstance;
}

interface Methods {
	uppercase(str: string): string;
}

interface Vars {
	api: AxiosInstance;
	sseRetry: number;
	sseListeners: Map<any, any>;
	sseIds: WeakMap<any, any>;
}

type Alma = Service<Settings> & Methods & Vars;

const almaQueue = new Bull<{
	data: unknown;
	scorecard: number;
	name: string;
}>("alma");
const dhis2Queue = new Bull<{
	dx: string;
	pe: string;
	scorecard: number;
	level: number;
	ou: string;
}>("dhis2");

const almaApi = axios.create({
	baseURL: String(process.env.BASE_URL),
});

const dhis2Api = axios.create({
	baseURL: process.env.DHIS2_URL,
	auth: {
		username: String(process.env.DHIS2_USERNAME),
		password: String(process.env.DHIS2_PASSWORD),
	},
});

const queryDHIS2 = async ({
	pe,
	scorecard,
	ou,
}: {
	dx: string;
	pe: string;
	scorecard: number;
	level: number;
	ou: string;
}) => {
	const {
		data: { indicators },
	} = await dhis2Api.get<{ indicators: { id: string }[] }>(`indicatorGroups/SWDeaw0RUyR.json`, {
		params: { fields: "indicators[id,name]" },
	});

	const { data: units } = await dhis2Api.get(`organisationUnits/${ou}.json`, {
		params: { fields: "id,name", includeDescendants: true, paging: false },
	});

	const allIndicators = indicators.map(({ id }) => id);

	if (units && units.id) {
		units.organisationUnits = [units];
	}

	try {
		await dhis2Api.put("dataStore/alma/total", { total: units.organisationUnits.length });
		await dhis2Api.put("dataStore/alma/processed", { total: 0 });
		await dhis2Api.put("dataStore/alma/failed", { total: 0 });
		await dhis2Api.put("dataStore/alma/failed-alma", { total: 0 });
		await dhis2Api.put("dataStore/alma/added", { total: 0 });
		await dhis2Api.put("dataStore/alma/response", {});
		await dhis2Api.put("dataStore/alma/message", { message: "Starting" });
		await dhis2Api.put("dataStore/alma/completed", { completed: false });
	} catch (error) {
		await dhis2Api.put("dataStore/alma/total", {
			total: units.organisationUnits.length,
		});
		await dhis2Api.post("dataStore/alma/processed", { total: 0 });
		await dhis2Api.post("dataStore/alma/failed", { total: 0 });
		await dhis2Api.post("dataStore/alma/failed-alma", { total: 0 });
		await dhis2Api.post("dataStore/alma/added", { total: 0 });
		await dhis2Api.post("dataStore/alma/response", {});
		await dhis2Api.post("dataStore/alma/message", { message: "Starting" });
		await dhis2Api.put("dataStore/alma/completed", { completed: false });
	}

	for (const { id, name } of units.organisationUnits.sort((a: any, b: any) =>
		a.level < b.level ? -1 : a.level > b.level ? 1 : 0,
	)) {
		try {
			const { data } = await dhis2Api.get(
				`analytics.json?dimension=dx:${allIndicators.join(
					";",
				)}&dimension=pe:${pe}&dimension=ou:${id}`,
			);
			console.log(data);
			almaQueue.add({ data, scorecard, name });
			const { data: r1 } = await dhis2Api.get<{ total: number }>("dataStore/alma/added");
			await dhis2Api.put("dataStore/alma/added", { total: r1.total + 1 });
		} catch (error) {
			console.log(`Failed to fetch data for organisation ${name} because ${error.message}`);
			const { data: r1 } = await dhis2Api.get<{ total: number }>("dataStore/alma/failed");
			await dhis2Api.put("dataStore/alma/failed", { total: r1.total + 1 });
		}
	}
};

const sendToAlma = async ({
	data,
	scorecard,
	name,
}: {
	data: unknown;
	scorecard: number;
	name: string;
}) => {
	const response = await almaApi.post("session", {
		backend: String(process.env.BACKEND),
		username: String(process.env.USERNAME),
		password: String(process.env.PASSWORD),
	});
	const headers = response.headers["set-cookie"];

	if (headers) {
		try {
			const form = new FormData();
			form.append(
				"file",
				new Blob([JSON.stringify({ dataValues: [data] })], {
					type: "application/json",
				}),
			);
			console.log(`Uploading data for ${name} to alma`);
			const { data: d2 } = await almaApi.put(`scorecard/${scorecard}/upload/dhis`, form, {
				headers: { cookie: headers },
			});

			const { data: r1 } = await dhis2Api.get<{ total: number }>("dataStore/alma/processed");
			await dhis2Api.put("dataStore/alma/processed", { total: r1.total + 1 });
			await dhis2Api.put("dataStore/alma/message", {
				message: `Finished working on ${name}`,
			});
			await dhis2Api.put("dataStore/alma/response", d2);

			const { data: r2 } = await dhis2Api.get<{ total: number }>("dataStore/alma/added");
			const { data: r3 } = await dhis2Api.get<{ total: number }>("dataStore/alma/total");
			const { data: r4 } = await dhis2Api.get<{ total: number }>("dataStore/alma/failed");
			if (r1.total + 2 >= r2.total && r2.total + r4.total === r3.total) {
				await dhis2Api.put("dataStore/alma/completed", { completed: true });
			}
		} catch (error) {
			console.log(`Posting to alma failed because ${error.message}`);
			const { data: r1 } = await dhis2Api.get<{ total: number }>(
				"dataStore/alma/failed-alma",
			);
			await dhis2Api.put("dataStore/alma/failed-alma", { total: r1.total + 1 });
			await dhis2Api.put("dataStore/alma/message", {
				message: error.message,
			});
		}
	}
};

dhis2Queue.process((job) => queryDHIS2(job.data));
almaQueue.process((job) => sendToAlma(job.data));
const AlmaService: ServiceSchema<Settings> = {
	name: "alma",

	/**
	 * Settings
	 */
	settings: {
		defaultName: "Alma",
		api: axios.create({
			baseURL: process.env.BASE_URL,
		}),
	},

	mixins: [],

	/**
	 * Dependencies
	 */
	dependencies: [],

	/**
	 * Actions
	 */
	actions: {
		add: {
			rest: {
				method: "POST",
				path: "/",
			},
			params: {
				pe: "string",
				scorecard: "number",
				ou: "string",
			},
			async handler(this: Alma, ctx: Context<Params>) {
				return dhis2Queue.add(ctx.params, {});
			},
		},
	},

	/**
	 * Events
	 */
	events: {},

	/**
	 * Methods
	 */
	methods: {},

	/**
	 * Service created lifecycle event handler
	 */
	created(this: Service<Settings>) {},

	/**
	 * Service started lifecycle event handler
	 */
	started(this: Service<Settings>) {},

	/**
	 * Service stopped lifecycle event handler
	 */
	stopped(this: Service<Settings>) {},
};

export default AlmaService;
