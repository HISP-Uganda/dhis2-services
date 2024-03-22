/* eslint-disable no-nested-ternary */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable no-await-in-loop */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable no-console */
import type { Authentication } from "data-import-wizard-utils";
import type { Context, Service, ServiceSchema } from "moleculer";
import {
	createEmptyEvents,
	processMapping,
	readMapping,
	updateEVents,
	updateEventsEventDate,
} from "./diw.queue.processors";
import type { DIW, DIWSettings, Settings } from "./interfaces";
import {
	diwMappingQueue,
	diwProcessQueue,
	eventCreateQueue,
	eventDateUpdateQueue,
	eventUpdateQueue,
} from "./queues";

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
		update: {
			rest: {
				method: "POST",
				path: "/update",
			},
			params: {},
			async handler(
				this: DIW,
				ctx: Context<{
					programStage: string;
					dataElement: string;
					authentication: Partial<Authentication>;
					orgUnit: string;
				}>,
			) {
				await eventUpdateQueue.empty();
				return eventUpdateQueue.add(ctx.params, {});
			},
		},
		create: {
			rest: {
				method: "POST",
				path: "/create",
			},
			params: {},
			async handler(
				this: DIW,
				ctx: Context<{
					programStage: string;
					program: string;
					authentication: Partial<Authentication>;
					orgUnit: string;
				}>,
			) {
				await eventCreateQueue.empty();
				return eventCreateQueue.add(ctx.params, {});
			},
		},
		dates: {
			rest: {
				method: "POST",
				path: "/dates",
			},
			params: {},
			async handler(
				this: DIW,
				ctx: Context<{
					programStage: string;
					authentication: Partial<Authentication>;
					orgUnit: string;
				}>,
			) {
				await eventDateUpdateQueue.empty();
				return eventDateUpdateQueue.add(ctx.params, {});
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
		eventUpdateQueue.process((job) => updateEVents(job.data));
		eventCreateQueue.process((job) => createEmptyEvents(job.data));
		eventDateUpdateQueue.process((job) => updateEventsEventDate(job.data));
	},

	/**
	 * Service stopped lifecycle event handler
	 */
	stopped(this: Service<Settings>) {},
};

export default DIWService;
