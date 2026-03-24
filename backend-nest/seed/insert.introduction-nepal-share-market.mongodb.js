// Run in mongosh:
// use your_database_name
// load("backend-nest/seed/insert.introduction-nepal-share-market.mongodb.js")

db.lessons.insertOne({
  slug: "introduction-nepal-share-market-basics-part-1",
  title: "Introduction to Nepal Share Market (Basics - Part 1)",
  topic: "Nepal Financial Literacy",
  topicSlug: "nepal-financial-literacy",
  module: "Nepal Share Market",
  moduleSlug: "nepal-share-market",
  summary: "Get the big picture of what the Nepal share market is and why it matters.",
  content:
    "Topic: Nepal Financial Literacy\n" +
    "Chapter: Nepal Share Market\n" +
    "Lesson: Introduction to Nepal Share Market (Basics - Part 1)\n" +
    "Overview: Get the big picture of what the Nepal share market is and why it matters.\n" +
    "Concept Card 1: When people buy and sell company ownership in Nepal, what kind of market are they using?\n" +
    "Flip Answer 1: A share market is a place where people buy and sell shares of companies.\n" +
    "Concept Card 2: If you buy 10 shares of a bank, what do you actually become?\n" +
    "Flip Answer 2: When you buy a share, you become a partial owner of that company.\n" +
    "Concept Card 3: Why would a company sell shares to the public?\n" +
    "Flip Answer 3: Companies sell shares to raise money for business growth.\n" +
    "Concept Card 4: Besides investors, how can the share market help the wider economy?\n" +
    "Flip Answer 4: The share market is a source of investment, government revenue through taxes and fees, and broader economic activity.\n" +
    "Concept Card 5: Why does foreign investment matter in the share market?\n" +
    "Flip Answer 5: Foreign investment brings capital into the country and can support business growth and a stronger economy.\n" +
    "Concept Card 6: Why invest instead of leaving money idle?\n" +
    "Flip Answer 6: Investing helps grow your money over time and lets you participate in economic growth.",
  videoUrl: "https://www.youtube.com/watch?v=0HuYEOO2r1g",
  color: "#8B5CF6",
  icon: "TrendingUp",
  order: 0,
  duration: 12,
  isPublished: true,
  flashcards: [
    {
      prompt: "When people buy and sell company ownership in Nepal, what kind of market are they using?",
      answer: "A share market is a place where people buy and sell shares of companies.",
      tag: "Share Market",
    },
    {
      prompt: "If you buy 10 shares of a bank, what do you actually become?",
      answer: "When you buy a share, you become a partial owner of that company.",
      tag: "Ownership",
    },
    {
      prompt: "Why would a company sell shares to the public?",
      answer: "Companies sell shares to raise money for business growth.",
      tag: "Capital Raising",
    },
    {
      prompt: "Besides investors, how can the share market help the wider economy?",
      answer:
        "The share market is a source of investment, government revenue through taxes and fees, and broader economic activity.",
      tag: "Economic Role",
    },
    {
      prompt: "Why does foreign investment matter in the share market?",
      answer:
        "Foreign investment brings capital into the country and can support business growth and a stronger economy.",
      tag: "Foreign Investment",
    },
    {
      prompt: "Why invest instead of leaving money idle?",
      answer:
        "Investing helps grow your money over time and lets you participate in economic growth.",
      tag: "Why Invest",
    },
  ],
  quiz: [
    {
      prompt: "What is a share?",
      options: [
        "A loan to the government",
        "Ownership in a company",
        "A bank account",
        "A tax receipt",
      ],
      correctOptionIndex: 1,
      explanation:
        "A share gives you ownership in a company, even if it is a small percentage.",
    },
    {
      prompt: "Why do companies sell shares?",
      options: [
        "To reduce taxes",
        "To raise money",
        "To close the company",
        "To pay employees only",
      ],
      correctOptionIndex: 1,
      explanation:
        "Companies issue shares mainly to raise capital for growth and operations.",
    },
    {
      prompt: "How does the share market help the government?",
      options: [
        "It replaces banks",
        "It provides revenue and supports the economy",
        "It removes foreign investors",
        "It controls inflation directly",
      ],
      correctOptionIndex: 1,
      explanation:
        "Taxes, fees, and broader market activity can support government revenue and growth.",
    },
    {
      prompt: "Foreign investment helps because:",
      options: [
        "It reduces companies",
        "It takes money out of the country",
        "It brings capital and supports economic growth",
        "It stops business growth",
      ],
      correctOptionIndex: 2,
      explanation:
        "Foreign capital can improve liquidity, business expansion, and market confidence.",
    },
    {
      prompt: "Investing in shares means:",
      options: [
        "You become part owner of a company",
        "You lend money to a friend",
        "You buy gold",
        "You open a savings account",
      ],
      correctOptionIndex: 0,
      explanation:
        "Shares represent ownership, unlike savings accounts or personal lending.",
    },
    {
      prompt: "Mini Assessment: Share market only benefits investors. (True or False)",
      options: ["True", "False"],
      correctOptionIndex: 1,
      explanation:
        "Share markets also support business funding, jobs, and wider economic activity.",
    },
    {
      prompt: "Mini Assessment: Foreign investment can help grow the economy. (True or False)",
      options: ["True", "False"],
      correctOptionIndex: 0,
      explanation:
        "Foreign capital can improve growth when channelled into productive sectors.",
    },
    {
      prompt:
        "Mini Assessment: Buying shares means you own part of the company. (True or False)",
      options: ["True", "False"],
      correctOptionIndex: 0,
      explanation: "Ownership can be small, but it is still ownership.",
    },
  ],
});
