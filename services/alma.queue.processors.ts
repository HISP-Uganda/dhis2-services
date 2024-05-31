/* eslint-disable no-nested-ternary */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable no-await-in-loop */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable no-console */

import axios from "axios";
import fs from "fs";
import FormData from "form-data";
import { almaQueue } from "./queues";

export const almaApi = axios.create({
	baseURL: String(process.env.BASE_URL),
});

export const dhis2Api = axios.create({
	baseURL: process.env.DHIS2_URL,
	auth: {
		username: String(process.env.DHIS2_USERNAME),
		password: String(process.env.DHIS2_PASSWORD),
	},
});
export const sendToAlma = async ({
	data,
	scorecard,
	name,
}: {
	data: unknown;
	scorecard: number;
	name: string;
}): Promise<void> => {
	const response = await almaApi.post("session", {
		backend: String(process.env.BACKEND),
		username: String(process.env.USERNAME),
		password: String(process.env.PASSWORD),
	});
	const headers = response.headers["set-cookie"];

	if (headers) {
		try {
			const form = new FormData();
			const filename = `f${Math.floor(Math.random() * 10000)}.json`;
			fs.writeFileSync(filename, JSON.stringify({ dataValues: [data] }));
			form.append("file", fs.createReadStream(filename), "temp.json");
			console.log(`Uploading data for ${name} to alma`);
			const { data: d2 } = await almaApi.put(`scorecard/${scorecard}/upload/dhis`, form, {
				headers: { cookie: headers.join() },
			});

			await dhis2Api.put("dataStore/alma/message", {
				message: `${name} - Successfully Processed`,
			});
			await dhis2Api.put("dataStore/alma/response", d2);

			fs.unlinkSync(filename);
		} catch (error) {
			console.log(`Posting to alma failed because ${error.message}`);
			const { data: r1 } = await dhis2Api.get<{ total: number }>(
				"dataStore/alma/failed-alma",
			);
			await dhis2Api.put("dataStore/alma/failed-alma", { total: r1.total + 1 });
			await dhis2Api.put("dataStore/alma/message", {
				message: error.message,
			});
		} finally {
			const { data: r1 } = await dhis2Api.get<{ total: number }>("dataStore/alma/processed");
			await dhis2Api.put("dataStore/alma/processed", { total: r1.total + 1 });
			const { data: r2 } = await dhis2Api.get<{ total: number }>("dataStore/alma/added");
			const { data: r3 } = await dhis2Api.get<{ total: number }>("dataStore/alma/total");
			if (r2.total === r3.total) {
				await dhis2Api.put("dataStore/alma/completed", { completed: true });
			}
		}
	}
};
export const queryDHIS2 = async ({
	pe,
	scorecard,
	ou,
	includeChildren,
}: {
	dx: string;
	pe: string;
	scorecard: number;
	level: number;
	ou: string;
	includeChildren: boolean;
}): Promise<void> => {
	console.log("Fetching indicators");
	const {
		data: { indicators },
	} = await dhis2Api.get<{ indicators: { id: string }[] }>(`indicatorGroups/SWDeaw0RUyR.json`, {
		params: { fields: "indicators[id,name]" },
	});
	let units: {
		organisationUnits: { id: string; name: string }[];
	} = { organisationUnits: [] };

	console.log("Fetching organisations");
	if (includeChildren) {
		console.log("Fetching organisations with children");
		const { data } = await dhis2Api.get(`organisationUnits/${ou}.json`, {
			params: { fields: "id,name", includeDescendants: true, paging: false },
		});
		if (data && data.id) {
			units.organisationUnits = [data];
		} else {
			units = data;
		}
	} else {
		const { data } = await dhis2Api.get<{ id: string; name: string }>(
			`organisationUnits/${ou}.json`,
			{
				params: { fields: "id,name" },
			},
		);
		units.organisationUnits = [data];
	}

	const allIndicators = indicators.map(({ id }) => id);

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
			almaQueue.add({ data, scorecard, name });
		} catch (error) {
			console.log(`Failed to fetch data for organisation ${name} because ${error.message}`);
			const { data: r1 } = await dhis2Api.get<{ total: number }>("dataStore/alma/failed");
			await dhis2Api.put("dataStore/alma/failed", { total: r1.total + 1 });
		} finally {
			const { data: r1 } = await dhis2Api.get<{ total: number }>("dataStore/alma/added");
			await dhis2Api.put("dataStore/alma/added", { total: r1.total + 1 });
		}
	}
};
