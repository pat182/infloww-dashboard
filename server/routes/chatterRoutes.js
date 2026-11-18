
const express = require("express");
const router = express.Router();

const INFLOWW_BASE_ROUTE = process.env.INFLOWW_BASE_ROUTE;

const API_HEADERS = {
    Authorization: process.env.INFLOWW_API_KEY,
    "x-oid": process.env.INFLOWW_AGENCY_OID,
};

const EMPLOYEE_CACHE_TTL = 5 * 60 * 1000;
const CHATTER_CACHE_TTL = 60 * 1000;

const employeeCache = {
    data: null,
    expiresAt: 0,
    pending: null,
};

const chatterCache = new Map();
const chatterPending = new Map();

const delay = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms));

async function fetchInfloww(endpoint, retries = 3) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        const response = await fetch(
            `${INFLOWW_BASE_ROUTE}${endpoint}`,
            {
                method: "GET",
                headers: API_HEADERS,
            }
        );

        if (response.ok) {
            return response.json();
        }

        if (response.status === 429 && attempt < retries) {
            await delay(2000 * Math.pow(2, attempt));
            continue;
        }

        const errorText = await response.text();

        throw new Error(
            `Infloww API error ${response.status}: ${errorText}`
        );
    }

    throw new Error("Infloww API request failed after retries.");
}

function getLastNDays(days = 30) {
    const end = new Date();
    end.setDate(end.getDate() - 1);

    const start = new Date(end);
    start.setDate(start.getDate() - (days - 1));

    const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");

        return `${year}-${month}-${day}`;
    };

    return {
        startTime: formatDate(start),
        endTime: formatDate(end),
    };
}

function chunkArray(array, size) {
    const chunks = [];

    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }

    return chunks;
}

function toNumber(value) {
    const number = Number(value);

    return Number.isFinite(number) ? number : 0;
}

// Fetch and cache the employee roster.
async function getAllEmployees() {
    if (
        employeeCache.data &&
        Date.now() < employeeCache.expiresAt
    ) {
        return employeeCache.data;
    }

    // Reuse an existing request if one is already running.
    if (employeeCache.pending) {
        return employeeCache.pending;
    }

    employeeCache.pending = (async () => {
        try {
            const employees = [];
            let cursor = null;
            let hasMore = true;

            while (hasMore) {
                const params = new URLSearchParams();

                if (cursor) {
                    params.set("cursor", cursor);
                }

                const query = params.toString();

                const response = await fetchInfloww(
                    `/employees${query ? `?${query}` : ""}`
                );

                employees.push(...(response.data?.list || []));

                hasMore = response.hasMore === true;
                cursor = response.cursor;

                if (hasMore && !cursor) {
                    throw new Error(
                        "Employee pagination indicated more records but returned no cursor."
                    );
                }
            }

            employeeCache.data = employees;
            employeeCache.expiresAt =
                Date.now() + EMPLOYEE_CACHE_TTL;

            return employees;
        } finally {
            employeeCache.pending = null;
        }
    })();

    return employeeCache.pending;
}

async function getPaginatedEmployeeSummary(
    endpoint,
    employeeIds,
    startTime,
    endTime
) {
    const records = [];
    let cursor = null;
    let hasMore = true;

    while (hasMore) {
        const params = new URLSearchParams();

        employeeIds.forEach((id) => {
            params.append("employeeIds", String(id));
        });

        params.set("platformCode", "OnlyFans");
        params.set("startTime", startTime);
        params.set("endTime", endTime);

        if (cursor) {
            params.set("cursor", cursor);
        }

        const response = await fetchInfloww(
            `${endpoint}?${params.toString()}`
        );

        records.push(...(response.data?.list || []));

        hasMore = response.hasMore === true;
        cursor = response.cursor;

        if (hasMore && !cursor) {
            throw new Error(
                `Pagination indicated more records but returned no cursor for ${endpoint}.`
            );
        }

        if (hasMore) {
            await delay(500);
        }
    }

    return records;
}

