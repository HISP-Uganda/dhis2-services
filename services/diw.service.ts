/* eslint-disable no-nested-ternary */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable no-await-in-loop */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable no-console */
import type { Authentication } from "data-import-wizard-utils";
import type { Context, Service, ServiceSchema } from "moleculer";
import { processMapping, readMapping } from "./diw.queue.processors";
import type { DIW, DIWSettings, Settings } from "./interfaces";
import { diwMappingQueue, diwProcessQueue } from "./queues";

const DIWService: ServiceSchema<DIWSettings> = {
	name: "diw",

	/**
	 * Settings
	 */
	settings: {},

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
			params: {},
			async handler(
				this: DIW,
				ctx: Context<{
					id: string;
					authentication: Partial<Authentication>;
				}>,
			) {
				return diwMappingQueue.add(ctx.params, {});
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
	started(this: Service<Settings>) {
		diwMappingQueue.process((job) => readMapping(job.data));
		diwProcessQueue.process((job) => processMapping(job.data));
	},

	/**
	 * Service stopped lifecycle event handler
	 */
	stopped(this: Service<Settings>) {},
};

export default DIWService;
