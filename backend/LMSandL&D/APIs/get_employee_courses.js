const Courses = require("../Schemas/CourseSchema");

async function getEmployeeCourses(data) {
  try {
    const employee = await Courses.findOne({
      'Employee ID': data.EmployeeID,
    });
    console.log(employee);
    return employee;
  } catch (error) {
    console.error("Error finding employee:", error);
    throw error;
  }
}

module.exports = getEmployeeCourses;
