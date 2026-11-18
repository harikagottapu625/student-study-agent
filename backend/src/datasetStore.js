import mongoose from 'mongoose';
import { getRoles, getStudents } from './dataLoader.js';

// Industry roles and sample student profiles. The CSV files in data/ seed
// MongoDB on startup; once seeded the database is the source of truth, and the
// CSV files remain the fallback when MongoDB is not connected.

const RoleSchema = new mongoose.Schema(
  {
    roleId: { type: String, required: true, unique: true },
    roleName: { type: String, required: true },
    requiredSkills: { type: mongoose.Schema.Types.Mixed, default: {} },
    preferredSkills: { type: [String], default: [] },
    recommendedTools: { type: [String], default: [] },
    domain: { type: String, default: 'General' },
    difficultyLevel: { type: String, default: 'Medium' },
    roleDescription: { type: String, default: '' },
  },
  { timestamps: true, minimize: false },
);

const SampleStudentSchema = new mongoose.Schema(
  {
    studentId: { type: String, required: true, unique: true },
    name: { type: String, default: '' },
    educationLevel: { type: String, default: '' },
    skills: { type: mongoose.Schema.Types.Mixed, default: {} },
    completedCourses: { type: [String], default: [] },
    projects: { type: [String], default: [] },
    careerInterests: { type: [String], default: [] },
  },
  { timestamps: true, minimize: false },
);

export const IndustryRole = mongoose.models.IndustryRole || mongoose.model('IndustryRole', RoleSchema);
export const SampleStudent = mongoose.models.SampleStudent || mongoose.model('SampleStudent', SampleStudentSchema);

const isMongoReady = () => mongoose.connection.readyState === 1;

// Inserts CSV rows that are not in the database yet; existing records are left untouched.
const seedMissing = async (Model, key, rows) => {
  if (!rows.length) return 0;
  const result = await Model.bulkWrite(
    rows.map((row) => ({ updateOne: { filter: { [key]: row[key] }, update: { $setOnInsert: row }, upsert: true } })),
    { ordered: false },
  );
  return result.upsertedCount || 0;
};

// Sample students are not edited in the app, so the CSV always wins. This also
// repairs records saved before the loader read the CSV correctly.
const syncSamples = async (Model, key, rows) => {
  if (!rows.length) return 0;
  const result = await Model.bulkWrite(
    rows.map((row) => ({ updateOne: { filter: { [key]: row[key] }, update: { $set: row }, upsert: true } })),
    { ordered: false },
  );
  return result.upsertedCount || 0;
};

export const seedDatasets = async () => {
  if (!isMongoReady()) return { roles: 0, students: 0 };
  const roles = getRoles().map(({ id, ...role }) => ({ roleId: id, ...role }));
  const students = getStudents();
  return {
    roles: await seedMissing(IndustryRole, 'roleId', roles),
    students: await syncSamples(SampleStudent, 'studentId', students),
  };
};

const withoutMeta = ({ _id, __v, createdAt, updatedAt, ...record }) => record;

export const getRoleCatalog = async () => {
  if (isMongoReady()) {
    const roles = await IndustryRole.find({}).sort({ roleName: 1 }).lean();
    if (roles.length) return roles.map((role) => {
      const { roleId, ...rest } = withoutMeta(role);
      return { id: roleId, ...rest };
    });
  }
  return getRoles();
};

export const getStudentCatalog = async () => {
  if (isMongoReady()) {
    const students = await SampleStudent.find({}).sort({ studentId: 1 }).lean();
    if (students.length) return students.map(withoutMeta);
  }
  return getStudents();
};
