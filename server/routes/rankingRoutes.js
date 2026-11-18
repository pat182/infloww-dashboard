
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

async function getCreatorRankings(creatorIds, startTime, endTime) {
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
            `/creator-report/rank?${params}`
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
                creatorsWithRankingData: 0,
                date: null,
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

        // The endpoint allows a maximum of 10 creators per request.
        for (let i = 0; i < creatorIds.length; i += 10) {
            const batch = creatorIds.slice(i, i + 10);

            const batchRecords = await getCreatorRankings(
                batch,
                startTime,
                endTime
            );

            records.push(...batchRecords);
        }

        // Keep the latest ranking record for each creator.
        const latestByCreator = new Map();

        for (const record of records) {
            const platformPid = String(record.platformPid);
            const existing = latestByCreator.get(platformPid);

            if (!existing || record.date > existing.date) {
                latestByCreator.set(platformPid, record);
            }
        }

        const creatorRankings = creators.map((creator) => {
            const ranking = latestByCreator.get(
                String(creator.platformPid)
            );

            return {
                id: creator.id,
                platformPid: creator.platformPid,
                name: creator.name,
                performanceRank: ranking?.performanceRank || null,
                date: ranking?.date || null,
            };
        });

        const latestDate = records.length > 0
            ? records.reduce(
                (latest, record) =>
                    record.date > latest ? record.date : latest,
                records[0].date
            )
            : null;

        res.json({
            creatorCount: creators.length,
            creatorsWithRankingData: creatorRankings.filter(
                (creator) => creator.date !== null
            ).length,
            date: latestDate,
            creators: creatorRankings,
        });
    } catch (error) {
        console.error("Failed to fetch creator rankings:", error);

        res.status(500).json({
            message: "Failed to fetch creator rankings.",
            error: error.message,
        });
    }
});

module.exports = router;
