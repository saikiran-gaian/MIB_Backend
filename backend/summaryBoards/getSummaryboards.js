const path = require('path');

const fs = require('fs').promises;
const jsonpath = path.join("summaryBoards.json")

async function get_summaryboards() {
  try {
    const data = await fs.readFile(jsonpath, "utf8");
    console.log(JSON.parse(data)); // Corrected parsing
    return JSON.parse(data);

  } catch (error) {
    return { error: "Internal server error" };
  }
}

module.exports = get_summaryboards;
