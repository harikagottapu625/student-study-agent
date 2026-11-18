import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT_DIR = path.resolve(__dirname, '..', '..');
const DATA_DIR = path.join(PROJECT_ROOT_DIR, 'data');
const ROOT_DIR = PROJECT_ROOT_DIR;

const toSkillMap = (skillString = '') => {
  return skillString.split('|').filter(Boolean).reduce((acc, part) => {
    const [name, level] = part.split(':');
    if (!name) return acc;
    acc[name.trim()] = Number(level ?? 0);
    return acc;
  }, {});
};

const splitPipe = (value = '') => value.split('|').map((item) => item.trim()).filter(Boolean);

const toNumberSafe = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const titleFromId = (id = '') => {
  if (!id) return '';
  return String(id)
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

const readCsvFromCandidates = (fileName) => {
  const candidates = [
    path.join(DATA_DIR, fileName),
    path.join(ROOT_DIR, fileName),
  ];

  const fullPath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!fullPath) {
    throw new Error(`CSV file not found: ${fileName}`);
  }

  const raw = fs.readFileSync(fullPath, 'utf8');
  return parse(raw, { columns: true, skip_empty_lines: true, trim: true });
};

const parseRoleMatrix = (rows = []) => {
  if (!rows.length) return [];
  const firstRow = rows[0];
  const keys = Object.keys(firstRow);
  if (!keys.length || keys[0].toLowerCase() !== 'skill') return [];

  const roleNames = keys.slice(1);
  return roleNames.map((roleName) => {
    const requiredSkills = rows.reduce((acc, row) => {
      const skillName = row[keys[0]];
      if (!skillName) return acc;
      acc[skillName] = toNumberSafe(row[roleName]);
      return acc;
    }, {});

    return {
      id: roleName.toLowerCase().replace(/\s+/g, '-'),
      roleName,
      requiredSkills,
      preferredSkills: [],
      recommendedTools: [],
      domain: 'General',
      difficultyLevel: 'Medium',
      roleDescription: `${roleName} role derived from provided skill matrix.`,
    };
  });
};

const parseStudentMatrix = (rows = []) => {
  if (!rows.length) return [];
  const keys = Object.keys(rows[0]);
  // A "skills" column means one row per student with skills as "Python:3|SQL:3",
  // not a matrix with one column per skill.
  if (!keys.length || keys[0].toLowerCase() !== 'student_id' || keys.includes('skills')) return [];

  const skillColumns = keys.slice(1);
  return rows.map((row) => {
    const studentId = String(row.student_id ?? '').trim();
    const skills = skillColumns.reduce((acc, skill) => {
      acc[skill] = toNumberSafe(row[skill]);
      return acc;
    }, {});

    return {
      studentId,
      name: `Student ${studentId || ''}`.trim(),
      educationLevel: '',
      skills,
      completedCourses: [],
      projects: [],
      careerInterests: [],
    };
  });
};

export const getRoles = () => {
  const rows = readCsvFromCandidates('industry_skill_matrix.csv');

  const matrixRoles = parseRoleMatrix(rows);
  if (matrixRoles.length) return matrixRoles;

  return rows.map((row) => ({
    id: (row.role_name || row.role || '').toLowerCase().replace(/\s+/g, '-'),
    roleName: row.role_name || row.role || titleFromId(row.id),
    requiredSkills: toSkillMap(row.required_skills),
    preferredSkills: splitPipe(row.preferred_skills),
    recommendedTools: splitPipe(row.recommended_tools),
    domain: row.domain || 'General',
    difficultyLevel: row.difficulty_level || 'Medium',
    roleDescription: row.role_description || `${row.role_name || row.role || 'Role'} profile`,
  }));
};

export const getStudents = () => {
  const rows = readCsvFromCandidates('student_skill_profiles.csv');

  const matrixStudents = parseStudentMatrix(rows);
  if (matrixStudents.length) return matrixStudents;

  return rows.map((row) => ({
    studentId: String(row.student_id),
    name: row.name || `Student ${row.student_id}`,
    educationLevel: row.education_level || '',
    skills: toSkillMap(row.skills),
    completedCourses: splitPipe(row.completed_courses),
    projects: splitPipe(row.projects),
    careerInterests: splitPipe(row.career_interests),
  }));
};
