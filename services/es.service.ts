/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-empty-interface */
/* eslint-disable no-await-in-loop */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable no-console */
// import { Client } from "@elastic/elasticsearch";
import type {
	DeleteByQueryRequest,
	DeleteRequest,
	GetRequest,
	IndexRequest,
	IndicesCreateRequest,
} from "@elastic/elasticsearch/lib/api/types";
import type { Context, Service, ServiceSchema } from "moleculer";

interface Params {}

interface Settings {}

interface Methods {}

interface Vars {}

type ES = Service<Settings> & Methods & Vars;

// const client = new Client({ node: "http://localhost:9200" });

const ESService: ServiceSchema<Settings> = {
	name: "es",

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
		createIndex: {
			params: {
				index: "string",
				body: "object|optional",
			},
			async handler(this: ES, ctx: Context<IndicesCreateRequest>) {
				// return client.indices.create(ctx.params);
			},
		},
		sql: {
			async handler(this: ES, ctx: Context<Params>) {
				// return client.sql.query(ctx.params);
			},
		},
		deleteByQuery: {
			async handler(this: ES, ctx: Context<DeleteByQueryRequest>) {
				// return client.deleteByQuery(ctx.params);
			},
		},
		delete: {
			async handler(this: ES, ctx: Context<DeleteRequest>) {
				// return client.delete(ctx.params);
			},
		},
		index: {
			async handler(this: ES, ctx: Context<IndexRequest>) {
				// return client.index(ctx.params);
			},
		},
		get: {
			async handler(this: ES, ctx: Context<GetRequest>) {
				// return client.get(ctx.params);
			},
		},

		bulk: {
			async handler(this: ES, ctx: Context<{ index: string; dataSet: any[]; id: string }>) {
				// const { index, dataSet, id } = ctx.params;
				// const body = dataSet.flatMap((doc) => [
				// 	{ index: { _index: index, _id: doc[id] } },
				// 	doc,
				// ]);
				// return client.bulk({
				// 	refresh: true,
				// 	body,
				// });
			},
		},

		searchByValues: {
			async handler(
				this: ES,
				ctx: Context<{ term: string; values: string[]; index: string }>,
			) {
				// const { term, values, index } = ctx.params;
				// const {
				// 	hits: { hits },
				// } = await client.search({
				// 	index,
				// 	body: {
				// 		query: {
				// 			bool: {
				// 				filter: {
				// 					terms: { [`${term}.keyword`]: values },
				// 				},
				// 			},
				// 		},
				// 	},
				// });
				// if (hits.length > 0) {
				// 	return hits[0]._source;
				// }
				// return null;
			},
		},
		searchTrackedEntityInstance: {
			async handler(
				this: ES,
				ctx: Context<{ trackedEntityInstance: string; index: string }>,
			) {
				// const { trackedEntityInstance, index } = ctx.params;
				// const {
				// 	hits: { hits },
				// } = await client.search({
				// 	index,
				// 	body: {
				// 		query: {
				// 			bool: {
				// 				should: [
				// 					{ match: { trackedEntityInstance } },
				// 					{ match: { id: trackedEntityInstance } },
				// 				],
				// 			},
				// 		},
				// 	},
				// });
				// if (hits.length > 0) {
				// 	return hits[0]._source;
				// }
				// return {
				// 	message: "Record not found or could not be validated",
				// };
			},
		},
		search: {
			params: {
				index: "string",
				body: "object",
			},
			async handler(this: ES, ctx: Context<{ index: string; body: Record<string, any> }>) {
				// const { hits } = await client.search({
				// 	index: ctx.params.index,
				// 	body: ctx.params.body,
				// });
				// return hits;
			},
		},
		search2: {
			params: {
				index: "string",
				body: "object",
			},
			async handler(this: ES, ctx: Context<{ index: string; body: Record<string, any> }>) {
				// const { index, body } = ctx.params;
				// const {
				// 	hits: { hits },
				// } = await client.search({
				// 	index,
				// 	body,
				// });
				// return hits.map((h) => h._source);
			},
		},
		scroll: {
			params: {
				index: "string",
				body: "object",
			},
			async handler(this: ES, ctx: Context<Params>) {
				// const scrollSearch = client.helpers.scrollSearch(ctx.params);
				// let documents: any[] = [];
				// for await (const result of scrollSearch) {
				// 	documents = [...documents, ...result.documents];
				// }
				// return documents;
			},
		},
		aggregations: {
			params: {
				index: "string",
				body: "object",
			},
			async handler(this: ES, ctx: Context<{ index: string; body: Record<string, any> }>) {
				// const { aggregations } = await client.search({
				// 	index: ctx.params.index,
				// 	body: ctx.params.body,
				// });
				// return aggregations;
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

export default ESService;
