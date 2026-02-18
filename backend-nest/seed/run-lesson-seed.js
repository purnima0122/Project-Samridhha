/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

function resolveSeedFile(inputPath) {
  if (!inputPath) {
    return path.resolve(__dirname, "lesson.introduction-nepal-share-market.json");
  }

  if (path.isAbsolute(inputPath)) {
    return inputPath;
  }

  return path.resolve(__dirname, "..", inputPath);
}

function readSeed(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

async function run() {
  const arg = process.argv[2];
  const dryRun = arg === "--dry-run" || process.argv.includes("--dry-run");
  const inputPath = arg && arg !== "--dry-run" ? arg : process.argv[3];
  const seedPath = resolveSeedFile(inputPath);

  if (!fs.existsSync(seedPath)) {
    throw new Error(`Seed file not found: ${seedPath}`);
  }

  const lesson = readSeed(seedPath);
  const required = ["title", "module", "content", "order"];
  const missing = required.filter((field) => !lesson[field] && lesson[field] !== 0);
  if (missing.length > 0) {
    throw new Error(`Missing required fields in seed JSON: ${missing.join(", ")}`);
  }

  if (dryRun) {
    console.log("Dry run OK");
    console.log(`File: ${seedPath}`);
    console.log(`Title: ${lesson.title}`);
    console.log(`Module: ${lesson.module}`);
    console.log(`Quiz items: ${Array.isArray(lesson.quiz) ? lesson.quiz.length : 0}`);
    return;
  }

  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error("MONGO_URI is not set in backend-nest/.env");
  }

  const connectOptions = {};
  if (process.env.MONGO_DB_NAME) {
    connectOptions.dbName = process.env.MONGO_DB_NAME;
  }

  await mongoose.connect(uri, connectOptions);
  console.log(`Connected DB: ${mongoose.connection.name}`);

  const collection = mongoose.connection.collection("lessons");
  const now = new Date();

  const result = await collection.updateOne(
    { title: lesson.title, module: lesson.module },
    {
      $set: {
        ...lesson,
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true },
  );

  const action = result.upsertedCount > 0 ? "inserted" : "updated";
  console.log(`Lesson ${action} successfully.`);
  console.log(`Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}, Upserted: ${result.upsertedCount}`);
}

run()
  .catch((error) => {
    console.error("Seed failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
