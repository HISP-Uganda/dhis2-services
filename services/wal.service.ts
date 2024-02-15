/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-empty-interface */
/* eslint-disable no-await-in-loop */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable no-console */
import type { Context, Service, ServiceSchema } from "moleculer";

interface Params {}

interface Settings {}

interface Methods {}

interface Vars {}

type Wal = Service<Settings> & Methods & Vars;

const primaryKeys: Record<string, string> = {
	organisationunit: "organisationid",
	programinstance: "programinstanceid",
	programstageinstance: "programstageinstanceid",
	foo: "a",
	datavalues: "id",
	epivac: "id",
};

const WalService: ServiceSchema<Settings> = {
	name: "alma",

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
		search: {
			rest: {
				method: "POST",
				path: "/search",
			},
			handler(this: Wal, ctx: Context<any>) {
				const { index, ...body } = ctx.params;
				return ctx.call("es.search", {
					index,
					body,
				});
			},
		},
		scroll: {
			rest: {
				method: "POST",
				path: "/scroll",
			},
			handler(this: Wal, ctx: Context<any>) {
				const { index, ...body } = ctx.params;
				return ctx.call("es.scroll", {
					index,
					body,
				});
			},
		},
		receive: {
			rest: {
				method: "POST",
				path: "/receive",
			},
			handler(this: Wal, ctx: Context<any>) {
				return ctx.params;
			},
		},
		aggregate: {
			rest: {
				method: "POST",
				path: "/",
			},
			handler(this: Wal, ctx: Context<any>) {
				const { index, ...body } = ctx.params;
				return ctx.call("es.aggregations", {
					index,
					body,
				});
			},
		},
		bulk: {
			rest: {
				method: "POST",
				path: "/bulk",
			},
			handler(this: Wal, ctx: Context<{ index: string; data: Record<string, any> }>) {
				const { index, data } = ctx.params;
				return ctx.call("es.bulk", {
					index,
					dataset: data,
					id: primaryKeys[index] || "id",
				});
			},
		},
		index: {
			rest: {
				method: "POST",
				path: "/index",
			},
			handler(this: Wal, ctx: Context<any>) {
				const { index, [primaryKeys[index]]: otherId, id, ...body } = ctx.params;
				return ctx.call("es.index", {
					index,
					id,
					body: { ...body, id: id || otherId },
				});
			},
		},
		delete: {
			rest: {
				method: "POST",
				path: "/delete",
			},
			async handler(this: Wal, ctx: Context<any>) {
				return ctx.call("es.delete", ctx.params);
			},
		},
		get: {
			rest: {
				method: "GET",
				path: "/get",
			},
			async handler(this: Wal, ctx: Context<any>) {
				const { index, id } = ctx.params;
				return ctx.call("es.get", { index, id });
			},
		},
		sql: {
			rest: {
				method: "POST",
				path: "/sql",
			},
			async handler(this: Wal, ctx: Context<any>) {
				return ctx.call("es.sql", ctx.params);
			},
		},
		exchange: {
			rest: {
				method: "POST",
				path: "/exchange",
			},
			async handler(this: Wal, ctx: Context<any>) {
				const { source, destination } = ctx.params;
				const dashboards: Record<string, string>[] = await ctx.call("es.scroll", {
					index: "i-dashboards",
					body: {
						query: {
							term: { "systemId.keyword": source },
						},
					},
				});
				const visualizations: Record<string, string>[] = await ctx.call("es.scroll", {
					index: "i-visualization-queries",
					body: {
						query: {
							term: { "systemId.keyword": source },
						},
					},
				});
				const categories: Record<string, string>[] = await ctx.call("es.scroll", {
					index: "i-categories",
					body: {
						query: {
							term: { "systemId.keyword": source },
						},
					},
				});
				const dataSources: Record<string, string>[] = await ctx.call("es.scroll", {
					index: "i-data-sources",
					body: {
						query: {
							term: { "systemId.keyword": source },
						},
					},
				});

				const settings: Record<string, string>[] = await ctx.call("es.scroll", {
					index: "i-dashboard-settings",
					body: {
						query: {
							term: { "systemId.keyword": source },
						},
					},
				});

				if (dashboards.length > 0) {
					await ctx.call("es.bulk", {
						index: "i-dashboards",
						dataset: dashboards.map((dashboard) => ({
							...dashboard,
							systemId: destination,
						})),
						id: "id",
					});
				}
				if (visualizations.length > 0) {
					await ctx.call("es.bulk", {
						index: "i-visualization-queries",
						dataset: visualizations.map((visualization) => ({
							...visualization,
							systemId: destination,
						})),
						id: "id",
					});
				}

				if (categories.length > 0) {
					await ctx.call("es.bulk", {
						index: "i-categories",
						dataset: categories.map((category) => ({
							...category,
							systemId: destination,
						})),
						id: "id",
					});
				}

				if (dataSources.length > 0) {
					await ctx.call("es.bulk", {
						index: "i-data-sources",
						dataset: dataSources.map((dataSource) => ({
							...dataSource,
							systemId: destination,
						})),
						id: "id",
					});
				}
				if (settings.length > 0) {
					await ctx.call("es.bulk", {
						index: "i-dashboard-settings",
						dataset: settings.map((setting) => ({ ...setting, systemId: destination })),
						id: "id",
					});
				}
				return {
					finished: true,
				};
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
	async started(this: Service<Settings>) {},

	/**
	 * Service stopped lifecycle event handler
	 */
	async stopped(this: Service<Settings>) {},
};

export default WalService;
