// Run in mongosh:
// use your_database_name
// load("backend-nest/seed/insert.introduction-nepal-share-market.mongodb.js")

db.lessons.insertOne({
  title: "Introduction to Nepal Share Market (Basics - Part 1)",
  module: "beginner",
  content:
    "Microlearning Module 1: What is a Share Market?\n" +
    "Concept Card 1: A share market is a place where people buy and sell shares of companies.\n" +
    "Concept Card 2: When you buy a share, you become a partial owner of that company.\n" +
    "Concept Card 3: Companies sell shares to raise money for business growth.\n" +
    "In-App Example Prompt: If you buy 10 shares of a bank, you own a small portion of that bank.\n\n" +
    "Microlearning Module 2: Why is Share Market Important?\n" +
    "Concept Card 1: The share market is a source of investment for individuals.\n" +
    "Concept Card 2: It is also a source of income for the government through taxes, fees, and economic activity.\n" +
    "Concept Card 3: A strong share market supports economic growth.\n\n" +
    "Microlearning Module 3: Role of Foreign Investment\n" +
    "Concept Card 1: Share markets attract foreign investors.\n" +
    "Concept Card 2: Foreign investment brings capital into the country.\n" +
    "Concept Card 3: More investment leads to more business growth and a stronger economy.\n\n" +
    "Microlearning Module 4: Why Should We Invest?\n" +
    "Concept Card 1: Investing helps grow your money over time.\n" +
    "Concept Card 2: Instead of keeping money idle, you can invest it to earn returns.\n" +
    "Concept Card 3: Share market investment is one way to participate in economic growth.\n\n" +
    "Quick Recap:\n" +
    "Share market means buying and selling company shares.\n" +
    "A share represents ownership in a company.\n" +
    "Share markets help government revenue and economic growth.\n" +
    "Foreign investment supports business growth.\n" +
    "Investing helps build long-term wealth.",
  videoUrl: "https://www.youtube.com/watch?v=0HuYEOO2r1g",
  color: "#0B3B78",
  icon: "BookOpen",
  order: 0,
  duration: 12,
  isPublished: true,
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
