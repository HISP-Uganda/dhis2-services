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
}

type Alma = Service<Settings> & Methods & Vars;

const almaQueue = new Bull<{ data: unknown; scorecard: number }>("alma");
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
	dx,
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
	let page = 1;
	let units;
	do {
		try {
			const {
				data: { organisationUnits },
			} = await dhis2Api.get(`organisationUnits/${ou}.json`, {
				params: { fields: "id", page, includeDescendants: true, pageSize: 1 },
			});

			console.log(organisationUnits);

			// const ous = organisationUnits.map(({ id }: { id: string }) => id).join(";");
			// const { data } = await dhis2Api.get(
			// 	`analytics.json?dimension=dx:${dx}&dimension=pe:${pe}&dimension=ou:${ous}`,
			// );
			// console.log(data);
			// almaQueue.add({ data, scorecard });
			units = organisationUnits;
		} catch (error) {
			console.log(`Organisation - ${ou} failed because ${error.message}`);
		}
		page += 1;
	} while (units);
};

const sendToAlma = async ({ data, scorecard }: { data: unknown; scorecard: number }) => {
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
			const { data: d2 } = await almaApi.put(`scorecard/${scorecard}/upload/dhis`, form, {
				headers: { cookie: headers },
			});
			console.log(d2);
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
		hello: {
			rest: {
				method: "POST",
				path: "/",
			},
			params: {
				pe: "string",
				dx: "string",
				scorecard: "number",
			},
			async handler(this: Alma, ctx: Context<Params>) {
				const job = await dhis2Queue.add(ctx.params, { priority: 1 });
				return job;
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
	methods: {
		uppercase: (str: string) => str.toUpperCase(),
	},

	/**
	 * Service created lifecycle event handler
	 */
	created(this: Service<Settings>) {},

	/**
	 * Service started lifecycle event handler
	 */
	async started(this: Service<Settings>) {},

	/**
	 * Service stopped lifecycle event handler
	 */
	async stopped(this: Service<Settings>) {},
};

export default AlmaService;
