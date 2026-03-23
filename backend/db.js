const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

const dbPath = path.join(__dirname, "scheduler.db");
const schemaPath = path.join(__dirname, "schema.sql");

const db = new sqlite3.Database(dbPath);

function runSchema() {
  const schema = fs.readFileSync(schemaPath, "utf8");
  db.exec(schema, (err) => {
    if (err) {
      console.error("Schema init error:", err.message);
    } else {
      console.log("Database schema ready.");
    }
  });
}

function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

module.exports = {
  db,
  runSchema,
  query,
  get,
  run
};