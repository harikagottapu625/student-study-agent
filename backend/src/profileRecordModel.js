import mongoose from 'mongoose';

const ProfileRecordSchema = new mongoose.Schema(
  {
    studentId: { type: String, default: '' },
    studentName: { type: String, default: '' },
    email: { type: String, default: '' },
    targetRole: { type: String, default: '' },
    studentSkills: { type: mongoose.Schema.Types.Mixed, default: {} },
    careerInterests: { type: [String], default: [] },
    completedCourses: { type: [String], default: [] },
    projects: { type: [String], default: [] },
    resumeFileName: { type: String, default: '' },
    resumeText: { type: String, default: '' },
  },
  {
    timestamps: true,
  },
);

export const ProfileRecord = mongoose.model('ProfileRecord', ProfileRecordSchema);