function createEmployeeStats(employee) {
    return {
        employeeId: String(employee.employeeId),
        employeeName: employee.employeeName,
        status: employee.status,

        chat: {
            messagesSent: 0,
            ppvsSent: 0,
            ppvsUnlocked: 0,
            fansChatted: 0,
            characterCount: 0,
            goldenRatio: 0,
            unlockRate: 0,
        },

        sales: {
            salesAmount: 0,
            ppvSalesAmount: 0,
            tipsSalesAmount: 0,
            directMessageSalesAmount: 0,
            priorityMassMessageSalesAmount: 0,
            massMessageSalesAmount: 0,
            currency: null,
        },
    };
}

function aggregateEmployeeStats(
    employees,
    chatRecords,
    salesRecords
) {
    const employeeMap = new Map();

    employees.forEach((employee) => {
        employeeMap.set(
            String(employee.employeeId),
            createEmployeeStats(employee)
        );
    });

    // Aggregate chat statistics.
    chatRecords.forEach((record) => {
        const employeeId = String(record.employeeId);

        if (!employeeMap.has(employeeId)) {
            employeeMap.set(employeeId, {
                employeeId,
                employeeName: "Unknown Employee",
                status: "Unknown",
                chat: {
                    messagesSent: 0,
                    ppvsSent: 0,
                    ppvsUnlocked: 0,
                    fansChatted: 0,
                    characterCount: 0,
                    goldenRatio: 0,
                    unlockRate: 0,
                },
                sales: {
                    salesAmount: 0,
                    ppvSalesAmount: 0,
                    tipsSalesAmount: 0,
                    directMessageSalesAmount: 0,
                    priorityMassMessageSalesAmount: 0,
                    massMessageSalesAmount: 0,
                    currency: null,
                },
            });
        }

        const employee = employeeMap.get(employeeId);

        employee.chat.messagesSent += toNumber(
            record.directMessagesSent
        );

        employee.chat.ppvsSent += toNumber(
            record.directPpvsSent
        );

        employee.chat.ppvsUnlocked += toNumber(
            record.ppvsUnlocked
        );

        employee.chat.fansChatted += toNumber(
            record.fansChatted
        );

        employee.chat.characterCount += toNumber(
            record.characterCount
        );
    });

    // Aggregate sales statistics.
    salesRecords.forEach((record) => {
        const employeeId = String(record.employeeId);

        if (!employeeMap.has(employeeId)) {
            employeeMap.set(employeeId, {
                employeeId,
                employeeName: "Unknown Employee",
                status: "Unknown",
                chat: {
                    messagesSent: 0,
                    ppvsSent: 0,
                    ppvsUnlocked: 0,
                    fansChatted: 0,
                    characterCount: 0,
                    goldenRatio: 0,
                    unlockRate: 0,
                },
                sales: {
                    salesAmount: 0,
                    ppvSalesAmount: 0,
                    tipsSalesAmount: 0,
                    directMessageSalesAmount: 0,
                    priorityMassMessageSalesAmount: 0,
                    massMessageSalesAmount: 0,
                    currency: null,
                },
            });
        }

        const employee = employeeMap.get(employeeId);

        employee.sales.salesAmount += toNumber(
            record.salesAmount
        );

        employee.sales.ppvSalesAmount += toNumber(
            record.ppvSalesAmount
        );

        employee.sales.tipsSalesAmount += toNumber(
            record.tipsSalesAmount
        );

        employee.sales.directMessageSalesAmount += toNumber(
            record.directMessageSalesAmount
        );

        employee.sales.priorityMassMessageSalesAmount += toNumber(
            record.priorityMassMessageSalesAmount
        );

        employee.sales.massMessageSalesAmount += toNumber(
            record.massMessageSalesAmount
        );

        if (record.currency) {
            employee.sales.currency = record.currency;
        }
    });

    const aggregatedEmployees = Array.from(employeeMap.values());

    // Calculate weighted ratios after aggregation.
    aggregatedEmployees.forEach((employee) => {
        const {
            messagesSent,
            ppvsSent,
            ppvsUnlocked,
        } = employee.chat;

        employee.chat.goldenRatio =
            messagesSent > 0
                ? Number(
                    ((ppvsSent / messagesSent) * 100).toFixed(2)
                )
                : 0;

        employee.chat.unlockRate =
            ppvsSent > 0
                ? Number(
                    ((ppvsUnlocked / ppvsSent) * 100).toFixed(2)
                )
                : 0;
    });

    aggregatedEmployees.sort(
        (a, b) => b.sales.salesAmount - a.sales.salesAmount
    );

    return aggregatedEmployees;
}

