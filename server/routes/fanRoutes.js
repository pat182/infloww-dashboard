
const express = require("express");
const router = express.Router();

const INFLOWW_BASE_ROUTE = process.env.INFLOWW_BASE_ROUTE;

const API_HEADERS = {
    Authorization: process.env.INFLOWW_API_KEY,
    "x-oid": process.env.INFLOWW_AGENCY_OID,
};

async function fetchInfloww(endpoint, retries = 3) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        const response = await fetch(`${INFLOWW_BASE_ROUTE}${endpoint}`, {
            method: "GET",
            headers: API_HEADERS,
        });

        if (response.status === 429 && attempt < retries) {
            const delay = 2000 * Math.pow(2, attempt);

            console.log(`Rate limited. Retrying in ${delay / 1000}s...`);

            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                `Infloww API error (${response.status}): ${JSON.stringify(data)}`
            );
        }

        return data;
    }

    throw new Error("Infloww API request failed after retries.");
}

function getList(response) {
    return Array.isArray(response?.data?.list)
        ? response.data.list
        : [];
}

async function getConnectedCreators() {
    let creators = [];
    let cursor = null;

    do {
        const params = new URLSearchParams({
            limit: "100",
            platformCode: "OnlyFans",
        });

        if (cursor) {
            params.set("cursor", String(cursor));
        }

        const response = await fetchInfloww(`/all-creators?${params}`);

        creators.push(
            ...getList(response).filter(
                (creator) => creator.status === "connected"
            )
        );

        cursor = response.cursor ?? response.data?.cursor ?? null;
    } while (cursor);

    return creators;
}

async function getFanCounts(creatorIds, startTime, endTime) {
    let records = [];
    let cursor = null;
    let hasMore = true;

    while (hasMore) {
        const params = new URLSearchParams({
            platformCode: "OnlyFans",
            startTime,
            endTime,
        });

        creatorIds.forEach((id) => {
            params.append("creatorIds", String(id));
        });

        if (cursor) {
            params.set("cursor", String(cursor));
        }

        const response = await fetchInfloww(
            `/creator-report/fans/count?${params}`
        );

        records.push(...getList(response));

        cursor = response.cursor ?? null;
        hasMore = response.hasMore === true;
    }

    return records;
}

router.get("/", async (req, res) => {
    try {
        const creators = await getConnectedCreators();

        if (creators.length === 0) {
            return res.json({
                creatorCount: 0,
                creatorsWithFanData: 0,
                date: null,
                activeFans: 0,
                expiredFans: 0,
                creators: [],
            });
        }

        const creatorIds = creators
            .map((creator) => Number(creator.id))
            .filter(Number.isFinite);

        const endDate = new Date();
        const startDate = new Date(endDate);
        startDate.setUTCDate(startDate.getUTCDate() - 30);

        const startTime = startDate.toISOString().slice(0, 10);
        const endTime = endDate.toISOString().slice(0, 10);

        const records = [];

        for (let i = 0; i < creatorIds.length; i += 10) {
            const batch = creatorIds.slice(i, i + 10);

            const batchRecords = await getFanCounts(
                batch,
                startTime,
                endTime
            );

            records.push(...batchRecords);
        }

        // Keep the latest fan-count record for each platformPid.
        const latestByCreator = new Map();

        for (const record of records) {
            const platformPid = String(record.platformPid);
            const existing = latestByCreator.get(platformPid);

            if (!existing || record.date > existing.date) {
                latestByCreator.set(platformPid, record);
            }
        }

        // Match the latest fan counts to connected creators.
        const creatorFanData = creators.map((creator) => {
            const fanRecord = latestByCreator.get(
                String(creator.platformPid)
            );

            return {
                id: creator.id,
                platformPid: creator.platformPid,
                name: creator.name,
                nickName: creator.nickName,
                userName: creator.userName,
                activeFans: Number(fanRecord?.activeFans || 0),
                expiredFans: Number(fanRecord?.expiredFans || 0),
                date: fanRecord?.date || null,
            };
        });

        const activeFans = creatorFanData.reduce(
            (total, creator) => total + creator.activeFans,
            0
        );

        const expiredFans = creatorFanData.reduce(
            (total, creator) => total + creator.expiredFans,
            0
        );

        const latestRecords = Array.from(latestByCreator.values());

        const latestDate = latestRecords.length > 0
            ? latestRecords.reduce(
                (latest, record) =>
                    record.date > latest ? record.date : latest,
                latestRecords[0].date
            )
            : null;

        res.json({
            creatorCount: creators.length,
            creatorsWithFanData: creatorFanData.filter(
                (creator) => creator.date !== null
            ).length,
            date: latestDate,
            activeFans,
            expiredFans,
            creators: creatorFanData,
        });
    } catch (error) {
        console.error("Failed to fetch fan counts:", error);

        res.status(500).json({
            message: "Failed to fetch fan counts.",
            error: error.message,
        });
    }
});

module.exports = router;
