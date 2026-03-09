/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const VALID_MODES = new Set(["upsert", "replace-all", "replace-module"]);

function resolveSeedFile(inputPath) {
  if (!inputPath) {
    return path.resolve(__dirname, "lessons.nepal-finlit-curriculum.json");
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

function normalizeLessons(seed) {
  return Array.isArray(seed) ? seed : [seed];
}

function printUsage() {
  console.log("Usage: node backend-nest/seed/run-lesson-seed.js [options] [seed-file]");
  console.log("");
  console.log("Options:");
  console.log("  --dry-run                 Validate seed only, no DB writes");
  console.log("  --file <path>             Seed JSON path (absolute or relative to backend-nest)");
  console.log("  --mode <mode>             upsert | replace-all | replace-module");
  console.log("  --module <name>           Required with --mode replace-module");
  console.log("  --help                    Show this help");
  console.log("");
  console.log("Examples:");
  console.log("  node backend-nest/seed/run-lesson-seed.js");
  console.log("  node backend-nest/seed/run-lesson-seed.js --dry-run");
  console.log("  node backend-nest/seed/run-lesson-seed.js --file seed/lessons.nepal-finlit-curriculum.json");
  console.log("  node backend-nest/seed/run-lesson-seed.js --mode replace-all");
  console.log('  node backend-nest/seed/run-lesson-seed.js --mode replace-module --module "Money 101"');
}

function parseArgs(argv) {
  const options = {
    dryRun: false,
    file: null,
    mode: "upsert",
    module: null,
    help: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg === "--file") {
      if (!argv[i + 1]) {
        throw new Error("--file requires a path value.");
      }
      options.file = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg === "--mode") {
      if (!argv[i + 1]) {
        throw new Error("--mode requires a value.");
      }
      options.mode = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg === "--module") {
      if (!argv[i + 1]) {
        throw new Error("--module requires a value.");
      }
      options.module = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg.startsWith("--")) {
      throw new Error(`Unknown flag: ${arg}`);
    }

    if (!options.file) {
      options.file = arg;
      continue;
    }

    throw new Error(`Unexpected argument: ${arg}`);
  }

  if (!VALID_MODES.has(options.mode)) {
    throw new Error(`Invalid --mode "${options.mode}". Use one of: ${Array.from(VALID_MODES).join(", ")}`);
  }

  if (options.mode === "replace-module" && !options.module) {
    throw new Error('--module is required when --mode is "replace-module".');
  }

  return options;
}

async function run() {
  const options = parseArgs(process.argv);
  if (options.help) {
    printUsage();
    return;
  }

  const seedPath = resolveSeedFile(options.file);

  if (!fs.existsSync(seedPath)) {
    throw new Error(`Seed file not found: ${seedPath}`);
  }

  const seed = readSeed(seedPath);
  const lessons = normalizeLessons(seed);
  const lessonsToSeed =
    options.mode === "replace-module"
      ? lessons.filter((lesson) => lesson.module === options.module)
      : lessons;

  if (lessons.length === 0) {
    throw new Error("Seed JSON has no lesson objects.");
  }
  if (lessonsToSeed.length === 0) {
    throw new Error("No lessons matched the current seed selection.");
  }

  const required = ["title", "module", "content", "order"];
  const invalid = [];

  lessonsToSeed.forEach((lesson, index) => {
    const missing = required.filter((field) => !lesson[field] && lesson[field] !== 0);
    if (missing.length > 0) {
      invalid.push(`#${index + 1} (${lesson?.title || "untitled"}): ${missing.join(", ")}`);
    }
  });

  if (invalid.length > 0) {
    throw new Error(`Missing required fields in seed JSON:\n${invalid.join("\n")}`);
  }

  if (options.dryRun) {
    console.log("Dry run OK");
    console.log(`File: ${seedPath}`);
    console.log(`Mode: ${options.mode}`);
    if (options.mode === "replace-module") {
      console.log(`Module filter: ${options.module}`);
    }
    console.log(`Lessons selected: ${lessonsToSeed.length} of ${lessons.length}`);
    const totalQuiz = lessonsToSeed.reduce(
      (sum, lesson) => sum + (Array.isArray(lesson.quiz) ? lesson.quiz.length : 0),
      0,
    );
    console.log(`Total quiz items (selected): ${totalQuiz}`);
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

  if (options.mode === "replace-all") {
    const deleted = await collection.deleteMany({});
    console.log(`Deleted existing lessons: ${deleted.deletedCount}`);
  } else if (options.mode === "replace-module") {
    const deleted = await collection.deleteMany({ module: options.module });
    console.log(`Deleted existing lessons in module "${options.module}": ${deleted.deletedCount}`);
  }

  let inserted = 0;
  let updated = 0;
  let matched = 0;

  for (const lesson of lessonsToSeed) {
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

    if (result.upsertedCount > 0) {
      inserted += 1;
    } else if (result.modifiedCount > 0) {
      updated += 1;
    }
    matched += result.matchedCount;
  }

  console.log(`Lesson seed complete.`);
  console.log(`Mode: ${options.mode}`);
  if (options.mode === "replace-module") {
    console.log(`Module filter: ${options.module}`);
  }
  console.log(`Inserted: ${inserted}, Updated: ${updated}, Matched existing: ${matched}`);
}

run()
  .catch((error) => {
    console.error("Seed failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
