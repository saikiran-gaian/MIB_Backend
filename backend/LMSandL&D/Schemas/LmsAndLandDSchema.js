const mongoose = require('mongoose');

const employeeLDSchema =  new mongoose.Schema({
    employees: [{
      'Employee ID': {
        type: String,
        required: true,
        description: "Unique identifier for the employee"
      },
      name: {
        type: String,
        required: true,
        description: "Full name of the employee"
      },
      department: {
        type: String,
        required: true,
        description: "Department the employee belongs to"
      },
      courses: [{
        courseId: {
          type: String,
          required: true,
          description: "Unique identifier for the course"
        },
        courseName: {
          type: String,
          required: true,
          description: "Name of the course"
        },
        completionStatus: {
          type: String,
          required: true,
          enum: ["Not Started", "In Progress", "Completed"],
          description: "Status of course completion"
        },
        startDateTime: {
          type: Date,
          description: "Date and time when the course was started in ISO 8601 format"
        },
        completionDateTime: {
          type: Date,
          description: "Date and time when the course was completed in ISO 8601 format"
        },
        score: {
          type: Number,
          description: "Score obtained in the course assessment"
        },
        timeSpent: {
          type: String,
          required: true,
          description: "Time spent on the course (in HH:MM:SS format)"
        },
        feedback: {
          type: String,
          description: "Feedback provided by the employee for the course"
        }
      }]
    }]
  }, { timestamps: true });

const courseTracking = mongoose.model('courseTracking', employeeLDSchema);

module.exports = courseTracking;
