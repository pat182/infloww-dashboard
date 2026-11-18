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

app.use(cors({
    origin: "http://localhost:5173",
}));

app.use(express.json());

const PORT = process.env.PORT || 3000;

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

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});