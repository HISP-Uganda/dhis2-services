/* eslint-disable no-await-in-loop */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable no-console */
import type { AxiosInstance } from "axios";
import axios from "axios";
import Bull from "bull";
import { range } from "lodash";
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
	pe,
	scorecard,
	ou,
	level,
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
		params: { fields: "indicators[id]" },
	});

	for (const { id } of indicators) {
		if (["ofZGItap633", "LbXgcyeBgZy", "VACcvy5d4vu", "HF37g2iSiZB"].indexOf(id) === -1) {
			for (const l of range(level, 6)) {
				try {
					const { data } = await dhis2Api.get(
						`analytics.json?dimension=dx:${id}&dimension=pe:${pe}&dimension=ou:${ou};LEVEL-${l}`,
					);
					almaQueue.add({ data, scorecard });
				} catch (error) {
					console.log(
						`Organisation - ${ou} for indicator ${id}  for level ${l} failed because ${error.message}`,
					);
				}
			}
		}
	}
};

const sendToAlma = async ({ data }: { data: unknown; scorecard: number }) => {
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
			const { data: d2 } = await almaApi.put(`scorecard/1407/upload/dhis`, form, {
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
