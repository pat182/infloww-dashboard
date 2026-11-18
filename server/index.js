
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

// const creatorRoutes = require("./routes/creatorRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const fanRoutes = require("./routes/fanRoutes");
const rankingRoutes = require("./routes/rankingRoutes");
const chatterRoutes = require("./routes/chatterRoutes");

const app = express();

const allowedOrigins = [
    "http://localhost:5173",
    "https://infloww-dashboard-h531.vercel.app",
].filter(Boolean);

app.use(cors({
    origin: allowedOrigins,
}));

app.use(express.json());

app.get("/", (req, res) => {
    res.json({
        message: "Infloww API server is running",
    });
});

// app.use("/api/creators", creatorRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/fans", fanRoutes);
app.use("/api/rankings", rankingRoutes);
app.use("/api/chatters", chatterRoutes);

module.exports = app;
