const express = require("express");


const cache = require("memory-cache"); // In-memory caching library

const { v4: uuidv4 } = require("uuid");
const cors = require("cors");
require("dotenv").config();
const getSprints = require("./APIs/get-all-sprints-for-a-board");
const getSprintIssues = require("./APIs/get-all-issues-for-a-sprint");
const getBoardIssues = require("./APIs/get-all-issues-for-a-board");
const getComments = require("./APIs/comments");
const getAlerts = require("./APIs/getalerts");
const { isToday } = require("./APIs/utils");
const get_board_metadata = require("./APIs/get_board_metadata");
const get_project_data = require("./APIs/get_project_data");
const get_all_boards = require("./APIs/get_all_boards");
const get_summaryboards = require("./summaryBoards/getSummaryboards");
const getGithubCommits = require("./APIs/get-github_commits");
const getGithubPulls = require("./APIs/get-github_pulls");
const lms_landd = require("./LMSandL&D/Schemas/LmsAndLandDSchema");
const lms_landd_employees = require("./LMSandL&D/Schemas/EmployeeSchemaLMS");
const findEmployeeByIdAndName = require("./LMSandL&D/APIs/get_employee_data");
const getCourse = require("./LMSandL&D/Schemas/CourseSchema");
const getEmployeeCourses = require("./LMSandL&D/APIs/get_employee_courses");
const bycrpt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

// const summaryJsonpath = require("./boardsJson/summaryBoards.json")
const fs = require("fs").promises;
const mongo_uri = process.env.MONGO_URI;
const app = express();
const mongoose = require("mongoose");
const PORT = 8080;
// const PORT = 4000;

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());
app.use(cookieParser());

mongoose
  .connect(mongo_uri)
  .then(() => {
    console.log("connected to Data-base");
  })
  .catch((e) => {
    console.log(e);
  });

app.get("/health", async (req, res) => {
  res.json({ message: "ok" });
});

// APIs for React

