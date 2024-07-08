var axios = require("axios");
require("dotenv").config();

const username = process.env.ATLASSIAN_USERNAME;
const password = process.env.ATLASSIAN_API_KEY;
const domain = process.env.DOMAIN;

const auth = {
  username: username,
  password: password,
};

//Gets all issues in a particular project using the Jira Cloud REST API
async function get_project_data(projectKey) {
  try {
    const baseUrl = "https://" + domain + ".atlassian.net";
    // https://gaiansolutions.atlassian.net/rest/api/3/project/IMPL
    const config = {
      method: "get",
      url:
        baseUrl +
        "/rest/api/3/project/" +
        projectKey,
      headers: { "Content-Type": "application/json" },
      auth: auth,
    };
    const response = await axios.request(config);
    return response.data;
  } catch (error) {
    console.log("error: ");
    console.log(error?.response?.data.errors);
  }
}

module.exports = get_project_data;
