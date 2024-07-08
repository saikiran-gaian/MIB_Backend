const Employees = require("../Schemas/EmployeeSchemaLMS");

async function findEmployeeByIdAndName(data) {
  try {
    const employee = await Employees.findOne({
      'Employee ID': data.EmployeeID,
      Name: data.Name
    });
    console.log(employee);
    return employee;
  } catch (error) {
    console.error("Error finding employee:", error);
    throw error;
  }
}

module.exports = findEmployeeByIdAndName;
