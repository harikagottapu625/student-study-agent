const buildRoadmapStep = (step, title, topics, project) => ({
  step,
  title,
  learningTopics: topics,
  suggestedProject: project,
});

export const generateRoadmap = ({ missingSkills, weakSkills, recommendedSkills }) => {
  const roadmap = [];
  let step = 1;

  for (const item of missingSkills) {
    roadmap.push(
      buildRoadmapStep(
        step++,
        `Learn ${item.skill}`,
        [`Understand ${item.skill} fundamentals`, `Practice ${item.skill} exercises`, `Reach level ${item.requiredLevel}`],
        `Build a mini project focused on ${item.skill}`,
      ),
    );
  }

  for (const item of weakSkills) {
    roadmap.push(
      buildRoadmapStep(
        step++,
        `Strengthen ${item.skill}`,
        [`Review intermediate ${item.skill}`, `Solve role-specific problems`, `Close ${item.gap}-level gap`],
        `Upgrade an existing project using ${item.skill}`,
      ),
    );
  }

  if (recommendedSkills.length) {
    roadmap.push(
      buildRoadmapStep(
        step,
        'Advance with preferred skills',
        recommendedSkills,
        'Create a capstone project integrating 2-3 preferred skills',
      ),
    );
  }

  return roadmap;
};