// Build the complete chatter response.
async function buildChatterResponse(days) {
    const { startTime, endTime } = getLastNDays(days);

    const employees = await getAllEmployees();

    const employeeBatches = chunkArray(
        employees.map((employee) => employee.employeeId),
        10
    );

    const chatRecords = [];
    const salesRecords = [];

    // Fetch each batch's chat and sales data concurrently.
    for (const batch of employeeBatches) {
        const [batchChatRecords, batchSalesRecords] =
            await Promise.all([
                getPaginatedEmployeeSummary(
                    "/employee-report/employee-chat-summary",
                    batch,
                    startTime,
                    endTime
                ),
                getPaginatedEmployeeSummary(
                    "/employee-report/employee-sales-summary",
                    batch,
                    startTime,
                    endTime
                ),
            ]);

        chatRecords.push(...batchChatRecords);
        salesRecords.push(...batchSalesRecords);
    }

    const aggregatedEmployees = aggregateEmployeeStats(
        employees,
        chatRecords,
        salesRecords
    );

    const activeEmployeeCount = employees.filter(
        (employee) => employee.status === "Activated"
    ).length;

    return {
        dateRange: {
            startTime,
            endTime,
        },

        employeeCount: employees.length,
        activeEmployeeCount,

        chatRecordCount: chatRecords.length,
        salesRecordCount: salesRecords.length,

        totalChatSales: salesRecords.reduce(
            (total, record) =>
                total + toNumber(record.salesAmount),
            0
        ),

        totalMessagesSent: chatRecords.reduce(
            (total, record) =>
                total + toNumber(record.directMessagesSent),
            0
        ),

        totalPpvsSent: chatRecords.reduce(
            (total, record) =>
                total + toNumber(record.directPpvsSent),
            0
        ),

        totalPpvsUnlocked: chatRecords.reduce(
            (total, record) =>
                total + toNumber(record.ppvsUnlocked),
            0
        ),

        employees: aggregatedEmployees,

        chatRecords,
        salesRecords,
    };
}

router.get("/", async (req, res) => {
    try {
        const days = Number(req.query.days ?? 30);

        if (![10, 20, 30].includes(days)) {
            return res.status(400).json({
                message: "Invalid reporting period. Use 10, 20, or 30 days.",
            });
        }

        // Return cached response if it is still valid.
        const cached = chatterCache.get(days);

        if (cached && Date.now() < cached.expiresAt) {
            return res.json(cached.data);
        }

        // Reuse an in-progress request for this reporting period.
        if (chatterPending.has(days)) {
            const data = await chatterPending.get(days);
            return res.json(data);
        }

        const pendingRequest = buildChatterResponse(days);

        chatterPending.set(days, pendingRequest);

        try {
            const data = await pendingRequest;

            chatterCache.set(days, {
                data,
                expiresAt: Date.now() + CHATTER_CACHE_TTL,
            });

            return res.json(data);
        } finally {
            chatterPending.delete(days);
        }
    } catch (error) {
        console.error("Chatter API error:", error);

        return res.status(500).json({
            message: "Failed to fetch chatter statistics",
            error: error.message,
        });
    }
});

module.exports = router;
