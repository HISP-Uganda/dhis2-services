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
type Status = {
	total: number;
	processed: number;
	failed: number;
	added: number;
	response: Record<string, any>;
	message: string;
};

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

	const status: Status = {
		total: units.organisationUnits.length,
		processed: 0,
		failed: 0,
		added: 0,
		response: {},
		message: "Starting",
	};

	try {
		await dhis2Api.put("dataStore/alma/status", status);
	} catch (error) {
		await dhis2Api.post("dataStore/alma/status", status);
	}

	for (const { id, name } of units.organisationUnits.sort((a: any, b: any) =>
		a.level < b.level ? -1 : a.level > b.level ? 1 : 0,
	)) {
		let { data: r1 } = await dhis2Api.get<Status>("dataStore/alma/status");
		try {
			const { data } = await dhis2Api.get(
				`analytics.json?dimension=dx:${allIndicators.join(
					";",
				)}&dimension=pe:${pe}&dimension=ou:${id}`,
			);
			r1 = { ...r1, added: r1.added + 1 };
			almaQueue.add({ data, scorecard, name });
			await dhis2Api.put("dataStore/alma/status", r1);
		} catch (error) {
			r1 = {
				...status,
				failed: r1.failed + 1,
			};
			console.log(`Failed to fetch data for organisation ${name} because ${error.message}`);
			await dhis2Api.put("dataStore/alma/status", r1);
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
			const { data: r1 } = await dhis2Api.get<Status>("dataStore/alma/status");
			await dhis2Api.put("dataStore/alma/status", {
				...r1,
				processed: r1.processed + 1,
				response: d2,
				message: `Finished working on ${name}`,
			});
		} catch (error) {
			console.log(`Posting to alma failed because ${error.message}`);
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
