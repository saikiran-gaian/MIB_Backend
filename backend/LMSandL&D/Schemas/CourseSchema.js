const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ChapterSchema = new Schema({
  url: { type: String, required: true },
  name: { type: String, required: true },
  pausedTime: { type: Number, default: 0 },
  completed: { type: Boolean, default: false },
});

const CourseSchema = new Schema({
  employee: { type: Schema.Types.ObjectId, ref: 'Employees', required: true },
  banner: { type: String, required: true },
  chapter: { type: [ChapterSchema], required: true },
  demourl: { type: String, required: true },
  description: { type: String, required: true },
  free: { type: Boolean, default: false },
  id: { type: Number, required: true },
  name: { type: String, required: true },
  sourcecode: { type: String, required: true },
  tags: { type: [String], required: true },
  totalchapters: { type: Number, required: true },
  status: { type: Boolean, default: false },
  watchedChapters: { type: Number, default: 0 },
});

const Course = mongoose.model('Course', CourseSchema);

module.exports = Course;
