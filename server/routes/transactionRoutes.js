
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

            console.log(
                `Rate limited. Retrying in ${delay / 1000} seconds...`
            );

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
    if (Array.isArray(response?.data?.list)) {
        return response.data.list;
    }

    if (Array.isArray(response?.data)) {
        return response.data;
    }

    if (Array.isArray(response?.list)) {
        return response.list;
    }

    return [];
}

async function getConnectedCreators() {
    let creators = [];
    let cursor = null;

    do {
        const queryParams = new URLSearchParams({
            limit: "100",
            platformCode: "OnlyFans",
        });

        if (cursor) {
            queryParams.set("cursor", String(cursor));
        }

        const response = await fetchInfloww(
            `/all-creators?${queryParams}`
        );

        const creatorList = getList(response);

        creators.push(
            ...creatorList.filter(
                (creator) => creator.status === "connected"
            )
        );

        cursor = response.cursor ?? response.data?.cursor ?? null;
    } while (cursor);

    return creators;
}

async function getCreatorTransactions(
    creatorId,
    startTime,
    endTime
) {
    let transactions = [];
    let cursor = null;

    do {
        const queryParams = new URLSearchParams({
            limit: "100",
            platformCode: "OnlyFans",
            creatorId: String(creatorId),
            startTime,
            endTime,
        });

        if (cursor) {
            queryParams.set("cursor", String(cursor));
        }

        const response = await fetchInfloww(
            `/transactions?${queryParams}`
        );

        transactions.push(
            ...getList(response).map((transaction) => ({
                ...transaction,
                creatorId,
            }))
        );

        cursor = response.cursor ?? response.data?.cursor ?? null;
    } while (cursor);

    return transactions;
}

router.get("/", async (req, res) => {
    try {
        const endDate = req.query.endTime
            ? new Date(req.query.endTime)
            : new Date();

        const startDate = req.query.startTime
            ? new Date(req.query.startTime)
            : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

        if (
            Number.isNaN(startDate.getTime()) ||
            Number.isNaN(endDate.getTime())
        ) {
            return res.status(400).json({
                message: "Invalid startTime or endTime.",
            });
        }

        if (startDate > endDate) {
            return res.status(400).json({
                message: "startTime cannot be later than endTime.",
            });
        }

        const maxRange = 31 * 24 * 60 * 60 * 1000;

        if (endDate.getTime() - startDate.getTime() > maxRange) {
            return res.status(400).json({
                message: "Date range cannot exceed 31 days.",
            });
        }

        const creators = await getConnectedCreators();

        const results = [];

        // Process 2 creators at a time to reduce API rate limits.
        for (let i = 0; i < creators.length; i += 2) {
            const batch = creators.slice(i, i + 2);

            const batchResults = await Promise.all(
                batch.map(async (creator) => {
                    const creatorId = Number(creator.id);

                    if (!Number.isFinite(creatorId)) {
                        return {
                            creatorId: creator.id,
                            creatorName: creator.name,
                            error: "Creator ID is not a valid number.",
                            transactions: [],
                        };
                    }

                    try {
                        const transactions = await getCreatorTransactions(
                            creatorId,
                            startDate.toISOString(),
                            endDate.toISOString()
                        );

                        return {
                            creatorId,
                            creatorName: creator.name,
                            transactionCount: transactions.length,
                            transactions,
                        };
                    } catch (error) {
                        return {
                            creatorId,
                            creatorName: creator.name,
                            error: error.message,
                            transactions: [],
                        };
                    }
                })
            );

            results.push(...batchResults);

            // Pause between batches.
            if (i + 2 < creators.length) {
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
        }

        const transactions = results.flatMap(
            (result) => result.transactions
        );

        const failedCreators = results
            .filter((result) => result.error)
            .map((result) => ({
                creatorId: result.creatorId,
                creatorName: result.creatorName,
                error: result.error,
            }));

        res.json({
            dateRange: {
                startTime: startDate.toISOString(),
                endTime: endDate.toISOString(),
            },
            creatorCount: creators.length,
            transactionCount: transactions.length,
            failedCreators,
            transactions,
        });
    } catch (error) {
        console.error("Failed to fetch transactions:", error);

        res.status(500).json({
            message: "Failed to fetch transactions.",
            error: error.message,
        });
    }
});

module.exports = router;
