export default () => ({
  jwt: {
    secret: process.env.JWT_SECRET,
  },
  database: {
    connectionString: process.env.MONGO_URI,
  },
  dataServer: {
    url: process.env.DATA_SERVER_URL || 'https://samridhha-data.manasi.com.np',
  },
});