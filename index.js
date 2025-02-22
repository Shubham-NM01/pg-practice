const pg = require("pg");
const config = require("./src/config");

const pool = new pg.Pool(config);

const client = new pg.Client({
  user: "postgres",
  password: "root",
  database: "test_db",
  host: "localhost",
  port: "5432",
});

const checkConnection = async () => {
  try {
    await client.connect();

    const result = await client.query("SELECT * FROM users");
    console.log(result);

    await client.end();
    console.log(client);
  } catch (error) {
    console.log(error);
  }
};
checkConnection()
checkConnection()
checkConnection()
checkConnection()
checkConnection()
// pool.on('connect', )
