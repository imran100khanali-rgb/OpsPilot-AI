import pg from 'pg';

const { Client } = pg;

async function main() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'root',
    database: 'postgres',
  });

  await client.connect();
  const dbName = process.env.DB_NAME || 'opspilot_db';
  const res = await client.query('SELECT 1 FROM pg_database WHERE datname=$1', [dbName]);
  if (res.rows.length === 0) {
    console.log(`Creating database ${dbName}...`);
    await client.query(`CREATE DATABASE ${dbName}`);
    console.log(`Database ${dbName} created successfully.`);
  } else {
    console.log(`Database ${dbName} already exists.`);
  }
  await client.end();
}

void main().catch((err) => {
  console.error('Database setup failed:', err.message);
  process.exit(1);
});
