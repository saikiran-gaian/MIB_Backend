const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Define the schema for aligned courses
const alignedCourseSchema = new mongoose.Schema({
  CourseID: {
    type: String,
    required: true,
  },
  Title: {
    type: String,
    required: true,
  },
  Category: {
    type: String,
    required: true,
  },
  TotalLessons: {
    type: Number, // Use Number type
    required: true,
    validate: {
      validator: Number.isInteger, // Validate if it's an integer
      message: "{VALUE} is not an integer value for TotalLessons",
    },
  },
});

// Define the schema for in-progress courses
const inProgressCourseSchema = new mongoose.Schema({
  CourseID: {
    type: String,
    required: true,
  },
  Title: {
    type: String,
    required: true,
  },
  StartDate: {
    type: Date,
    required: true,
  },
  InProgressLessons: {
    type: Number, // Use Number type
    required: true,
    validate: {
      validator: Number.isInteger, // Validate if it's an integer
      message: "{VALUE} is not an integer value for InProgressLessons",
    },
  },
});

// Define the schema for completed courses
const completedCourseSchema = new mongoose.Schema({
  CourseID: {
    type: String,
    required: true,
  },
  Title: {
    type: String,
    required: true,
  },
  CompletionDate: {
    type: Date,
    required: true,
  },
  CertificationID: {
    type: String,
    required: true,
  },
  CompletedLessons: {
    type: Number, // Use Number type
    required: true,
    validate: {
      validator: Number.isInteger, // Validate if it's an integer
      message: "{VALUE} is not an integer value for CompletedLessons",
    },
  },
});

// Define the main employee schema
// const employeeSchema = new mongoose.Schema(
//   {
//     EmployeeID: {
//       type: String,
//       required: true,
//     },
//     Name: {
//       type: String,
//       required: true,
//     },
//     Email: {
//       type: String,
//       required: true,
//     },
//     Team: {
//       type: String,
//       required: true,
//     },
//     CoursesAligned: [{ type: Schema.Types.ObjectId, ref: 'Course' }],
//     CoursesInProgress: [inProgressCourseSchema],
//     CoursesCompleted: [completedCourseSchema],
//   },
//   { timestamps: true }
// );


const employeeSchema = new Schema({
  'Employee ID': { type: String, required: true, unique: true },
  'First Name': { type: String, required: true },
  'Last Name': { type: String, required: true },
  'Nick Name': { type: String, default: "" },
  'Email address': { type: String, required: true, unique: true },
  'Photo': { type: String, default: "" },
  'Department': { type: String, default: "" },
  'Location': { type: String, default: "" },
  'Designation': { type: String, default: "" },
  'Zoho Role': { type: String, default: "Team member" },
  'Employment Type': { type: String, default: "Permanent" },
  'Employee Status': { type: String, default: "Active" },
  'Source of Hire': { type: String, default: "" },
  'Date of Joining': { type: Date, required: true },
  'Reporting Manager': { type: String, default: "" },
  'Date of Birth': { type: Date, default: null },
  'Marital Status': { type: String, default: "Single" },
  'About Me': { type: String, default: "" },
  'Ask me about/Expertise': { type: String, default: "" },
  'Work Phone Number': { type: String, default: "" },
  'Extension': { type: String, default: "" },
  'Seating Location': { type: String, default: "" },
  'Tags': { type: String, default: "" },
  'Personal Mobile Number': { type: String, required: true },
  'Personal Email Address': { type: String, default: "" },
  'Added By': { type: String, required: true },
  'Added Time': { type: Date, required: true },
  'Modified By': { type: String, required: true },
  'Modified Time': { type: Date, required: true }
});






// Create the model from the schema
const Employees = mongoose.model("zohouser", employeeSchema);

module.exports = Employees;
