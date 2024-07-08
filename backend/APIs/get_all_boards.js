var axios = require("axios");
require("dotenv").config();

const username = process.env.ATLASSIAN_USERNAME;
const password = process.env.ATLASSIAN_API_KEY;
const domain = process.env.DOMAIN;

const auth = {
  username: username,
  password: password,
};

//Gets all boards using the Jira Cloud REST API with pagination
async function get_all_boards() {
  try {
    const baseUrl = "https://" + domain + ".atlassian.net";
    let startAt = 0;
    let allBoards = [];

    while (true) {
      const config = {
        method: "get",
        url: `${baseUrl}/rest/agile/1.0/board?startAt=${startAt}&type=scrum`,
        headers: { "Content-Type": "application/json" },
        auth: auth,
      };

      const response = await axios.request(config);
      const boards = response.data.values;
      allBoards = allBoards.concat(boards);

      if (boards.length == 0) {
        // If the number of boards retrieved is less than 50, it means we've reached the end
        break;
      } else {
        // Increment startAt for the next pagination
        startAt += 50;
      }
    }

    return allBoards;
  } catch (error) {
    console.log("error: ");
    console.log(error?.response?.data.errors);
    throw error; // Re-throwing the error for handling at a higher level if needed
  }
}

module.exports = get_all_boards;
