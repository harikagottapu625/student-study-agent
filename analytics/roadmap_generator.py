"""Optional Python utility for standalone roadmap generation."""


def generate_roadmap(missing_skills, weak_skills, recommended_skills):
    roadmap = []
    step = 1

    for item in missing_skills:
        roadmap.append(
            {
                "step": step,
                "title": f"Learn {item['skill']}",
                "learning_topics": [
                    f"Fundamentals of {item['skill']}",
                    f"Hands-on practice for {item['skill']}",
                    f"Reach required level {item['requiredLevel']}",
                ],
                "suggested_project": f"Mini project focused on {item['skill']}",
            }
        )
        step += 1

    for item in weak_skills:
        roadmap.append(
            {
                "step": step,
                "title": f"Strengthen {item['skill']}",
                "learning_topics": [
                    f"Intermediate concepts in {item['skill']}",
                    "Role-oriented exercises",
                    f"Close gap of {item['gap']} level(s)",
                ],
                "suggested_project": f"Improve existing project with {item['skill']}",
            }
        )
        step += 1

    if recommended_skills:
        roadmap.append(
            {
                "step": step,
                "title": "Advance with preferred skills",
                "learning_topics": recommended_skills,
                "suggested_project": "Capstone project using multiple preferred skills",
            }
        )

    return roadmap


if __name__ == "__main__":
    sample_missing = [{"skill": "Deep Learning", "requiredLevel": 4}]
    sample_weak = [{"skill": "Statistics", "gap": 2}]
    sample_recommended = ["NLP", "MLOps"]
    print(generate_roadmap(sample_missing, sample_weak, sample_recommended))
