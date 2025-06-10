import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import helmet from 'helmet';
import connectDB from './config/db.js';
import userRouter from './routes/user.route.js'; // ✅ Correct import name

dotenv.config();

const app = express();

app.use(cors({
    credentials: true,
    origin: process.env.FRONTEND_URL
}));

app.use(express.json()); // ✅ Needed to parse JSON body
app.use(cookieParser());
app.use(morgan('dev'));
app.use(helmet({
    crossOriginResourcePolicy: false
}));

const PORT = process.env.PORT || 8000;

app.get("/", (req, res) => {
    res.json({ message: "Server is running on port " + PORT });
});

app.use('/api/user', userRouter); // ✅ Routes registered

connectDB().then(() => {
    app.listen(PORT, () => {
        console.log("Server is running on", PORT);
    });
});