// All boards
app.get("/allBoards", async (req, res) => {
  try {
    const data = await get_all_boards();
    let response = data
      ? data.map((board) => ({
          board_id: board.id,
          board_name: board.name,
          board_type: board.type,
          project_key: board.location ? board.location.projectKey : null,
        }))
      : [];

    // console.log(response);
    res.json(response);
  } catch (error) {
    console.error("Error fetching boards:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/:boardId/allSprints", async (req, res) => {
  const board_id = req.params.boardId;
  const data = await getSprints(board_id);
  let sprints = data?.values ? data.values : [];
  // conole.log(sprints);
  res.json(sprints);
});

// ALerts
app.get("/alerts", async (req, res) => {
  try {
    const data = await getAlerts();
    const issues = data?.issues || [];

    const alerts_data = issues
      .filter(
        (issue) =>
          issue.fields.issuetype.name === "Story" &&
          issue.fields.customfield_10018
      )
      .map((issue) => {
        const { fields } = issue;
        const customField = fields.customfield_10018[0];
        const reviewers = fields.customfield_10003 || [];

        return {
          creator: fields.creator.displayName,
          assignee: fields.assignee ? fields.assignee.displayName : "Not added",
          sprint_id: customField.id.toString(),
          sprint_name: customField.name,
          sprint_start: customField.startDate
            ? customField.startDate.substring(0, 10)
            : "",
          sprint_end: customField.endDate
            ? customField.endDate.substring(0, 10)
            : "",
          story_id: issue.id,
          story_name: fields.summary,
          story_type: fields.issuetype.name,
          story_status: fields.status.statusCategory.name,
          project_id: fields.project.id,
          project_name: fields.project.name,
          status_name: fields.status.name,
          story_points: fields.customfield_10020 || 0,
          story_ac_hygiene: fields.customfield_10156 ? "YES" : "NO",
          story_reviewers: reviewers.length
            ? reviewers.map((r) => r.displayName).join(", ")
            : "Reviewers not added",
          updated: fields.updated,
          priority: fields.priority.name,
          time_original_estimate: fields.timeoriginalestimate || "Not added",
        };
      });

    res.json(alerts_data);
  } catch (error) {
    console.error("Error fetching alerts:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/comments", async (req, res) => {
  const body = req.params.body;
  const issues = await getComments(body);
  // const issues = data.issues || [];
  // conole.log("no of issues: " + issues.length);
  const issuesHavingStatusComments = issues.filter((issue) => {
    const comments =
      (issue.fields.comment && issue.fields.comment.comments) || [];
    const dayComments = comments.filter((c) => isToday(c.updated));
    const commentsHavingUpdate = dayComments.filter((c) => {
      const hasUpdate = c.body.trim().startsWith("[#STATUS_UPDATE#]:");
      if (hasUpdate) c.body = c.body.substring(19).trim();
      return hasUpdate;
    });
    const havingUpdates = commentsHavingUpdate.length > 0;
    issue.statusUpdates = commentsHavingUpdate;
    return havingUpdates;
  });
  // let all_comments = data;
  res.json(issuesHavingStatusComments);
});

app.get("/:boardId/activeSprint", async (req, res) => {
  const board_id = req.params.boardId;
  const data = await getSprints(board_id);
  const active_sprint = data.values.filter(
    (sprint) => sprint.state === "active"
  );
  if (active_sprint.length === 0) {
    const closed_sprints = data.values.filter(
      (sprint) => sprint.state === "closed"
    );
    res.json({ active_sprint: closed_sprints[closed_sprints.length - 1] });
    // // conole.log({ active_sprint: closed_sprints[closed_sprints.length - 1] });
  } else {
    res.json({
      active_sprint: active_sprint[0],
    });
    // // conole.log({
    // active_sprint: active_sprint[0],
    // });
  }
});

app.get("/sprint/:sprintId/stories", async (req, res) => {
  const sprint_id = req.params.sprintId;
  const response = await getSprintIssues(sprint_id);

  const story_subtask_map = {};
  const issues = [];

  for (let issue of response?.issues || []) {
    if (issue.fields.issuetype.name === "Story") {
      const story_id = issue.id;
      const story = {
        story_id: story_id,
        story_key: issue.key,
        story_name: issue.fields.summary,
        story_type: issue.fields.issuetype.name,
        story_status: issue.fields.status.statusCategory.name,
        project_id: issue.fields.project.id,
        project_name: issue.fields.project.name,
        project_key: issue.fields.project.key,
        status_name: issue.fields.status.name,
        sprint_id: issue.fields.customfield_10018[0].id.toString(),
        story_ac_hygiene:
          issue.fields.customfield_10156 !== null ? "YES" : "NO",
        original_estimate:
          issue.fields.timetracking.originalEstimate || "Not added",
        remaining_estimate:
          issue.fields.timetracking.remainingEstimate || "Not added",
        time_spent: issue.fields.timetracking.timeSpent || "Not added",
        story_reviewers: issue.fields.customfield_10003
          ? issue.fields.customfield_10003.length !== 0
            ? issue.fields.customfield_10003
                .map((r) => r.displayName)
                .join(", ")
            : "Reviewers not added"
          : "Reviewers not added",
        story_points:
          issue.fields.customfield_10020 == null
            ? 0
            : issue.fields.customfield_10020,
        updated: issue.fields.updated,
        creator: issue.fields.creator.displayName,
        assignee:
          issue.fields.assignee !== null
            ? issue.fields.assignee.displayName
            : "Not added",
        duedate:
          issue.fields.duedate == null ? "Not added" : issue.fields.duedate,
        sprint_start: issue.fields.customfield_10018[0].startDate
          ? issue.fields.customfield_10018[0].startDate.substring(0, 10)
          : "",
        sprint_end: issue.fields.customfield_10018[0].endDate
          ? issue.fields.customfield_10018[0].endDate.substring(0, 10)
          : "",
        number_of_sub_tasks: 0,
        completed_sub_tasks: 0,
      };

      story_subtask_map[story_id] = story;
      issues.push(story);
    } else if (
      issue.fields.issuetype.name === "Sub-task" &&
      issue.fields.parent
    ) {
      const parent_id = issue.fields.parent.id;
      const parent_story = story_subtask_map[parent_id];
      if (parent_story) {
        parent_story.number_of_sub_tasks++;
        if (issue.fields.customfield_10020) {
          parent_story.story_points += issue.fields.customfield_10020;
        }
        if (issue.fields.status.name === "Done") {
          parent_story.completed_sub_tasks++;
        }
      }
    }
  }

  res.json({ issues });
});

app.get("/sprint/:sprintId/progress", async (req, res) => {
  const sprint_id = req.params.sprintId;
  const data = await getSprintIssues(sprint_id);
  const story_subtask_map = {};
  const issues = data?.issues ? data.issues : [];
  for (let issue of issues) {
    if (issue.fields.issuetype.name === "Story") {
      if (!story_subtask_map[issue.id]) {
        story_subtask_map[issue.id] = {
          number_of_sub_tasks: 0,
          completed_sub_tasks: 0,
          story_id: issue.id,
          story_name: issue.fields.summary,
          project_id: issue.fields.project.id,
          sprint_id: issue.fields.customfield_10018[0].id.toString(),
          story_points: 0,
          story_status: issue.fields.status.name,
          assignee:
            issue.fields.assignee !== null
              ? issue.fields.assignee.displayName
              : "Not added",
        };
        // conole.log("story_subtask_map", story_subtask_map);
      }
    }
  }
  for (let issue of issues) {
    if (issue.fields.issuetype.name === "Sub-task") {
      if (issue.fields.parent) {
        const parent_id = issue.fields.parent.id;
        if (story_subtask_map[parent_id]) {
          story_subtask_map[parent_id].number_of_sub_tasks++;
          if (issue.fields.customfield_10020) {
            story_subtask_map[parent_id].story_points +=
              issue.fields.customfield_10020;
          }
          if (issue.fields.status.name === "Done") {
            story_subtask_map[parent_id].completed_sub_tasks++;
          }
        }
      }
    }
  }
  const values = Object.values(story_subtask_map);
  res.json({
    sprint_progress: values,
  });
  // // conole.log({
  //   sprint_progress: values,
  // });
});

app.get("/sprint/:sprintId/subtasks/progress", async (req, res) => {
  const sprint_id = req.params.sprintId;
  const data = await getSprintIssues(sprint_id);
  const status_category_map = {};
  const issues = data?.issues ? data.issues : [];
  const sub_tasks = issues
    .filter((i) => i.fields.issuetype.name === "Sub-task")
    .map((i) => {
      return {
        issue_id: i.id,
        issue_type: i.fields.issuetype.name,
        story_id: i.fields.parent.id,
        status_category_name: i.fields.status.statusCategory.name,
        assignee: i.fields.assignee
          ? i.fields.assignee.displayName
          : "Not added",
        issue_name: i.fields.summary,
      };
    });
  for (let subtask of sub_tasks) {
    const key = subtask.story_id + subtask.status_category_name;
    if (!status_category_map[key]) {
      status_category_map[key] = {
        story_id: subtask.story_id,
        status_category_name: subtask.status_category_name,
        issue_count: 1,
        assignee: subtask.assignee,
      };
    } else {
      status_category_map[key].issue_count++;
    }
  }

  const values = Object.values(status_category_map);
  res.json({
    values,
  });
  // // conole.log({ values });
});

app.get("/sprint/:sprintId/members", async (req, res) => {
  try {
    const sprint_id = req.params.sprintId;
    const data = await getSprintIssues(sprint_id);
    const issues = data?.issues ? data.issues : [];

    let accountIdSet = new Set(); // Using a Set to ensure uniqueness
    let members = [];

    for (let issue of issues) {
      if (issue.fields.assignee) {
        let accountId = issue.fields.assignee.accountId.toString();
        if (!accountIdSet.has(accountId)) {
          let member = {
            sprint_member_account_id: accountId,
            sprint_member_full_name: issue.fields.assignee.displayName,
            sprint_member_card_name: issue.fields.assignee.displayName
              .substring(0, 2)
              .toUpperCase(),
          };
          members.push(member);
          accountIdSet.add(accountId);
        }
      }
    }

    res.json({ members });
    // conole.log({ members });
  } catch (error) {
    console.error("Error fetching sprint members:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// APIs for PI

// This API is to fetch all the stories
// for a specific board
app.get("/:boardId/sprints", async (req, res) => {
  const board_id = req.params.boardId;
  const data = await getSprints(board_id);
  let sprints = data?.values ? data.values : [];
  sprints = sprints.map((sprint) => {
    if (sprint.state !== "future")
      return {
        board_id: sprint.originBoardId.toString(),
        sprint_id: sprint.id.toString(),
        sprint_name: sprint.name,
        sprint_start: sprint.startDate.substring(0, 10),
        sprint_end: sprint.endDate.substring(0, 10),
        spint_state: sprint.state,
      };
  });
  // Getting rid of null values
  sprints = sprints.filter((sprint) => {
    if (sprint) return sprint;
  });
  res.json(sprints);
  // // conole.log(sprints);
});

app.get("/:boardID/stories", async (req, res) => {
  const board_id = req.params.boardID;
  const data = await getBoardIssues(board_id);
  const issues = data?.issues ? data.issues : [];
  const stories = issues
    ?.filter((issue) => issue.fields.issuetype.name === "Story")
    .map((issue) => {
      if (issue.fields.customfield_10018) {
        return {
          board_id,
          story_points:
            issue.fields.customfield_10020 == null
              ? 0
              : issue.fields.customfield_10020,
          assignee:
            issue.fields.assignee !== null
              ? issue.fields.assignee.displayName
              : "Not added",
          sprint_id: issue.fields.customfield_10018[0].id.toString(),
          sprint_name: issue.fields.customfield_10018[0].name,
          sprint_start: issue.fields.customfield_10018[0].startDate
            ? issue.fields.customfield_10018[0].startDate.substring(0, 10)
            : "",
          sprint_end: issue.fields.customfield_10018[0].endDate
            ? issue.fields.customfield_10018[0].endDate.substring(0, 10)
            : "",
          story_id: issue.id,
          story_name: issue.fields.summary,
          story_type: issue.fields.issuetype.name,
          story_status: issue.fields.status.statusCategory.name,
          project_id: issue.fields.project.id,
          project_name: issue.fields.project.name,
          status_name: issue.fields.status.name,
          story_ac_hygiene: issue.fields.customfield_10156 ? "YES" : "NO",
          original_estimate:
            issue.fields.timetracking.originalEstimate || "Not added",
          remaining_estimate:
            issue.fields.timetracking.remainingEstimate || "Not added",
          time_spent: issue.fields.timetracking.timeSpent || "Not added",
          story_reviewers: issue.fields.customfield_10003
            ? issue.fields.customfield_10003.length !== 0
              ? issue.fields.customfield_10003
                  .map((r, i) => r.displayName)
                  .join(", ")
              : "Reviewers not added"
            : "Reviewers not added",
        };
      }
      return undefined;
    })
    .filter((story) => story !== undefined); // Filter out undefined entries

  res.json({
    stories,
  });
  // // conole.log({
  //   stories,
  // });
});
// for understanding
// if variable==100 ? 100 < x ? 10 : null : not
// {{[{},{}],[]}}

// This API is to fetch all sprint progress
// for a specific board
app.get("/:boardID/sprint/progress", async (req, res) => {
  const board_id = req.params.boardID;
  const data = await getBoardIssues(board_id);
  const issues = data.issues;
  const story_subtask_map = {};
  for (let issue of issues) {
    if (issue.fields.issuetype.name === "Story") {
      if (!story_subtask_map[issue.id]) {
        if (issue.fields.customfield_10018) {
          story_subtask_map[issue.id] = {
            number_of_sub_tasks: 0,
            completed_sub_tasks: 0,
            story_id: issue.id,
            story_name: issue.fields.summary,
            project_id: issue.fields.project.id,
            sprint_id: issue.fields.customfield_10018[0].id.toString(),
            story_points: 0,
            board_id,
            story_status: issue.fields.status.statusCategory.name,
            assignee:
              issue.fields.assignee !== null
                ? issue.fields.assignee.displayName
                : "Not added",
          };
        }
      }
    }
  }
  for (let issue of issues) {
    if (issue.fields.issuetype.name === "Sub-task") {
      if (issue.fields.parent) {
        const parent_id = issue.fields.parent.id;
        if (story_subtask_map[parent_id]) {
          story_subtask_map[parent_id].number_of_sub_tasks++;
          if (issue.fields.customfield_10020) {
            story_subtask_map[parent_id].story_points +=
              issue.fields.customfield_10020;
          }
          if (issue.fields.status.name === "Done") {
            story_subtask_map[parent_id].completed_sub_tasks++;
          }
        }
      }
    }
  }
  let values = Object.values(story_subtask_map);
  values = values.map((v) => {
    return {
      number_of_sub_tasks: v.number_of_sub_tasks.toString(),
      completed_sub_tasks: v.completed_sub_tasks.toString(),
      story_id: v.story_id,
      story_name: v.story_name,
      project_id: v.project_id,
      sprint_id: v.sprint_id.toString(),
      story_points: v.story_points.toString(),
      board_id: v.board_id,
      story_status: v.story_status,
      assignee: v.assignee,
    };
  });
  res.json({
    sprint_progress: values,
  });
  // // conole.log({
  //   sprint_progress: values,
  // });
});

// This API is to fetch all story progress
// for a specific board
app.get("/:boardID/sprint/story/progress", async (req, res) => {
  const board_id = req.params.boardID;
  const data = await getBoardIssues(board_id);
  const status_category_map = {};
  const issues = data.issues;
  const sub_tasks = issues
    .filter((i) => i.fields.issuetype.name === "Sub-task")
    .map((i) => {
      return {
        issue_id: i.id,
        issue_type: i.fields.issuetype.name,
        story_id: i.fields.parent.id,
        status_category_name: i.fields.status.statusCategory.name,
        issue_name: i.fields.summary,
        assignee:
          i.fields.assignee !== null
            ? i.fields.assignee.displayName
            : "Not added",
      };
    });
  for (let subtask of sub_tasks) {
    const key = subtask.story_id + subtask.status_category_name;
    if (!status_category_map[key]) {
      status_category_map[key] = {
        story_id: subtask.story_id,
        status_category_name: subtask.status_category_name,
        issue_count: 1,
        assignee: subtask.assignee,
      };
    } else {
      status_category_map[key].issue_count++;
    }
  }
  let values = Object.values(status_category_map);
  values = values.map((v) => {
    return {
      story_id: v.story_id,
      status_category_name: v.status_category_name,
      issue_count: v.issue_count.toString(),
      assignee: v.assignee,
      unique_id: v.story_id + v.status_category_name,
    };
  });

  res.json({
    values,
  });
  // // conole.log({
  //   values,
  // });
});

// This API is to fetch all sprint members
// for a specific board
app.get("/:boardID/sprint/members", async (req, res) => {
  const board_id = req.params.boardID;
  
  // Check if the data is already in the cache
  const cachedData = cache.get(board_id);
  if (cachedData) {
    return res.json({ members: cachedData });
  }

  try {
    const data = await getBoardIssues(board_id);
    const issues = data.issues;
    let names = new Set();
    let members = [];

    // Process issues in parallel
    await Promise.all(
      issues.map(async (issue) => {
        if (issue.fields.issuetype.name !== "Story" && issue.fields.assignee) {
          if (issue.fields.customfield_10018) {
            let name =
              issue.fields.assignee.displayName +
              issue.fields.customfield_10018[0].id.toString();
            if (!names.has(name)) {
              let member = {
                board_id,
                sprint_id: issue.fields.customfield_10018[0].id.toString(),
                sprint_member_account_id:
                  issue.fields.assignee.accountId.toString(),
                sprint_member_full_name: issue.fields.assignee.displayName,
                sprint_member_card_name: issue.fields.assignee.displayName
                  .substring(0, 2)
                  .toUpperCase(),
                unique_id:
                  issue.fields.customfield_10018[0].id.toString() +
                  issue.fields.assignee.displayName,
                assignee:
                  issue.fields.assignee !== null
                    ? issue.fields.assignee.displayName
                    : "Not added",
              };
              members.push(member);
              names.add(name);
            }
          }
        }
      })
    );

    // Store the result in the cache
    cache.put(board_id, members, 60000); // Cache for 1 minute

    res.json({
      members,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
// Summary dashboard
app.post("/summaryview", async (req, res) => {
  const activeSprints = [];
  const all_pie_data = [];
  let values = {};
  try {
    const data = req.body;
    const summary_boards = data.filter((board) => board.board_type == "scrum");

    for (let i = 0; i < summary_boards.length; i++) {
      const board_id = summary_boards[i].board_id;
      const data = await getSprints(board_id);
      const active_sprint = data?.values
        ? data.values.find((sprint) => sprint.state === "active")
        : [];
      if (!active_sprint) {
        const closed_sprints = data.values.filter(
          (sprint) => sprint.state === "closed"
        );
        activeSprints.push(closed_sprints[closed_sprints.length - 1]);
      } else {
        activeSprints.push(active_sprint);
      }
    }

    // pie_data
    for (let i = 0; i < activeSprints.length; i++) {
      const sprint_id = activeSprints[i]?.id;
      const data = await getSprintIssues(sprint_id);
      const status_category_map = {};
      const issues = data?.issues ? data?.issues : [];
      const sub_tasks = issues
        .filter((i) => i.fields.issuetype.name === "Sub-task")
        .map((i) => {
          return {
            issue_id: i.id,
            issue_type: i.fields.issuetype.name,
            story_id: i.fields.parent.id,
            status_category_name: i.fields.status.statusCategory.name,
            assignee: i.fields.assignee
              ? i.fields.assignee.displayName
              : "Not added",
            issue_name: i.fields.summary,
          };
        });
      for (let subtask of sub_tasks) {
        const key = subtask.story_id + subtask.status_category_name;
        if (!status_category_map[key]) {
          status_category_map[key] = {
            story_id: subtask.story_id,
            status_category_name: subtask.status_category_name,
            issue_count: 1,
            assignee: subtask.assignee,
          };
        } else {
          status_category_map[key].issue_count++;
        }
      }
      values = Object.values(status_category_map);
      all_pie_data.push({ values });
    }

    // Subtask Calculations
    let all_pie_chart_data = [];
    if (all_pie_data.length > 0) {
      for (let i = 0; i < all_pie_data.length; i++) {
        const pie_chart_data = all_pie_data[i].values;

        let piedata = new Map();

        pie_chart_data.forEach((d) => {
          if (piedata.has(d.status_category_name)) {
            piedata.set(
              d.status_category_name,
              piedata.get(d.status_category_name) + d.issue_count
            );
          } else {
            piedata.set(d.status_category_name, d.issue_count);
          }
        });
        if (piedata.size === 0) {
          piedata.set("NO Subtask", 0);
        }
        const piedataObject = Object.fromEntries(piedata);
        all_pie_chart_data.push([piedataObject]); // Push arrays containing objects
      }
    }

    // Transforming all_pie_chart_data
    const responseObj = {};
    summary_boards.forEach((board, index) => {
      const boardName = board.board_name;
      const pieData = all_pie_chart_data[index] || [];

      // Initialize board data
      const boardData = {};

      // Accumulate counts for each status category
      pieData.forEach((data) => {
        Object.keys(data).forEach((status) => {
          if (boardData[status]) {
            boardData[status] += data[status];
          } else {
            boardData[status] = data[status];
          }
        });
      });

      // Push the board data into the response object
      responseObj[boardName] = Object.keys(boardData).map((status) => ({
        [status]: boardData[status],
      }));
    });

    res.json(responseObj); // Sending transformed data in the response
    // // conole.log([responseObj]);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// All active sprints piechart
app.get("/summaryDashboard/:sprintId/:sprintName/subtask", async (req, res) => {
  const sprint_id = req.params.sprintId;
  const sprint_name = req.params.sprintName;
  const all_pie_data = [];
  let values = {};
  try {
    const data = await getSprintIssues(sprint_id);

    const status_category_map = {};
    const issues = data?.issues ? data.issues : [];
    const sub_tasks = issues
      .filter((i) => i.fields.issuetype.name === "Sub-task")
      .map((i) => {
        return {
          issue_id: i.id,
          issue_type: i.fields.issuetype.name,
          story_id: i.fields.parent.id,
          status_category_name: i.fields.status.statusCategory.name,
          assignee: i.fields.assignee
            ? i.fields.assignee.displayName
            : "Not added",
          issue_name: i.fields.summary,
        };
      });
    for (let subtask of sub_tasks) {
      const key = subtask.story_id + subtask.status_category_name;
      if (!status_category_map[key]) {
        status_category_map[key] = {
          story_id: subtask.story_id,
          status_category_name: subtask.status_category_name,
          issue_count: 1,
          assignee: subtask.assignee,
        };
      } else {
        status_category_map[key].issue_count++;
      }
    }
    values = Object.values(status_category_map);
    all_pie_data.push({ values });

    // Subtask Calculations
    let all_pie_chart_data = [];
    if (all_pie_data.length > 0) {
      const pie_chart_data = all_pie_data[0].values; // Since we're getting data for a single sprint

      let piedata = new Map();

      pie_chart_data.forEach((d) => {
        if (piedata.has(d.status_category_name)) {
          piedata.set(
            d.status_category_name,
            piedata.get(d.status_category_name) + d.issue_count
          );
        } else {
          piedata.set(d.status_category_name, d.issue_count);
        }
      });
      if (piedata.size === 0) {
        piedata.set("NO Subtask", 0);
      }
      const piedataObject = Object.fromEntries(piedata);
      all_pie_chart_data.push(piedataObject); // Push objects directly
    }

    // Transforming all_pie_chart_data
    const responseArray = [];
    const sprintName = sprint_name; // Using sprint_id as sprintName since we're getting data for a single sprint
    const pieData = all_pie_chart_data[0] || {}; // Since we're getting data for a single sprint

    // Push the board data into the response array
    const sprintData = {};
    Object.keys(pieData).forEach((status) => {
      const statusObj = {};
      statusObj[status] = pieData[status];
      responseArray.push(statusObj);
    });

    res.json([{ [sprintName]: responseArray }]); // Sending transformed data in the response
    // // conole.log([{ [sprintName]: responseArray }]);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Summary dashboard subtask progressal
app.get("/summaryDashboard/:boardId/subtask/progress", async (req, res) => {
  const board_id = req.params.boardId;
  const allSprints = [];
  const all_pie_data = [];
  let values = {};
  try {
    const data = await getSprints(board_id);

    const sprints_data = data?.values ? data.values : [];
    // conole.log(sprints_data, "sprints_data");

    for (let i = 0; i < sprints_data.length; i++) {
      const sprint_id = sprints_data[i].id;
      const data = await getSprintIssues(sprint_id);

      const status_category_map = {};
      const issues = data?.issues ? data.issues : [];
      const sub_tasks = issues
        .filter((i) => i.fields.issuetype.name === "Sub-task")
        .map((i) => {
          return {
            issue_id: i.id,
            issue_type: i.fields.issuetype.name,
            story_id: i.fields.parent.id,
            status_category_name: i.fields.status.statusCategory.name,
            assignee: i.fields.assignee
              ? i.fields.assignee.displayName
              : "Not added",
            issue_name: i.fields.summary,
          };
        });
      for (let subtask of sub_tasks) {
        const key = subtask.story_id + subtask.status_category_name;
        if (!status_category_map[key]) {
          status_category_map[key] = {
            story_id: subtask.story_id,
            status_category_name: subtask.status_category_name,
            issue_count: 1,
            assignee: subtask.assignee,
          };
        } else {
          status_category_map[key].issue_count++;
        }
      }
      values = Object.values(status_category_map);
      all_pie_data.push({ values });
    }

    // Subtask Calculations
    let all_pie_chart_data = [];
    if (all_pie_data.length > 0) {
      for (let i = 0; i < all_pie_data.length; i++) {
        const pie_chart_data = all_pie_data[i].values;

        let piedata = new Map();

        pie_chart_data.forEach((d) => {
          if (piedata.has(d.status_category_name)) {
            piedata.set(
              d.status_category_name,
              piedata.get(d.status_category_name) + d.issue_count
            );
          } else {
            piedata.set(d.status_category_name, d.issue_count);
          }
        });
        if (piedata.size === 0) {
          piedata.set("NO Subtask", 0);
        }
        const piedataObject = Object.fromEntries(piedata);
        all_pie_chart_data.push([piedataObject]); // Push arrays containing objects
      }
    }

    // Transforming all_pie_chart_data
    const responseObj = {};
    sprints_data.forEach((sprint, index) => {
      const sprintName = sprint.name;
      const pieData = all_pie_chart_data[index] || [];

      // Initialize board data
      const sprintData = {};

      // Accumulate counts for each status category
      pieData.forEach((data) => {
        Object.keys(data).forEach((status) => {
          if (sprintData[status]) {
            sprintData[status] += data[status];
          } else {
            sprintData[status] = data[status];
          }
        });
      });

      // Push the board data into the response object
      responseObj[sprintName] = Object.keys(sprintData).map((status) => ({
        [status]: sprintData[status],
      }));
    });
    let response_data_obj = Object.fromEntries(
      Object.entries(responseObj).reverse()
    );
    res.json([response_data_obj]); // Sending transformed data in the response
    // // conole.log([response_data_obj]);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Project Data
app.get("/:boardId/project", async (req, res) => {
  const board_id = req.params.boardId;

  let values = {};
  try {
    const data = await get_board_metadata(board_id);
    const project_data = [data?.location.projectKey, data?.location.projectId];

    let project_key = project_data[0] !== null ? project_data[0] : project_data[1];
    // conole.log(project_key);
    const response = await get_project_data(project_key);
    // conole.log(response);
    const project = {
      project_name: response?.name ? response.name : "",
      project_lead: response?.lead.displayName ? response.lead.displayName : "",
    };

    res.json({ project });
    debugger;
    // conole.log({ project });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Piechart calculation for active sprint
function subtskCalaulation(all_pie_data, active_sprints) {
  let response_data_obj;
  let all_pie_chart_data = [];
  if (all_pie_data.length > 0) {
    for (let i = 0; i < all_pie_data.length; i++) {
      const pie_chart_data = all_pie_data[i].values;

      let piedata = new Map();

      pie_chart_data.forEach((d) => {
        if (piedata.has(d.status_category_name)) {
          piedata.set(
            d.status_category_name,
            piedata.get(d.status_category_name) + d.issue_count
          );
        } else {
          piedata.set(d.status_category_name, d.issue_count);
        }
      });
      if (piedata.size === 0) {
        piedata.set("NO Subtask", 0);
      }
      const piedataObject = Object.fromEntries(piedata);
      all_pie_chart_data.push([piedataObject]); // Push arrays containing objects
    }
  }

  // Transforming all_pie_chart_data
  const responseObj = {};
  active_sprints.forEach((sprint, index) => {
    const sprintName = sprint.name;
    const pieData = all_pie_chart_data[index] || [];

    // Initialize board data
    const sprintData = {};

    // Accumulate counts for each status category
    pieData.forEach((data) => {
      Object.keys(data).forEach((status) => {
        if (sprintData[status]) {
          sprintData[status] += data[status];
        } else {
          sprintData[status] = data[status];
        }
      });
    });

    // Push the board data into the response object
    responseObj[sprintName] = Object.keys(sprintData).map((status) => ({
      [status]: sprintData[status],
    }));
  });
  response_data_obj = Object.fromEntries(Object.entries(responseObj).reverse());
  // activeSprints[sprint].sprints.push({"SubtaskData" :response_data_obj})
  // // conole.log([response_data_obj], "response_data_obj");
  return [response_data_obj];
}



app.post("/allboards/activesprints", async (req, res) => {
  try {
    const data = req.body;
    const all_boards = data;

    const activeSprints = [];
    const processedBoardIds = new Set(); // Maintain a set of processed board IDs

    // Function to process a single board
    const processBoard = async (board) => {
      const board_id = board.board_id;

      // Skip processing if the board ID has already been processed
      if (processedBoardIds.has(board_id)) {
        return;
      }

      // Mark the current board ID as processed
      processedBoardIds.add(board_id);

      const board_name = board.board_name;
      const board_type = board.board_type;
      const sprintsData = await getSprints(board_id);
      // const active_sprints = sprintsData?.values? sprintsData.values.filter((sprint) => sprint.state === "active"): [];

      const active_sprints = [
        sprintsData.values
          ?.filter((sprint) => sprint.state === "closed")
          .sort(
            (a, b) => new Date(b.completeDate) - new Date(a.completeDate)
          )[0],
        ...(sprintsData.values?.filter((sprint) => sprint.state === "active") ||
          []),
      ].filter(Boolean);

      if (active_sprints.length === 0) {
        return;
      }

      for (let j = 0; j < active_sprints.length; j++) {
        const sprintData = await getSprintIssues(active_sprints[j].id);
        const stories = sprintData.issues.filter(
          (issue) => issue.fields.issuetype.name === "Story"
        );

        const total_stories = stories.length;
        const done_stories = stories.filter(
          (issue) => issue.fields.status?.statusCategory?.name === "Done"
        ).length;
        const in_progress_stories = stories.filter(
          (issue) => issue.fields.status?.statusCategory?.name === "In Progress"
        ).length;

        activeSprints.push({
          board_id: board_id,
          board_name: board_name,
          board_type: board_type,
          sprint_id: active_sprints[j].id,
          sprint_name: active_sprints[j].name,
          sprint_status: active_sprints[j].state,
          sprint_start: active_sprints[j].startDate
            ? active_sprints[j].startDate
            : "No date added",
          sprint_end: active_sprints[j].endDate
            ? active_sprints[j].endDate
            : "No date added",
          total_stories: total_stories,
          done_stories: done_stories,
          in_progress_stories: in_progress_stories,
        });
      }
    };

    // Process all boards concurrently
    const promises = all_boards.map((board) => processBoard(board));
    await Promise.all(promises);

    res.json(activeSprints);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// // //

// Read data from JSON file
app.get("/fav/boards", async (req, res) => {
  try {
    const data = await fs.readFile("board.json", "utf8");
    res.json(JSON.parse(data));
    // // conole.log(JSON.parse(data));
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update data in JSON file
app.post("/add/favboard", async (req, res) => {
  try {
    const newBoard = req.body;

    // Check if the newBoard object is valid
    if (!newBoard || !newBoard.board_id) {
      return res
        .status(400)
        .json({ error: "Invalid request: Missing board_id" });
    }

    // Read existing data from file
    let existingData = await fs.readFile("board.json", "utf8");
    existingData = JSON.parse(existingData);

    // Check if the board already exists
    const index = existingData.findIndex(
      (item) => item.board_id === newBoard.board_id
    );
    if (index === -1) {
      // Board not found, add it
      existingData.push(newBoard);
      await fs.writeFile("board.json", JSON.stringify(existingData));
      return res.json({ message: "Board added to favorites" });
    } else {
      // Board already exists, return success message
      return res.json({ message: "Board already in favorites" });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Delete data from JSON file
app.delete("/delete/favboard/:board_id", async (req, res) => {
  try {
    let boardId = req.params.board_id;
    console.log(boardId);
    let existingData = await fs.readFile("board.json", "utf8");
    existingData = JSON.parse(existingData);

    // Filter out the board with the specified board_id
    let updatedData = existingData.filter((item) => item.board_id != boardId);
    // 161 != 162
    console.log(updatedData);
    // Check if any board was removed
    if (existingData.length !== updatedData.length) {
      // Write the updated data back to the file
      await fs.writeFile("board.json", JSON.stringify(updatedData));
      res.json(updatedData); // Send back the updated list of boards
    } else {
      res.status(404).json({ error: "Data not found" });
    }
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});


// get summary boards
app.get("/summary/activeboards", async (req, res) => {
  try {
    const data = await fs.readFile("summaryBoards.json", "utf8");
    res.json(JSON.parse(data));
    // // conole.log(JSON.parse(data));
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// add summary boards
app.post("/add/summaryboard", async (req, res) => {
  try {
    const newBoard = req.body;

    // Check if the newBoard object is valid
    if (!newBoard || !newBoard.board_id) {
      return res
        .status(400)
        .json({ error: "Invalid request: Missing board_id" });
    }

    // Read existing data from file
    let existingData = await fs.readFile("summaryBoards.json", "utf8");
    existingData = JSON.parse(existingData);

    // Check if the board already exists
    const index = existingData.findIndex(
      (item) => item.board_id === newBoard.board_id
    );
    if (index === -1) {
      // Board not found, add it
      existingData.push(newBoard);
      await fs.writeFile("summaryBoards.json", JSON.stringify(existingData));
      return res.json({ message: "Board added to favorites" });
    } else {
      // Board already exists, return success message
      return res.json({ message: "Board already in favorites" });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// remove summary board
app.delete("/delete/summary/:board_id", async (req, res) => {
  try {
    let boardId = req.params.board_id;
    console.log(boardId);
    let existingData = await fs.readFile("summaryBoards.json", "utf8");
    existingData = JSON.parse(existingData);

    // Filter out the board with the specified board_id
    let updatedData = existingData.filter((item) => item.board_id != boardId);
    // 161 != 162
    console.log(updatedData);
    // Check if any board was removed
    if (existingData.length !== updatedData.length) {
      // Write the updated data back to the file
      await fs.writeFile("summaryBoards.json", JSON.stringify(updatedData));
      res.json(updatedData); // Send back the updated list of boards
    } else {
      res.status(404).json({ error: "Data not found" });
    }
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Server running in port

function isTodayOrYesterday(dateStr) {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  return (
    date.toDateString() === today.toDateString() ||
    date.toDateString() === yesterday.toDateString()
  );
}

const formatDate = (dateStr) =>
  new Date(dateStr)
    .toLocaleString("sv-SE", { timeZone: "Asia/Kolkata", hour12: false })
    .replace(" ", "T") + dateStr.slice(-5).replace(":", "");

// get gitlogs data
app.post("/sprint/gitdata", async (req, res) => {
  try {
    const boards = req.body;
    // console.log(boards, "git....");
    const results = [];

    for (const board of boards) {
      // for (const sprint of board.sprints) {
      const board_id = board.board_id;
      const board_name = board.board_name;
      const sprint_id = board.sprint_id;
      const sprint_name = board.sprint_name;
      const sprint_status = board.sprint_status;
      const sprint_start = board.sprint_start;
      const sprint_end = board.sprint_end;
      const response = await getSprintIssues(sprint_id);

      const issues = [];

      // Filter and process issues
      for (let issue of response?.issues || []) {
        // if (isTodayOrYesterday(issue.fields.updated)) {
        if (issue.fields.updated) {
          const { fields } = issue;
          const {
            status,
            issuetype,
            project,
            customfield_10018,
            customfield_10156,
            timetracking,
            customfield_10003,
            customfield_10020,
            creator,
            assignee,
            duedate,
          } = fields;

          let story = {
            story_id: issue.id,
            story_name: fields.summary,
            story_type: issuetype.name,
            story_status: status.statusCategory.name,
            project_id: project.id,
            project_name: project.name,
            status_name: status.name,
            sprint_id: customfield_10018[0].id.toString(),
            sprint_name: customfield_10018[0].name,
            story_ac_hygiene: customfield_10156 ? "YES" : "NO",
            original_estimate: timetracking.originalEstimate || "Not added",
            remaining_estimate: timetracking.remainingEstimate || "Not added",
            time_spent: timetracking.timeSpent || "Not added",
            story_reviewers: customfield_10003
              ? customfield_10003.length !== 0
                ? customfield_10003.map((r) => r.displayName).join(", ")
                : "Reviewers not added"
              : "Reviewers not added",
            story_points: customfield_10020 == null ? 0 : customfield_10020,
            updated: fields.updated,
            creator: creator.displayName,
            assignee: assignee ? assignee.displayName : "Not added",
            duedate: duedate ? duedate : "Not added",
            sprint_start: customfield_10018[0].startDate
              ? customfield_10018[0].startDate.substring(0, 10)
              : "",
            sprint_end: customfield_10018[0].endDate
              ? customfield_10018[0].endDate.substring(0, 10)
              : "",
          };

          issues.push(story);
        }
      }

      // Fetch GitHub data for each story and construct the response
      const githubResponses = await Promise.all(
        issues.map(async (story) => {
          const githubCommits = await getGithubCommits(story.story_id);

          const commits =
            githubCommits?.detail?.flatMap((detail) =>
              detail.repositories.flatMap((repo) =>
                repo.commits.map((commit) => ({
                  assignee: story.assignee,
                  sprint_name: story.sprint_name,
                  sprint_id: story.sprint_id,
                  story_name: story.story_name,
                  story_id: story.story_id,
                  message: commit.message,
                  authorTimestamp: commit.authorTimestamp,
                  // authorTimestamp: formatDate(commit.authorTimestamp),
                  repositoryName: repo.name,
                  repositoryUrl: repo.url,
                  filesChanged: commit.files.length,
                  commitUrl: commit.url,
                }))
              )
            ) || [];
          return commits;
        })
      );

      // Flatten the array of arrays
      const flatCommits = githubResponses.flat();
      results.push({
        board_id,
        board_name,
        sprint_name,
        sprint_id,
        sprint_status,
        sprint_start,
        sprint_end,
        commits: flatCommits,
      });
      // }
    }

    res.json(results);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// LMS and L&D
app.post("/lms/LandD/tracking", async (req, res) => {
  try {
    const data = await lms_landd.create(req.body);
    res.status(200).json(data);
    console.log(req.body);
    res.send(req.body);
    // res.json(response);
  } catch (error) {
    console.error("Error fetching boards:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/lms/LandD/tracking", async (req, res) => {
  try {
    const data = await lms_landd.find({});
    res.status(200).json(data);
    console.log(req.body);
    // res.json(response);
  } catch (error) {
    console.error("Error fetching boards:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/lms/LandD/employeesdata", async (req, res) => {
  try {
    const data = await lms_landd_employees.create(req.body);
    res.status(200).json(data);
    console.log(req.body);
    res.send(req.body);
    // res.json(response);
  } catch (error) {
    console.error("Error fetching boards:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/lms/LandD/employeesdata", async (req, res) => {
  try {
    const data = await lms_landd_employees.find({});
    res.status(200).json(data);
    console.log(req.body);
    // res.json(response);
  } catch (error) {
    console.error("Error fetching boards:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/lms/LandD/login", async (req, res) => {
  try {
    const data = req.body;
    const employee = await findEmployeeByIdAndName(data);

    if (employee) {
      res.status(200).json(employee);
    } else {
      res.status(404).json({ error: "Employee not found" });
    }

    console.log(req.body);
  } catch (error) {
    console.error("Error fetching employee:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


//new route to post  course to particular employee
app.post("/lms/LandD/:employeeID/coursesvideolist", async (req, res) => {
  try {
    const { employeeID } = req.params;
    const courses = req.body; // Expecting an array of course objects

    const employee = await lms_landd_employees.findOne({ 'Employee ID': employeeID });

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Initialize CoursesAligned if it's undefined
    if (!employee.CoursesAligned) {
      employee.CoursesAligned = [];
    }

    const newCourses = [];

    // Iterate over the array and create each course
    for (const courseData of courses) {
      const newCourseData = { ...courseData, employee: employee._id };
      const newCourse = await getCourse.create(newCourseData);
      newCourses.push(newCourse);
      employee.CoursesAligned.push(newCourse._id);
    }

    await employee.save();

    res.status(200).json(newCourses);
  } catch (error) {
    console.error("Error adding courses:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// new route getting employee data with course reference

app.get("/lms/LandD/employee/:employeeID", async (req, res) => {
  try {
    const { employeeID } = req.params;

    // Find the employee by EmployeeID and populate the CoursesAligned field
    const employee = await lms_landd_employees.findOne({ 'Employee ID': employeeID }).populate('CoursesAligned');

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    res.status(200).json(employee);
  } catch (error) {
    console.error("Error fetching employee data:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// new api for updating course based on employee_id  and  course_id
app.put("/lms/LandD/:employeeID/coursesvideolist/:courseID", async (req, res) => {
  try {
    // console.log("Endpoint hit"); // Log to ensure the endpoint is hit

    const { employeeID, courseID } = req.params;
    const updateData = req.body;

    // console.log("Employee ID:", employeeID); // Log the employee ID
    // console.log("Course ID:", courseID); // Log the course ID

    // Ensure courseID is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(courseID)) {
      console.log("Invalid courseID");
      return res.status(400).json({ error: "Invalid courseID" });
    }

    // Find the employee by EmployeeID
    const employee = await lms_landd_employees.findOne({ 'Employee ID': employeeID }).populate('CoursesAligned');

    if (!employee) {
      console.log("Employee not found");
      return res.status(404).json({ error: "Employee not found" });
    }

    // console.log("Employee found:", employee);

    // Find the index of the course in the CoursesAligned array
    const course= employee.CoursesAligned.find(course => course._id.equals(courseID));

    if (!course) {
      console.log("Course not found");
      return res.status(404).json({ error: "Course not found" });
    }

    // console.log("Current course data:", course);

    // Update specific fields of the course
    for (const key in updateData) {
      if (updateData.hasOwnProperty(key)) {
        course[key] = updateData[key];
      }
    }


    // Save the updated employee document
    await course.save();

    // console.log("Updated course data:", course);

    // Send the updated course as the response
    res.status(200).json(course);
  } catch (error) {
    console.error("Error updating course:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});





app.get("/lms/LandD/coursesvideolist", async (req, res) => {
  try {
    const data = await getCourse.find({});
    res.status(200).json(data);
    console.log(req.body);
    // res.json(response);
  } catch (error) {
    console.error("Error fetching boards:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// courses for employee
app.get("/lms/LandD/:employeeID/coursesvideolist", async (req, res) => {
  try {
    const employeeID = req.params.employeeID;

    // Query the database directly using the employeeID
    const courses = await getCourse.find({ 'Employee ID': employeeID });

    res.status(200).json(courses);
  } catch (error) {
    console.error("Error fetching employee courses:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});





// get employee data with regex name............


app.get("/getprofile", async (req, res) => {
  const { name } = req.query;

  if (!name) {
    return res.status(400).json({ error: "Name query parameter is required" });
  }

  try {
    const regex = new RegExp(name, 'i'); // 'i' makes the regex case-insensitive
    const employeeData = await lms_landd_employees.find({
      $or: [
        { 'First Name': regex },
        { 'Last Name': regex }
      ]
    });

    res.status(200).json(employeeData);
  } catch (error) {
    console.error("Error fetching employee data:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});










app.listen(PORT, () => {
  // // conole.log(`Server running on port ${PORT}...`);
});
