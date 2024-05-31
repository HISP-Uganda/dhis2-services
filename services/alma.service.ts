/* eslint-disable no-nested-ternary */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable no-await-in-loop */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable no-console */
import axios from "axios";
import type { Context, Service, ServiceSchema } from "moleculer";
import { queryDHIS2, sendToAlma } from "./alma.queue.processors";
import type { Alma, Params, Settings } from "./interfaces";
import { almaQueue, dhis2Queue } from "./queues";

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
				includeChildren: "boolean",
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
	created(this: Service<Settings>) {
		dhis2Queue.process((job) => queryDHIS2(job.data));
		almaQueue.process((job) => sendToAlma(job.data));
	},

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
