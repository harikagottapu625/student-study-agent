export const analyzeSkillGap = ({ role, student }) => {
  const requiredEntries = Object.entries(role.requiredSkills);
  const matched = [];
  const missingSkills = [];
  const weakSkills = [];
  let coverageTotal = 0;

  for (const [skill, requiredLevel] of requiredEntries) {
    const studentLevel = Number(student.skills?.[skill] ?? 0);
    const required = Number(requiredLevel || 0);
    const normalizedCoverage = required > 0 ? Math.min(studentLevel, required) / required : 1;
    coverageTotal += normalizedCoverage;

    if (studentLevel > 0) {
      matched.push(skill);
      if (studentLevel < requiredLevel) {
        weakSkills.push({ skill, studentLevel, requiredLevel, gap: requiredLevel - studentLevel });
      }
    } else {
      missingSkills.push({ skill, requiredLevel });
    }
  }

  const readinessScore = requiredEntries.length
    ? Math.round((coverageTotal / requiredEntries.length) * 100)
    : 0;

  const recommendedSkills = role.preferredSkills.filter((skill) => !student.skills?.[skill]);

  const skillScores = requiredEntries.map(([skill, requiredLevel]) => ({
    skill,
    requiredLevel,
    studentLevel: Number(student.skills?.[skill] ?? 0),
  }));

  return {
    roleName: role.roleName,
    studentId: student.studentId,
    studentName: student.name,
    readinessScore,
    matchedSkills: matched,
    missingSkills,
    weakSkills,
    recommendedSkills,
    skillScores,
  };
};
