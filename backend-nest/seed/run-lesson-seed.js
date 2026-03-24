/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const VALID_MODES = new Set(["upsert", "replace-all", "replace-module"]);
const DEFAULT_LESSON_ICON = "BookOpen";
const DEFAULT_LESSON_COLOR = "#3B82F6";
const DEFAULT_MODULE_COLOR = "#3B82F6";

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

function toText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toInt(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function toBool(value, fallback = true) {
  return typeof value === "boolean" ? value : fallback;
}

function slugify(value) {
  return toText(value)
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function darkenHex(hex) {
  const color = toText(hex);
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
    return "#1D4ED8";
  }

  const shift = (segment) =>
    Math.max(0, parseInt(segment, 16) - 40)
      .toString(16)
      .padStart(2, "0");

  return `#${shift(color.slice(1, 3))}${shift(color.slice(3, 5))}${shift(color.slice(5, 7))}`;
}

function normalizeFlashcards(rawCards) {
  const cards = Array.isArray(rawCards) ? rawCards : [];

  return cards
    .map((card) => {
      if (!card || typeof card !== "object") {
        return null;
      }

      const prompt = toText(card.prompt ?? card.front ?? card.question);
      const answer = toText(card.answer ?? card.back ?? card.reveal);
      const tag = toText(card.tag ?? card.title ?? card.label);

      if (!prompt || !answer) {
        return null;
      }

      return {
        prompt,
        answer,
        ...(tag ? { tag } : {}),
      };
    })
    .filter(Boolean);
}

function normalizeQuiz(rawQuiz) {
  const quiz = Array.isArray(rawQuiz) ? rawQuiz : [];

  return quiz
    .map((question) => {
      if (!question || typeof question !== "object") {
        return null;
      }

      const prompt = toText(question.prompt ?? question.question);
      const options = Array.isArray(question.options ?? question.choices)
        ? (question.options ?? question.choices)
            .map((item) => toText(item))
            .filter(Boolean)
        : [];
      const correctOptionIndex = Number(
        question.correctOptionIndex ?? question.correctIndex ?? question.answerIndex,
      );
      const explanation = toText(question.explanation ?? question.why);

      if (!prompt || options.length < 2 || !Number.isInteger(correctOptionIndex)) {
        return null;
      }

      return {
        prompt,
        options,
        correctOptionIndex,
        ...(explanation ? { explanation } : {}),
      };
    })
    .filter(Boolean);
}

function normalizeFacts(rawFacts) {
  const facts = Array.isArray(rawFacts) ? rawFacts : [];

  return facts
    .map((fact) => {
      if (!fact || typeof fact !== "object") {
        return null;
      }

      const icon = toText(fact.icon) || "✨";
      const title = toText(fact.title);
      const body = toText(fact.body ?? fact.answer ?? fact.back);

      if (!title || !body) {
        return null;
      }

      return { icon, title, body };
    })
    .filter(Boolean);
}

function buildLessonContent({ topicTitle, chapterTitle, lessonTitle, summary, flashcards, facts, quiz }) {
  const lines = [];

  if (topicTitle) {
    lines.push(`Topic: ${topicTitle}`);
  }
  if (chapterTitle) {
    lines.push(`Chapter: ${chapterTitle}`);
  }

  lines.push(`Lesson: ${lessonTitle}`);

  if (summary) {
    lines.push(`Overview: ${summary}`);
  }

  flashcards.forEach((card, index) => {
    lines.push(`Concept Card ${index + 1}: ${card.prompt}`);
    lines.push(`Flip Answer ${index + 1}: ${card.answer}`);
  });

  facts.forEach((fact, index) => {
    lines.push(`Reference Fact ${index + 1}: ${fact.title} - ${fact.body}`);
  });

  if (quiz.length > 0) {
    lines.push(`Quiz: ${quiz.length} questions`);
  }

  return lines.join("\n").trim();
}

function buildModuleTagline(chapterTagline, topicShortInfo, lessonSummary, chapterTitle) {
  return (
    toText(chapterTagline) ||
    toText(topicShortInfo) ||
    toText(lessonSummary) ||
    `Lessons for ${chapterTitle}`
  );
}

function normalizeLegacyLesson(rawLesson, index) {
  const title = toText(rawLesson.title);
  const topic = toText(rawLesson.topic);
  const topicSlug = toText(rawLesson.topicSlug) || (topic ? slugify(topic) : "");
  const module = toText(rawLesson.module) || "General";
  const moduleSlug = toText(rawLesson.moduleSlug) || slugify(module);
  const summary = toText(rawLesson.summary ?? rawLesson.shortInfo);
  const flashcards = normalizeFlashcards(rawLesson.flashcards);
  const quiz = normalizeQuiz(rawLesson.quiz);
  const facts = normalizeFacts(rawLesson.facts);
  const content =
    toText(rawLesson.content) ||
    buildLessonContent({
      topicTitle: topic,
      chapterTitle: module,
      lessonTitle: title,
      summary,
      flashcards,
      facts,
      quiz,
    });

  return {
    slug: toText(rawLesson.slug) || slugify(title),
    title,
    topic: topic || undefined,
    topicSlug: topicSlug || undefined,
    module,
    moduleSlug: moduleSlug || undefined,
    summary,
    content,
    type: rawLesson.type === "vault" ? "vault" : "lesson",
    videoUrl: toText(rawLesson.videoUrl),
    color: toText(rawLesson.color) || DEFAULT_LESSON_COLOR,
    icon: toText(rawLesson.icon) || DEFAULT_LESSON_ICON,
    emoji: toText(rawLesson.emoji) || undefined,
    order: toInt(rawLesson.order, index + 1),
    duration: toInt(rawLesson.duration, 5),
    xp: toInt(rawLesson.xp, rawLesson.type === "vault" ? 20 : 50),
    isPublished: toBool(rawLesson.isPublished, true),
    flashcards,
    quiz,
    facts,
  };
}

function inferModulesFromLessons(lessons) {
  const grouped = new Map();

  for (const lesson of lessons) {
    const key = lesson.moduleSlug || slugify(lesson.module);
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(lesson);
  }

  return Array.from(grouped.values())
    .map((items) => {
      const first = items[0];
      const order = Math.min(...items.map((item) => item.order));
      return {
        slug: first.moduleSlug || slugify(first.module),
        title: first.module,
        topic: first.topic,
        topicSlug: first.topicSlug,
        emoji: undefined,
        color: first.color || DEFAULT_MODULE_COLOR,
        darkColor: darkenHex(first.color || DEFAULT_MODULE_COLOR),
        tagline: buildModuleTagline("", "", first.summary, first.module),
        order,
        isPublished: items.some((item) => item.isPublished !== false),
      };
    })
    .sort((left, right) => left.order - right.order);
}

function normalizeTopic(seed) {
  if (typeof seed?.topic === "string") {
    const title = toText(seed.topic);
    return {
      title,
      slug: slugify(title),
      shortInfo: "",
      color: "",
      emoji: "",
    };
  }

  const source = seed?.topic && typeof seed.topic === "object" ? seed.topic : seed;
  const title = toText(source?.title ?? source?.name);

  return {
    title,
    slug: toText(source?.slug) || (title ? slugify(title) : ""),
    shortInfo: toText(source?.shortInfo ?? source?.summary ?? source?.tagline),
    color: toText(source?.color),
    emoji: toText(source?.emoji),
  };
}

function transformCurriculumSeed(seed) {
  const topic = normalizeTopic(seed);
  const chapters = Array.isArray(seed.chapters) ? seed.chapters : [];
  const modules = [];
  const lessons = [];

  chapters.forEach((chapter, chapterIndex) => {
    const chapterTitle = toText(chapter.title ?? chapter.name);
    const chapterSlug = toText(chapter.slug) || slugify(chapterTitle);
    const chapterColor = toText(chapter.color) || topic.color || DEFAULT_MODULE_COLOR;
    const chapterDarkColor = toText(chapter.darkColor) || darkenHex(chapterColor);
    const chapterLessons = Array.isArray(chapter.lessons) ? chapter.lessons : [];

    modules.push({
      slug: chapterSlug,
      title: chapterTitle,
      topic: topic.title || undefined,
      topicSlug: topic.slug || undefined,
      emoji: toText(chapter.emoji) || undefined,
      color: chapterColor,
      darkColor: chapterDarkColor,
      tagline: buildModuleTagline(
        chapter.shortInfo ?? chapter.summary ?? chapter.tagline,
        topic.shortInfo,
        toText(chapterLessons[0]?.summary ?? chapterLessons[0]?.shortInfo),
        chapterTitle,
      ),
      order: toInt(chapter.order, chapterIndex + 1),
      isPublished: toBool(chapter.isPublished, true),
    });

    chapterLessons.forEach((lesson, lessonIndex) => {
      const title = toText(lesson.title);
      const summary = toText(lesson.summary ?? lesson.shortInfo);
      const flashcards = normalizeFlashcards(
        Array.isArray(lesson.cards) ? lesson.cards : lesson.flashcards,
      );
      const quiz = normalizeQuiz(
        Array.isArray(lesson.questions) ? lesson.questions : lesson.quiz,
      );
      const facts = normalizeFacts(lesson.facts);
      const content =
        toText(lesson.content) ||
        buildLessonContent({
          topicTitle: topic.title,
          chapterTitle,
          lessonTitle: title,
          summary,
          flashcards,
          facts,
          quiz,
        });

      lessons.push({
        slug: toText(lesson.slug) || slugify(title),
        title,
        topic: topic.title || undefined,
        topicSlug: topic.slug || undefined,
        module: chapterTitle,
        moduleSlug: chapterSlug || undefined,
        summary,
        content,
        type: lesson.type === "vault" ? "vault" : "lesson",
        videoUrl: toText(lesson.videoUrl),
        color: toText(lesson.color) || chapterColor,
        icon: toText(lesson.icon) || DEFAULT_LESSON_ICON,
        emoji: toText(lesson.emoji) || undefined,
        order: toInt(lesson.order, lessonIndex + 1),
        duration: toInt(lesson.duration, 5),
        xp: toInt(lesson.xp, lesson.type === "vault" ? 20 : 50),
        isPublished: toBool(lesson.isPublished, true),
        flashcards,
        quiz,
        facts,
      });
    });
  });

  return { topic, modules, lessons };
}

function isLegacyLessonSeed(seed) {
  if (Array.isArray(seed)) {
    return true;
  }

  return Boolean(
    seed &&
      typeof seed === "object" &&
      (seed.title || seed.module || seed.content || Array.isArray(seed.quiz)),
  );
}

function normalizeSeed(seed) {
  if (seed && typeof seed === "object" && Array.isArray(seed.chapters)) {
    return transformCurriculumSeed(seed);
  }

  if (isLegacyLessonSeed(seed)) {
    const lessons = normalizeLessons(seed).map((lesson, index) =>
      normalizeLegacyLesson(lesson, index),
    );
    return {
      topic: null,
      modules: inferModulesFromLessons(lessons),
      lessons,
    };
  }

  throw new Error(
    "Unsupported seed format. Use either the legacy flat lesson array or the nested curriculum format.",
  );
}

function matchesModuleSelection(moduleDoc, selectedModule) {
  const selectedText = toText(selectedModule);
  const selectedSlug = slugify(selectedText);

  return moduleDoc.title === selectedText || moduleDoc.slug === selectedSlug;
}

function matchesLessonSelection(lessonDoc, selectedModule) {
  const selectedText = toText(selectedModule);
  const selectedSlug = slugify(selectedText);

  return lessonDoc.module === selectedText || lessonDoc.moduleSlug === selectedSlug;
}

function validateModuleDocs(modules) {
  const invalid = [];
  const seen = new Set();

  modules.forEach((moduleDoc, index) => {
    const missing = [];
    if (!moduleDoc.title) missing.push("title");
    if (!moduleDoc.slug) missing.push("slug");

    const key = moduleDoc.slug || `index-${index}`;
    if (seen.has(key)) {
      invalid.push(`#${index + 1} (${moduleDoc.title || "untitled"}): duplicate slug "${key}"`);
      return;
    }
    seen.add(key);

    if (missing.length > 0) {
      invalid.push(`#${index + 1} (${moduleDoc.title || "untitled"}): ${missing.join(", ")}`);
    }
  });

  return invalid;
}

function validateLessonDocs(lessons) {
  const invalid = [];
  const seen = new Set();

  lessons.forEach((lesson, index) => {
    const missing = [];
    if (!lesson.title) missing.push("title");
    if (!lesson.module) missing.push("module");
    if (!lesson.content) missing.push("content");
    if (!Number.isInteger(lesson.order) || lesson.order < 0) missing.push("order");

    if (lesson.quiz.some((item) => item.options.length < 2)) {
      missing.push("quiz options");
    }

    if (
      lesson.quiz.some(
        (item) =>
          !Number.isInteger(item.correctOptionIndex) ||
          item.correctOptionIndex < 0 ||
          item.correctOptionIndex >= item.options.length,
      )
    ) {
      missing.push("quiz correctOptionIndex");
    }

    const lessonKey = `${lesson.moduleSlug || slugify(lesson.module)}::${lesson.slug || slugify(lesson.title)}`;
    if (seen.has(lessonKey)) {
      invalid.push(`#${index + 1} (${lesson.title || "untitled"}): duplicate lesson key "${lessonKey}"`);
      return;
    }
    seen.add(lessonKey);

    if (missing.length > 0) {
      invalid.push(`#${index + 1} (${lesson.title || "untitled"}): ${missing.join(", ")}`);
    }
  });

  return invalid;
}

function buildModuleLookupFilter(moduleDoc) {
  if (moduleDoc.slug) {
    return {
      $or: [
        { slug: moduleDoc.slug },
        { title: moduleDoc.title },
      ],
    };
  }

  return { title: moduleDoc.title };
}

function buildLessonLookupFilter(lessonDoc) {
  if (lessonDoc.slug && lessonDoc.moduleSlug) {
    return {
      $or: [
        { slug: lessonDoc.slug, moduleSlug: lessonDoc.moduleSlug },
        { title: lessonDoc.title, module: lessonDoc.module },
      ],
    };
  }

  return {
    title: lessonDoc.title,
    module: lessonDoc.module,
  };
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
  console.log("Supported seed formats:");
  console.log("  1. Legacy flat lesson array");
  console.log("  2. Nested curriculum JSON: topic -> chapters -> lessons -> cards -> quiz");
  console.log("");
  console.log("Examples:");
  console.log("  node backend-nest/seed/run-lesson-seed.js");
  console.log("  node backend-nest/seed/run-lesson-seed.js --dry-run");
  console.log("  node backend-nest/seed/run-lesson-seed.js --file seed/lessons.nepal-finlit-curriculum.json");
  console.log("  node backend-nest/seed/run-lesson-seed.js --file seed/curriculum.seed.example.json --dry-run");
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

  const rawSeed = readSeed(seedPath);
  const normalized = normalizeSeed(rawSeed);
  const selectedModules =
    options.mode === "replace-module"
      ? normalized.modules.filter((moduleDoc) =>
          matchesModuleSelection(moduleDoc, options.module),
        )
      : normalized.modules;
  const selectedLessons =
    options.mode === "replace-module"
      ? normalized.lessons.filter((lessonDoc) =>
          matchesLessonSelection(lessonDoc, options.module),
        )
      : normalized.lessons;

  if (normalized.lessons.length === 0) {
    throw new Error("Seed JSON has no lesson objects.");
  }
  if (selectedLessons.length === 0) {
    throw new Error("No lessons matched the current seed selection.");
  }

  const validationErrors = [
    ...validateModuleDocs(selectedModules),
    ...validateLessonDocs(selectedLessons),
  ];

  if (validationErrors.length > 0) {
    throw new Error(`Invalid seed JSON:\n${validationErrors.join("\n")}`);
  }

  if (options.dryRun) {
    console.log("Dry run OK");
    console.log(`File: ${seedPath}`);
    console.log(`Mode: ${options.mode}`);
    if (options.mode === "replace-module") {
      console.log(`Module filter: ${options.module}`);
    }
    if (normalized.topic?.title) {
      console.log(`Topic: ${normalized.topic.title}`);
    }
    console.log(`Chapters selected: ${selectedModules.length} of ${normalized.modules.length}`);
    console.log(`Lessons selected: ${selectedLessons.length} of ${normalized.lessons.length}`);
    const totalQuiz = selectedLessons.reduce(
      (sum, lesson) => sum + lesson.quiz.length,
      0,
    );
    const totalCards = selectedLessons.reduce(
      (sum, lesson) => sum + lesson.flashcards.length,
      0,
    );
    console.log(`Total flashcards (selected): ${totalCards}`);
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

  const lessonCollection = mongoose.connection.collection("lessons");
  const moduleCollection = mongoose.connection.collection("learningmodules");
  const now = new Date();

  if (options.mode === "replace-all") {
    const [deletedLessons, deletedModules] = await Promise.all([
      lessonCollection.deleteMany({}),
      moduleCollection.deleteMany({}),
    ]);
    console.log(`Deleted existing lessons: ${deletedLessons.deletedCount}`);
    console.log(`Deleted existing learning modules: ${deletedModules.deletedCount}`);
  } else if (options.mode === "replace-module") {
    const targetSlug = slugify(options.module);
    const [deletedLessons, deletedModules] = await Promise.all([
      lessonCollection.deleteMany({
        $or: [
          { module: options.module },
          { moduleSlug: targetSlug },
        ],
      }),
      moduleCollection.deleteMany({
        $or: [
          { title: options.module },
          { slug: targetSlug },
        ],
      }),
    ]);
    console.log(`Deleted existing lessons in module "${options.module}": ${deletedLessons.deletedCount}`);
    console.log(`Deleted existing learning modules for "${options.module}": ${deletedModules.deletedCount}`);
  }

  const moduleIdByKey = new Map();
  let insertedModules = 0;
  let updatedModules = 0;
  let matchedModules = 0;

  for (const moduleDoc of selectedModules) {
    const filter = buildModuleLookupFilter(moduleDoc);
    const result = await moduleCollection.updateOne(
      filter,
      {
        $set: {
          ...moduleDoc,
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      { upsert: true },
    );

    if (result.upsertedCount > 0) {
      insertedModules += 1;
    } else if (result.modifiedCount > 0) {
      updatedModules += 1;
    }
    matchedModules += result.matchedCount;

    const storedModule = await moduleCollection.findOne(
      buildModuleLookupFilter(moduleDoc),
      { projection: { _id: 1 } },
    );
    const moduleKey = moduleDoc.slug || moduleDoc.title;
    if (storedModule?._id) {
      moduleIdByKey.set(moduleKey, storedModule._id);
    }
  }

  let insertedLessons = 0;
  let updatedLessons = 0;
  let matchedLessons = 0;

  for (const lesson of selectedLessons) {
    const moduleKey = lesson.moduleSlug || lesson.module;
    const moduleId = moduleIdByKey.get(moduleKey);
    const filter = buildLessonLookupFilter(lesson);
    const result = await lessonCollection.updateOne(
      filter,
      {
        $set: {
          ...lesson,
          ...(moduleId ? { moduleId } : {}),
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      { upsert: true },
    );

    if (result.upsertedCount > 0) {
      insertedLessons += 1;
    } else if (result.modifiedCount > 0) {
      updatedLessons += 1;
    }
    matchedLessons += result.matchedCount;
  }

  console.log("Lesson seed complete.");
  console.log(`Mode: ${options.mode}`);
  if (options.mode === "replace-module") {
    console.log(`Module filter: ${options.module}`);
  }
  console.log(
    `Modules - Inserted: ${insertedModules}, Updated: ${updatedModules}, Matched existing: ${matchedModules}`,
  );
  console.log(
    `Lessons - Inserted: ${insertedLessons}, Updated: ${updatedLessons}, Matched existing: ${matchedLessons}`,
  );
}

run()
  .catch((error) => {
    console.error("Seed failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
