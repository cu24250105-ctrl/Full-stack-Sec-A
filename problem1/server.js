require("dotenv").config();

const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET;

// In-memory storage
const users = [];
const tasks = [];

// Login failed-attempt tracking
const loginAttempts = new Map();

let userIdCounter = 1;
let taskIdCounter = 1;

// --------------------------------------------------
// AUTHENTICATION MIDDLEWARE
// --------------------------------------------------

function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Authentication required" });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: "Invalid or expired token" });
    }
}

// --------------------------------------------------
// REGISTER
// --------------------------------------------------

app.post("/auth/register", async (req, res) => {
    try {
        const { email, password, role = "user" } = req.body;

        if (
            typeof email !== "string" ||
            typeof password !== "string" ||
            !email.trim() ||
            !password
        ) {
            return res.status(400).json({ error: "Invalid input" });
        }

        if (!["user", "admin"].includes(role)) {
            return res.status(400).json({ error: "Invalid role" });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const existingUser = users.find(
            (user) => user.email === normalizedEmail
        );

        if (existingUser) {
            return res.status(409).json({ error: "Email already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = {
            id: userIdCounter++,
            email: normalizedEmail,
            password: hashedPassword,
            role
        };

        users.push(user);

        return res.status(201).json({
            message: "User registered successfully",
            user: {
                id: user.id,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        return res.status(500).json({ error: "Server error" });
    }
});

// --------------------------------------------------
// LOGIN
// --------------------------------------------------

app.post("/auth/login", async (req, res) => {
    const { email, password } = req.body;

    if (
        typeof email !== "string" ||
        typeof password !== "string" ||
        !email.trim() ||
        !password
    ) {
        return res.status(401).json({ error: "Invalid credentials" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const now = Date.now();
    const WINDOW = 60 * 1000;

    // Get previous failed attempts
    let attempts = loginAttempts.get(normalizedEmail) || [];

    // Remove attempts older than one minute
    attempts = attempts.filter((time) => now - time < WINDOW);

    // Rate limit BEFORE checking password
    if (attempts.length >= 5) {
        const oldestAttempt = attempts[0];
        const retryAfterSeconds = Math.max(
            1,
            Math.ceil((WINDOW - (now - oldestAttempt)) / 1000)
        );

        res.set("Retry-After", String(retryAfterSeconds));

        loginAttempts.set(normalizedEmail, attempts);

        return res.status(429).json({
            error: "Too many failed login attempts"
        });
    }

    const user = users.find(
        (u) => u.email === normalizedEmail
    );

    const passwordCorrect = user
        ? await bcrypt.compare(password, user.password)
        : false;

    if (!user || !passwordCorrect) {
        attempts.push(now);
        loginAttempts.set(normalizedEmail, attempts);

        return res.status(401).json({
            error: "Invalid credentials"
        });
    }

    // Successful login clears failed attempts
    loginAttempts.delete(normalizedEmail);

    const token = jwt.sign(
        {
            id: user.id,
            email: user.email,
            role: user.role
        },
        JWT_SECRET,
        {
            expiresIn: "15m"
        }
    );

    return res.status(200).json({ token });
});

// --------------------------------------------------
// CREATE TASK
// --------------------------------------------------

app.post("/tasks", authenticateToken, (req, res) => {
    const { title, status } = req.body;

    const validStatuses = ["todo", "doing", "done"];

    if (
        typeof title !== "string" ||
        !title.trim() ||
        !validStatuses.includes(status)
    ) {
        return res.status(400).json({ error: "Invalid input" });
    }

    const task = {
        id: taskIdCounter++,
        title: title.trim(),
        status,
        userId: req.user.id
    };

    tasks.push(task);

    return res.status(201).json(task);
});

// --------------------------------------------------
// GET TASKS
// --------------------------------------------------

app.get("/tasks", authenticateToken, (req, res) => {
    const { status } = req.query;

    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit) || 10, 1);

    let userTasks = tasks.filter(
        (task) => task.userId === req.user.id
    );

    if (status) {
        if (!["todo", "doing", "done"].includes(status)) {
            return res.status(400).json({ error: "Invalid status" });
        }

        userTasks = userTasks.filter(
            (task) => task.status === status
        );
    }

    const total = userTasks.length;

    const start = (page - 1) * limit;
    const data = userTasks.slice(start, start + limit);

    return res.status(200).json({
        data,
        page,
        total
    });
});

// --------------------------------------------------
// PATCH TASK
// --------------------------------------------------

app.patch("/tasks/:id", authenticateToken, (req, res) => {
    const taskId = Number(req.params.id);

    const task = tasks.find(
        (task) => task.id === taskId
    );

    if (!task) {
        return res.status(404).json({ error: "Task not found" });
    }

    const isOwner = task.userId === req.user.id;
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
        return res.status(403).json({
            error: "You do not have permission"
        });
    }

    const { title, status } = req.body;

    if (
        title === undefined &&
        status === undefined
    ) {
        return res.status(400).json({
            error: "Nothing to update"
        });
    }

    if (
        title !== undefined &&
        (typeof title !== "string" || !title.trim())
    ) {
        return res.status(400).json({
            error: "Invalid title"
        });
    }

    if (
        status !== undefined &&
        !["todo", "doing", "done"].includes(status)
    ) {
        return res.status(400).json({
            error: "Invalid status"
        });
    }

    if (title !== undefined) {
        task.title = title.trim();
    }

    if (status !== undefined) {
        task.status = status;
    }

    return res.status(200).json(task);
});

// --------------------------------------------------
// DELETE TASK
// --------------------------------------------------

app.delete("/tasks/:id", authenticateToken, (req, res) => {
    const taskId = Number(req.params.id);

    const index = tasks.findIndex(
        (task) => task.id === taskId
    );

    if (index === -1) {
        return res.status(404).json({
            error: "Task not found"
        });
    }

    const task = tasks[index];

    const isOwner = task.userId === req.user.id;
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
        return res.status(403).json({
            error: "You do not have permission"
        });
    }

    tasks.splice(index, 1);

    return res.status(204).send();
});

// --------------------------------------------------
// HEALTH CHECK
// --------------------------------------------------

app.get("/", (req, res) => {
    res.json({
        message: "Secure Task Manager API is running"
    });
});

// --------------------------------------------------
// START SERVER
// --------------------------------------------------

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

// Required for automated tests
module.exports = app;