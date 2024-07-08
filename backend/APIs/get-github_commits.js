const axios = require("axios");
require("dotenv").config();

const username = process.env.ATLASSIAN_USERNAME;
const password = process.env.ATLASSIAN_API_KEY;
const domain = process.env.DOMAIN;

const auth = {
  username: username,
  password: password,
};

// Gets Github data REST API
async function getGithubCommits(storyId) {
  try {
    const baseUrl = "https://" + domain + ".atlassian.net";

    const config = {
      method: "get",
      url: `${baseUrl}/rest/dev-status/latest/issue/detail`,
      headers: { "Content-Type": "application/json" },
      auth: auth,
      params: {
        issueId: storyId,
        applicationType: "GitHub",
        dataType: "repository",
      },
    };

    const response = await axios.request(config);
    return response.data;
  } catch (error) {
    console.log("error: ", error.message);
  }
}

module.exports = getGithubCommits;
