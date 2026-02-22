const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');
const authMiddleware = require('./middleware/authMiddleware');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api', authMiddleware, apiRoutes);

app.get('/', (req, res) => {
    res.send('Shaadi Planner API is running!');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
