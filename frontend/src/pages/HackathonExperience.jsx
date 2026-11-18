import { useEffect, useMemo, useState } from 'react';
import NotesSummarizer from './NotesSummarizer.jsx';
import StudyPlanner from './StudyPlanner.jsx';
import AssignmentTracker from './AssignmentTracker.jsx';
import RetrievalHelper from './RetrievalHelper.jsx';
import AgentHub from './AgentHub.jsx';
import ConceptTutor from './ConceptTutor.jsx';
import QuizAgent from './QuizAgent.jsx';
import HomeLanding from './HomeLanding.jsx';
import CareerGoal from './CareerGoal.jsx';
import { setStudyUser, studyApi } from '../utils/studyApi.js';
import {
  AlertTriangle,
  Award,
  BarChart3,
  ChevronDown,
  CheckCircle2,
  BookOpen,
  Bot,
  Brain,
  CalendarDays,
  FileSearch,
  Briefcase,
  Code,
  Compass,
  Cpu,
  FileText,
  FolderGit2,
  Heart,
  House,
  Layers,
  Lightbulb,
  LogIn,
  Mail,
  Menu,
  Radar,
  Route,
  Sparkles,
  TrendingUp,
  Upload,
  User,
  X,
  Zap,
  Cloud,
  Coffee,
  Database,
  Terminal,
  Workflow,
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const studyPages = ['home', 'agent', 'planner', 'notes', 'assignments', 'retrieval', 'tutor', 'quiz'];
const careerPages = ['goal', 'profile', 'roles', 'analysis', 'roadmap', 'dashboard'];
const pages = [...studyPages, ...careerPages];
const mobileTabs = [['home', House], ['agent', Bot], ['planner', CalendarDays], ['notes', FileText]];
const pageLabels = {
  home: 'Home',
  agent: 'Hub',
  planner: 'Planner',
  notes: 'Notes',
  assignments: 'Deadlines',
  retrieval: 'Helper',
  tutor: 'Tutor',
  quiz: 'Quiz',
  goal: 'Career Goal',
  profile: 'Profile',
  roles: 'Roles',
  analysis: 'Analysis',
  roadmap: 'Roadmap',
  dashboard: 'Dashboard',
};
const hashRoutes = [...pages, 'roadmap-player'];

const ROADMAP_PLAYER_STORAGE_KEY = 'study-agent-roadmap-player';
const LEGACY_ROADMAP_PLAYER_STORAGE_KEY = 'skillgap-roadmap-player';

const roleCards = [
  {
    name: 'Data Scientist',
    subtitle: 'Extract insights from complex data',
    icon: BarChart3,
    salary: '$120K - $180K',
    demand: 'Very High Demand',
    demandTone: 'text-purple-300',
    growth: '+36% Growth',
    description: 'Analyze complex data, build predictive models, and drive business decisions.',
    skills: ['Python', 'Machine Learning', 'SQL', 'Statistics', 'Data Visualization', 'Experiment Design'],
    tools: ['TensorFlow', 'Pandas', 'Scikit-learn', 'Jupyter'],
  },
  {
    name: 'AI Engineer',
    subtitle: 'Build intelligent systems and models',
    icon: Brain,
    salary: '$130K - $200K',
    demand: 'Critical Demand',
    demandTone: 'text-rose-300',
    growth: '+48% Growth',
    description: 'Design, optimize, and deploy AI systems for production use-cases.',
    skills: ['Python', 'Machine Learning', 'Deep Learning', 'TensorFlow', 'MLOps', 'NLP'],
    tools: ['PyTorch', 'Transformers', 'AWS/GCP', 'Docker'],
  },
  {
    name: 'Software Developer',
    displayName: 'Full Stack Developer',
    subtitle: 'Create robust applications and systems',
    icon: Code,
    salary: '$100K - $160K',
    demand: 'Very High Demand',
    demandTone: 'text-purple-300',
    growth: '+22% Growth',
    description: 'Develop frontend and backend components for scalable web applications.',
    skills: ['JavaScript', 'React', 'Node.js', 'MongoDB', 'System Design', 'Testing'],
    tools: ['VS Code', 'MongoDB', 'REST APIs', 'CI/CD'],
  },
  {
    name: 'IoT Engineer',
    subtitle: 'Connect devices and build smart systems',
    icon: Cpu,
    salary: '$105K - $155K',
    demand: 'High Demand',
    demandTone: 'text-cyan-300',
    growth: '+27% Growth',
    description: 'Build connected device solutions across edge, firmware, and cloud.',
    skills: ['Embedded C', 'Python', 'MQTT', 'Networking', 'Cloud Integration', 'Device Security'],
    tools: ['Arduino', 'Raspberry Pi', 'AWS IoT', 'Sensors'],
  },
  {
    name: 'Python Developer',
    subtitle: 'Build back-end services and automation in Python',
    icon: Terminal,
    salary: '$95K - $150K',
    demand: 'Very High Demand',
    demandTone: 'text-purple-300',
    growth: '+25% Growth',
    description: 'Write clean Python for web back-ends, APIs, automation scripts and data tools.',
    skills: ['Python', 'Django / FastAPI', 'REST APIs', 'SQL', 'Git', 'Testing'],
    tools: ['VS Code', 'PyCharm', 'Postman', 'Docker'],
  },
  {
    name: 'Java Developer',
    subtitle: 'Build enterprise applications with Java',
    icon: Coffee,
    salary: '$95K - $155K',
    demand: 'High Demand',
    demandTone: 'text-cyan-300',
    growth: '+21% Growth',
    description: 'Build enterprise back-end services, banking systems and large-scale platforms in Java and Spring Boot.',
    skills: ['Java', 'OOP', 'Spring Boot', 'SQL', 'Data Structures', 'Microservices'],
    tools: ['IntelliJ IDEA', 'Maven', 'Spring Boot', 'JUnit'],
  },
  {
    name: 'Machine Learning Engineer',
    subtitle: 'Train and deploy machine learning models',
    icon: Workflow,
    salary: '$125K - $190K',
    demand: 'Very High Demand',
    demandTone: 'text-purple-300',
    growth: '+40% Growth',
    description: 'Turn data into trained models and run them reliably in production with MLOps.',
    skills: ['Python', 'Machine Learning', 'Statistics', 'Deep Learning', 'MLOps', 'SQL'],
    tools: ['Scikit-learn', 'PyTorch', 'MLflow', 'Docker'],
  },
  {
    name: 'Cloud Engineer',
    subtitle: 'Design and run scalable cloud infrastructure',
    icon: Cloud,
    salary: '$110K - $170K',
    demand: 'Very High Demand',
    demandTone: 'text-purple-300',
    growth: '+30% Growth',
    description: 'Design, deploy and operate secure, scalable infrastructure on AWS, Azure or Google Cloud.',
    skills: ['Cloud Platforms', 'Linux', 'Networking', 'Docker', 'Kubernetes', 'Terraform'],
    tools: ['AWS', 'Azure', 'Terraform', 'Kubernetes'],
  },
  {
    name: 'SQL Developer',
    subtitle: 'Design databases and write efficient queries',
    icon: Database,
    salary: '$85K - $135K',
    demand: 'High Demand',
    demandTone: 'text-cyan-300',
    growth: '+18% Growth',
    description: 'Design databases, write fast SQL and build the data layer behind applications and reports.',
    skills: ['SQL', 'Database Design', 'Query Optimization', 'Stored Procedures', 'Data Modeling', 'ETL'],
    tools: ['MySQL', 'PostgreSQL', 'SQL Server', 'Power BI'],
  },
];

const roleRoadmaps = {
  'Data Scientist': [
    {
      phase: 'Phase 1: Foundation',
      title: 'Build Python and Data Fundamentals',
      topics: 'Python Basics, NumPy, Pandas, data cleaning workflows',
      duration: '3-4 weeks',
      outcomes: ['Write clean Python for analysis', 'Prepare datasets for modeling', 'Publish one notebook portfolio item'],
      courses: ['Python for Everybody', 'Pandas for Data Analysis'],
      projects: ['Student Performance Dashboard', 'Exploratory Data Analysis on Job Trends'],
      platforms: ['Kaggle', 'Coursera', 'DataCamp'],
      resources: [
        { label: 'Pandas Getting Started', url: 'https://pandas.pydata.org/docs/getting_started/index.html' },
        { label: 'Kaggle Learn: Python', url: 'https://www.kaggle.com/learn/python' },
      ],
    },
    {
      phase: 'Phase 2: Core Analytics',
      title: 'Master Statistics and SQL',
      topics: 'Probability, hypothesis testing, SQL querying, data storytelling',
      duration: '3-5 weeks',
      outcomes: ['Validate hypotheses with confidence', 'Build KPI queries', 'Present visual insights clearly'],
      courses: ['Statistics for Data Science', 'SQL for Data Analytics'],
      projects: ['A/B Test Evaluation Case Study', 'Sales KPI SQL Analyzer'],
      platforms: ['Mode SQL', 'LeetCode SQL', 'Khan Academy'],
      resources: [
        { label: 'Mode SQL Tutorial', url: 'https://mode.com/sql-tutorial/' },
        { label: 'Khan Academy Statistics', url: 'https://www.khanacademy.org/math/statistics-probability' },
      ],
    },
    {
      phase: 'Phase 3: Modeling',
      title: 'Apply Machine Learning Models',
      topics: 'Supervised learning, model evaluation, feature engineering',
      duration: '4-6 weeks',
      outcomes: ['Train baseline and tuned models', 'Evaluate with precision and recall', 'Document model assumptions'],
      courses: ['Machine Learning by Andrew Ng', 'Applied ML with Scikit-learn'],
      projects: ['Customer Churn Prediction', 'Loan Risk Classification'],
      platforms: ['Coursera', 'Kaggle Competitions', 'Google Colab'],
      resources: [
        { label: 'Scikit-learn User Guide', url: 'https://scikit-learn.org/stable/user_guide.html' },
        { label: 'Google Colab', url: 'https://colab.research.google.com/' },
      ],
    },
    {
      phase: 'Phase 4: Advanced AI',
      title: 'Advance with Deep Learning and Deployment',
      topics: 'Neural networks, TensorFlow/PyTorch, model serving and monitoring',
      duration: '4-6 weeks',
      outcomes: ['Deploy one model API', 'Monitor drift and performance', 'Ship end-to-end capstone'],
      courses: ['Deep Learning Specialization', 'MLOps Fundamentals'],
      projects: ['Image Classification Pipeline', 'Model API Deployment on Cloud'],
      platforms: ['Hugging Face', 'Weights & Biases', 'Render'],
      resources: [
        { label: 'Hugging Face Course', url: 'https://huggingface.co/learn' },
        { label: 'TensorFlow Tutorials', url: 'https://www.tensorflow.org/tutorials' },
      ],
    },
  ],
  'AI Engineer': [
    {
      phase: 'Phase 1: Engineering Basics',
      title: 'Strengthen Python and Problem Solving',
      topics: 'Python OOP, data structures, algorithm patterns, clean coding',
      duration: '3-4 weeks',
      outcomes: ['Write modular Python', 'Solve medium DSA patterns', 'Refactor for readability'],
      courses: ['Python OOP Masterclass', 'DSA for Interviews'],
      projects: ['Prompt Utility CLI', 'Data Structure Visualizer'],
      platforms: ['LeetCode', 'Exercism', 'Real Python'],
      resources: [
        { label: 'Real Python Learning Paths', url: 'https://realpython.com/learning-paths/' },
        { label: 'LeetCode', url: 'https://leetcode.com/' },
      ],
      videos: [
        { title: 'Python for Data Science - Full Course', url: 'https://www.youtube.com/watch?v=LHBE6Q9XlzI' },
        { title: 'Data Structures and Algorithms in Python', url: 'https://www.youtube.com/watch?v=pkYVOmU3MgA' },
      ],
    },
    {
      phase: 'Phase 2: Deep Learning Core',
      title: 'Build Neural Network Expertise',
      topics: 'CNN, RNN, attention mechanisms, training optimization',
      duration: '4-5 weeks',
      outcomes: ['Build and train DL models', 'Tune training pipelines', 'Compare model architectures'],
      courses: ['Practical Deep Learning for Coders', 'Neural Networks and Deep Learning'],
      projects: ['Plant Disease Image Classifier', 'Sequence Forecasting Model'],
      platforms: ['Fast.ai', 'Papers with Code', 'Kaggle'],
      resources: [
        { label: 'Fast.ai', url: 'https://course.fast.ai/' },
        { label: 'Papers with Code', url: 'https://paperswithcode.com/' },
      ],
      videos: [
        { title: 'Neural Networks Explained', url: 'https://www.youtube.com/watch?v=aircAruvnKk' },
        { title: 'Machine Learning for Beginners', url: 'https://www.youtube.com/watch?v=NWONeJKn6kc' },
      ],
    },
    {
      phase: 'Phase 3: Applied GenAI',
      title: 'Deliver NLP and Vision Applications',
      topics: 'Transformers, embeddings, retrieval, evaluation frameworks',
      duration: '4-6 weeks',
      outcomes: ['Build one RAG app', 'Evaluate hallucinations', 'Ship NLP/vision demo'],
      courses: ['Transformers for NLP', 'Computer Vision with PyTorch'],
      projects: ['RAG Assistant for Resume QnA', 'Multimodal Document Parser'],
      platforms: ['Hugging Face', 'LangChain', 'Weights & Biases'],
      resources: [
        { label: 'LangChain Docs', url: 'https://python.langchain.com/docs/introduction/' },
        { label: 'Weights & Biases', url: 'https://wandb.ai/site' },
      ],
      videos: [
        { title: 'Scikit-learn Crash Course', url: 'https://www.youtube.com/watch?v=0Lt9w-BxKFQ' },
        { title: 'Machine Learning for Beginners', url: 'https://www.youtube.com/watch?v=NWONeJKn6kc' },
      ],
    },
    {
      phase: 'Phase 4: Production AI',
      title: 'Learn MLOps and Model Deployment',
      topics: 'Docker, CI/CD, inference APIs, observability, cost optimization',
      duration: '4-6 weeks',
      outcomes: ['Deploy scalable inference API', 'Automate CI/CD for models', 'Track quality in production'],
      courses: ['MLOps Zoomcamp', 'Deploying AI Models on Cloud'],
      projects: ['Model Registry + CI Pipeline', 'Scalable Inference API'],
      platforms: ['Docker Hub', 'GitHub Actions', 'Railway'],
      resources: [
        { label: 'MLOps Zoomcamp', url: 'https://github.com/DataTalksClub/mlops-zoomcamp' },
        { label: 'Docker Docs', url: 'https://docs.docker.com/' },
      ],
      videos: [
        { title: 'Neural Networks Explained', url: 'https://www.youtube.com/watch?v=aircAruvnKk' },
        { title: 'Machine Learning for Beginners', url: 'https://www.youtube.com/watch?v=NWONeJKn6kc' },
      ],
    },
  ],
  'Software Developer': [
    {
      phase: 'Phase 1: Coding Core',
      title: 'Master JavaScript/TypeScript and DSA',
      topics: 'Language fundamentals, async patterns, algorithmic thinking',
      duration: '3-4 weeks',
      outcomes: ['Write modern JS/TS', 'Solve core DSA patterns', 'Debug confidently'],
      courses: ['JavaScript: The Advanced Concepts', 'TypeScript Essentials'],
      projects: ['Algorithm Practice Toolkit', 'Task Scheduler App'],
      platforms: ['Frontend Mentor', 'LeetCode', 'freeCodeCamp'],
      resources: [
        { label: 'TypeScript Handbook', url: 'https://www.typescriptlang.org/docs/' },
        { label: 'MDN JavaScript Guide', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide' },
      ],
    },
    {
      phase: 'Phase 2: Full-Stack Build',
      title: 'Develop Frontend and Backend Systems',
      topics: 'React architecture, Node.js APIs, authentication and routing',
      duration: '4-5 weeks',
      outcomes: ['Build secure full-stack app', 'Implement auth flows', 'Design clean API contracts'],
      courses: ['React Complete Guide', 'Node.js API Development'],
      projects: ['Role-based Skill Tracker', 'Portfolio CMS Platform'],
      platforms: ['Vercel', 'Render', 'Postman'],
      resources: [
        { label: 'React Docs', url: 'https://react.dev/learn' },
        { label: 'Express Docs', url: 'https://expressjs.com/' },
      ],
    },
    {
      phase: 'Phase 3: Scalable Data',
      title: 'Apply Databases and System Design',
      topics: 'SQL/NoSQL modeling, caching, scalability and reliability patterns',
      duration: '4-6 weeks',
      outcomes: ['Model relational and document data', 'Plan API scale strategy', 'Optimize latency bottlenecks'],
      courses: ['System Design Fundamentals', 'Database Design Deep Dive'],
      projects: ['High-Traffic URL Shortener', 'Event-driven Notification Service'],
      platforms: ['MongoDB University', 'NeetCode', 'Redis University'],
      resources: [
        { label: 'MongoDB University', url: 'https://learn.mongodb.com/' },
        { label: 'System Design Primer', url: 'https://github.com/donnemartin/system-design-primer' },
      ],
    },
    {
      phase: 'Phase 4: Production Excellence',
      title: 'Ship with Testing and DevOps',
      topics: 'Unit/integration tests, CI/CD, monitoring, release management',
      duration: '3-5 weeks',
      outcomes: ['Add test coverage gates', 'Build deployment pipeline', 'Monitor app health'],
      courses: ['Testing JavaScript Applications', 'CI/CD for Developers'],
      projects: ['Automated Release Pipeline', 'Observability for Microservice Demo'],
      platforms: ['GitHub Actions', 'Sentry', 'Grafana Cloud'],
      resources: [
        { label: 'Jest Docs', url: 'https://jestjs.io/docs/getting-started' },
        { label: 'GitHub Actions Docs', url: 'https://docs.github.com/en/actions' },
      ],
    },
  ],
  'IoT Engineer': [
    {
      phase: 'Phase 1: Hardware Base',
      title: 'Learn Embedded and Electronics Basics',
      topics: 'Sensors, microcontrollers, breadboarding, signal fundamentals',
      duration: '3-4 weeks',
      outcomes: ['Assemble basic circuits', 'Read sensor values reliably', 'Document wiring and tests'],
      courses: ['Embedded Systems Essentials', 'Electronics for Engineers'],
      projects: ['Smart Temperature Monitor', 'Motion Detection Alert System'],
      platforms: ['Arduino IDE', 'Tinkercad', 'Wokwi'],
      resources: [
        { label: 'Wokwi IoT Simulator', url: 'https://wokwi.com/' },
        { label: 'Arduino Docs', url: 'https://docs.arduino.cc/' },
      ],
      videos: [
        { title: 'Embedded Systems Essentials Basics', url: 'https://www.youtube.com/watch?v=D7L1SmjQ3fo' },
        { title: 'Scikit-learn Crash Course', url: 'https://www.youtube.com/watch?v=0Lt9w-BxKFQ' },
      ],
    },
    {
      phase: 'Phase 2: Device Programming',
      title: 'Program and Connect IoT Devices',
      topics: 'C/C++, Python scripting, serial communication, firmware patterns',
      duration: '4-5 weeks',
      outcomes: ['Write firmware loops', 'Collect and validate telemetry', 'Automate device setup scripts'],
      courses: ['Programming with Arduino', 'Raspberry Pi in Practice'],
      projects: ['Home Automation Controller', 'Soil Moisture Smart Irrigation'],
      platforms: ['PlatformIO', 'Raspberry Pi Imager', 'Hackster.io'],
      resources: [
        { label: 'PlatformIO Docs', url: 'https://docs.platformio.org/' },
        { label: 'Raspberry Pi Documentation', url: 'https://www.raspberrypi.com/documentation/' },
      ],
      videos: [
        { title: 'Python for Data Science - Full Course', url: 'https://www.youtube.com/watch?v=LHBE6Q9XlzI' },
        { title: 'Node.js Full Course', url: 'https://www.youtube.com/watch?v=Oe421EPjeBE' },
      ],
    },
    {
      phase: 'Phase 3: Protocols and Streaming',
      title: 'Build Secure Device-to-Cloud Data Pipelines',
      topics: 'MQTT, HTTP, edge buffering, telemetry ingestion and validation',
      duration: '4-6 weeks',
      outcomes: ['Transmit secure MQTT events', 'Buffer offline data safely', 'Create real-time monitoring view'],
      courses: ['MQTT and IoT Messaging', 'IoT Data Engineering'],
      projects: ['Live Device Telemetry Dashboard', 'Fault Detection Stream Processor'],
      platforms: ['HiveMQ', 'Node-RED', 'Azure IoT Hub'],
      resources: [
        { label: 'MQTT Essentials', url: 'https://www.hivemq.com/mqtt-essentials/' },
        { label: 'Node-RED', url: 'https://nodered.org/docs/' },
      ],
      videos: [
        { title: 'Pandas Full Tutorial', url: 'https://www.youtube.com/watch?v=vmEHCJofslg' },
        { title: 'Python for Data Science - Full Course', url: 'https://www.youtube.com/watch?v=LHBE6Q9XlzI' },
      ],
    },
    {
      phase: 'Phase 4: Cloud IoT Ops',
      title: 'Deploy and Operate IoT at Scale',
      topics: 'Device management, cloud monitoring, OTA updates, IoT security',
      duration: '4-6 weeks',
      outcomes: ['Manage device fleet', 'Trigger OTA updates', 'Define incident alerts and runbooks'],
      courses: ['AWS IoT Core Fundamentals', 'IoT Security by Design'],
      projects: ['Fleet Health Monitoring Platform', 'Remote Firmware Update Workflow'],
      platforms: ['Azure IoT Central', 'AWS IoT Core', 'ThingsBoard'],
      resources: [
        { label: 'Azure IoT Learning Path', url: 'https://learn.microsoft.com/en-us/training/paths/develop-iot-solutions-azure/' },
        { label: 'AWS IoT Core Docs', url: 'https://docs.aws.amazon.com/iot/' },
      ],
      videos: [
        { title: 'Python for Data Science - Full Course', url: 'https://www.youtube.com/watch?v=LHBE6Q9XlzI' },
        { title: 'Node.js Full Course for Beginners', url: 'https://www.youtube.com/watch?v=Oe421EPjeBE' },
      ],
    },
  ],
  'Python Developer': [
    {
      phase: 'Phase 1: Python Foundations',
      title: 'Master Core Python',
      topics: 'Syntax, data types, functions, modules, OOP, file handling',
      duration: '3-4 weeks',
      outcomes: ['Write readable Python scripts', 'Use classes and modules', 'Read and write files safely'],
      courses: ['Python for Everybody', 'Automate the Boring Stuff with Python'],
      projects: ['CLI Expense Tracker', 'File Organizer Script'],
      platforms: ['HackerRank', 'Exercism', 'Replit'],
      resources: [
        { label: 'Official Python Tutorial', url: 'https://docs.python.org/3/tutorial/' },
        { label: 'Real Python', url: 'https://realpython.com/' },
      ],
      videos: [
        { title: 'Learn Python - Full Course for Beginners', url: 'https://www.youtube.com/watch?v=rfscVS0vtbw' },
        { title: 'Python Full Course for Beginners', url: 'https://www.youtube.com/watch?v=_uQrJ0TkZlc' },
      ],
    },
    {
      phase: 'Phase 2: Problem Solving',
      title: 'Data Structures, Algorithms and Git',
      topics: 'Lists, dicts, sets, recursion, sorting, complexity, Git workflow',
      duration: '3-5 weeks',
      outcomes: ['Solve easy and medium DSA problems', 'Explain time complexity', 'Work with branches and pull requests'],
      courses: ['Algorithms and Data Structures in Python', 'Git and GitHub Essentials'],
      projects: ['Library Management CLI', '50-Problem LeetCode Set'],
      platforms: ['LeetCode', 'HackerRank', 'GitHub'],
      resources: [
        { label: 'Python Data Structures Docs', url: 'https://docs.python.org/3/tutorial/datastructures.html' },
        { label: 'Pro Git Book', url: 'https://git-scm.com/book/en/v2' },
      ],
      videos: [
        { title: 'Algorithms and Data Structures - Full Course', url: 'https://www.youtube.com/watch?v=8hly31xKli0' },
        { title: 'Git and GitHub for Beginners', url: 'https://www.youtube.com/watch?v=RGOj5yH7evk' },
      ],
    },
    {
      phase: 'Phase 3: Web Back-end',
      title: 'Build APIs with Django and FastAPI',
      topics: 'REST design, Django ORM, FastAPI, SQL databases, authentication',
      duration: '4-6 weeks',
      outcomes: ['Build a REST API with auth', 'Model data with an ORM', 'Document endpoints'],
      courses: ['Django for Beginners', 'FastAPI Fundamentals'],
      projects: ['Blog API with FastAPI', 'Student Portal in Django'],
      platforms: ['Postman', 'PythonAnywhere', 'Render'],
      resources: [
        { label: 'Django Getting Started', url: 'https://docs.djangoproject.com/en/stable/intro/' },
        { label: 'FastAPI Tutorial', url: 'https://fastapi.tiangolo.com/tutorial/' },
      ],
      videos: [
        { title: 'Python Django Web Framework - Full Course', url: 'https://www.youtube.com/watch?v=F5mRW0jo-U4' },
        { title: 'Python API Development - Comprehensive Course', url: 'https://www.youtube.com/watch?v=0sOvCWFmrtA' },
      ],
    },
    {
      phase: 'Phase 4: Ship It',
      title: 'Testing, Docker and Deployment',
      topics: 'pytest, Docker, CI/CD pipelines, logging, deployment',
      duration: '3-5 weeks',
      outcomes: ['Reach solid test coverage', 'Containerise an app', 'Deploy with a CI pipeline'],
      courses: ['Testing Python with pytest', 'Docker for Developers'],
      projects: ['Tested and Dockerised API', 'CI Pipeline with GitHub Actions'],
      platforms: ['GitHub Actions', 'Docker Hub', 'Render'],
      resources: [
        { label: 'pytest Documentation', url: 'https://docs.pytest.org/' },
        { label: 'Docker Get Started', url: 'https://docs.docker.com/get-started/' },
      ],
      videos: [
        { title: 'Docker Tutorial for Beginners - Full DevOps Course', url: 'https://www.youtube.com/watch?v=fqMOX6JJhGo' },
        { title: 'Docker Tutorial for Beginners [Full Course]', url: 'https://www.youtube.com/watch?v=3c-iBn73dDE' },
      ],
    },
  ],
  'Java Developer': [
    {
      phase: 'Phase 1: Java Foundations',
      title: 'Learn Java and Object-Oriented Programming',
      topics: 'Syntax, data types, classes, inheritance, interfaces, exceptions',
      duration: '4-5 weeks',
      outcomes: ['Write programs with classes and interfaces', 'Handle exceptions properly', 'Explain the four OOP pillars'],
      courses: ['Java Programming Masterclass', 'Object-Oriented Programming in Java'],
      projects: ['Bank Account Simulator', 'Student Grade Manager'],
      platforms: ['HackerRank', 'CodeGym', 'Exercism'],
      resources: [
        { label: 'Learn Java (dev.java)', url: 'https://dev.java/learn/' },
        { label: 'Oracle Java Tutorials', url: 'https://docs.oracle.com/javase/tutorial/' },
      ],
      videos: [
        { title: 'Java Full Course for Beginners', url: 'https://www.youtube.com/watch?v=eIrMbAQSU34' },
        { title: 'Java Programming for Beginners - Full Course', url: 'https://www.youtube.com/watch?v=A74TOX803D0' },
      ],
    },
    {
      phase: 'Phase 2: Problem Solving',
      title: 'Collections, Data Structures and Algorithms',
      topics: 'Collections framework, generics, streams, recursion, sorting, Git',
      duration: '4-5 weeks',
      outcomes: ['Choose the right collection', 'Use streams and lambdas', 'Solve medium DSA problems'],
      courses: ['Data Structures and Algorithms in Java', 'Java Streams and Lambdas'],
      projects: ['Inventory System with Collections', '50-Problem LeetCode Set'],
      platforms: ['LeetCode', 'Codeforces', 'GitHub'],
      resources: [
        { label: 'Java Collections Tutorial', url: 'https://docs.oracle.com/javase/tutorial/collections/' },
        { label: 'Pro Git Book', url: 'https://git-scm.com/book/en/v2' },
      ],
      videos: [
        { title: 'Algorithms and Data Structures - Full Course', url: 'https://www.youtube.com/watch?v=8hly31xKli0' },
        { title: 'Learn Java 8 - Full Tutorial for Beginners', url: 'https://www.youtube.com/watch?v=grEKMHGYyns' },
      ],
    },
    {
      phase: 'Phase 3: Spring Boot',
      title: 'Build REST APIs with Spring Boot and Databases',
      topics: 'Spring Boot, REST controllers, JPA/Hibernate, SQL, validation, security',
      duration: '5-6 weeks',
      outcomes: ['Build a CRUD REST API', 'Persist data with JPA', 'Secure endpoints with Spring Security'],
      courses: ['Spring Boot Fundamentals', 'Spring Data JPA'],
      projects: ['Library Management REST API', 'E-commerce Order Service'],
      platforms: ['Spring Initializr', 'Postman', 'MySQL'],
      resources: [
        { label: 'Spring Guides', url: 'https://spring.io/guides' },
        { label: 'Spring Boot Reference', url: 'https://docs.spring.io/spring-boot/index.html' },
      ],
      videos: [
        { title: 'Spring Boot Tutorial for Beginners', url: 'https://www.youtube.com/watch?v=vtPkZShrvXQ' },
        { title: 'Spring Boot Tutorial - Full Course', url: 'https://www.youtube.com/watch?v=9SGDpanrc8U' },
      ],
    },
    {
      phase: 'Phase 4: Production Java',
      title: 'Testing, Microservices and Deployment',
      topics: 'JUnit, Mockito, microservices, Docker, Kubernetes, CI/CD',
      duration: '4-6 weeks',
      outcomes: ['Write unit and integration tests', 'Split an app into services', 'Deploy containers'],
      courses: ['Testing with JUnit 5', 'Microservices with Spring Cloud'],
      projects: ['Microservice-based Booking System', 'Dockerised Spring Boot App'],
      platforms: ['GitHub Actions', 'Docker Hub', 'Kubernetes'],
      resources: [
        { label: 'JUnit 5 User Guide', url: 'https://junit.org/junit5/docs/current/user-guide/' },
        { label: 'Docker Get Started', url: 'https://docs.docker.com/get-started/' },
      ],
      videos: [
        { title: 'Docker Tutorial for Beginners [Full Course]', url: 'https://www.youtube.com/watch?v=3c-iBn73dDE' },
        { title: 'Kubernetes Tutorial for Beginners', url: 'https://www.youtube.com/watch?v=X48VuDVv0do' },
      ],
    },
  ],
  'Machine Learning Engineer': [
    {
      phase: 'Phase 1: Foundations',
      title: 'Python, Maths and Statistics for ML',
      topics: 'NumPy, Pandas, linear algebra, probability, statistics',
      duration: '4-5 weeks',
      outcomes: ['Manipulate data with NumPy and Pandas', 'Explain distributions and hypothesis tests', 'Visualise datasets'],
      courses: ['Mathematics for Machine Learning', 'Statistics for Data Science'],
      projects: ['Exploratory Analysis of a Kaggle Dataset', 'Statistics Cheat-sheet Notebook'],
      platforms: ['Kaggle', 'Google Colab', 'Khan Academy'],
      resources: [
        { label: 'Khan Academy Statistics', url: 'https://www.khanacademy.org/math/statistics-probability' },
        { label: 'NumPy for Beginners', url: 'https://numpy.org/doc/stable/user/absolute_beginners.html' },
      ],
      videos: [
        { title: 'Statistics - A Full University Course', url: 'https://www.youtube.com/watch?v=xxpc-HPKN28' },
        { title: 'Python Tutorial for Beginners - Learn Python in 5 Hours', url: 'https://www.youtube.com/watch?v=t8pPdKYpowI' },
      ],
    },
    {
      phase: 'Phase 2: Core ML',
      title: 'Supervised and Unsupervised Learning',
      topics: 'Regression, classification, trees, ensembles, clustering, evaluation metrics',
      duration: '5-6 weeks',
      outcomes: ['Train and tune scikit-learn models', 'Choose the right metric', 'Avoid overfitting with validation'],
      courses: ['Machine Learning Specialization', 'Google Machine Learning Crash Course'],
      projects: ['House Price Predictor', 'Customer Churn Classifier'],
      platforms: ['Kaggle', 'Scikit-learn', 'Google Colab'],
      resources: [
        { label: 'Scikit-learn Tutorials', url: 'https://scikit-learn.org/stable/tutorial/index.html' },
        { label: 'Google ML Crash Course', url: 'https://developers.google.com/machine-learning/crash-course' },
      ],
      videos: [
        { title: 'Machine Learning for Everybody - Full Course', url: 'https://www.youtube.com/watch?v=i_LwzRVP7bg' },
        { title: 'Scikit-learn Crash Course', url: 'https://www.youtube.com/watch?v=0B5eIE_1vpU' },
      ],
    },
    {
      phase: 'Phase 3: Deep Learning',
      title: 'Neural Networks with PyTorch and TensorFlow',
      topics: 'Neural networks, CNNs, RNNs, transfer learning, GPUs',
      duration: '5-6 weeks',
      outcomes: ['Train a CNN on images', 'Fine-tune a pretrained model', 'Track experiments'],
      courses: ['Deep Learning Specialization', 'Practical Deep Learning for Coders'],
      projects: ['Image Classifier with Transfer Learning', 'Sentiment Analysis Model'],
      platforms: ['Google Colab', 'Hugging Face', 'Kaggle'],
      resources: [
        { label: 'PyTorch Tutorials', url: 'https://pytorch.org/tutorials/' },
        { label: 'fast.ai Course', url: 'https://course.fast.ai/' },
      ],
      videos: [
        { title: 'TensorFlow 2.0 Complete Course', url: 'https://www.youtube.com/watch?v=tPYj3fFJGjk' },
        { title: 'Python Machine Learning Tutorial', url: 'https://www.youtube.com/watch?v=7eh4d6sabA0' },
      ],
    },
    {
      phase: 'Phase 4: MLOps',
      title: 'Deploy and Monitor Models in Production',
      topics: 'Model serving, MLflow, Docker, CI/CD for ML, monitoring and drift',
      duration: '4-6 weeks',
      outcomes: ['Serve a model behind an API', 'Version models and data', 'Monitor drift in production'],
      courses: ['MLOps Fundamentals', 'Machine Learning Engineering for Production'],
      projects: ['Dockerised Model API', 'Automated Retraining Pipeline'],
      platforms: ['MLflow', 'Docker Hub', 'GitHub Actions'],
      resources: [
        { label: 'MLflow Documentation', url: 'https://mlflow.org/docs/latest/index.html' },
        { label: 'Made With ML', url: 'https://madewithml.com/' },
      ],
      videos: [
        { title: 'MLOps Course - Production Grade Projects', url: 'https://www.youtube.com/watch?v=-dJPoLm_gtE' },
        { title: 'Docker Tutorial for Beginners - Full DevOps Course', url: 'https://www.youtube.com/watch?v=fqMOX6JJhGo' },
      ],
    },
  ],
  'Cloud Engineer': [
    {
      phase: 'Phase 1: Foundations',
      title: 'Linux and Networking Basics',
      topics: 'Linux command line, shell scripting, TCP/IP, DNS, HTTP, subnets',
      duration: '3-4 weeks',
      outcomes: ['Work confidently in a Linux shell', 'Write basic shell scripts', 'Explain DNS, IPs and subnets'],
      courses: ['Introduction to Linux', 'Computer Networking Basics'],
      projects: ['Automated Server Setup Script', 'Home Network Diagram'],
      platforms: ['Linux Journey', 'OverTheWire', 'Cisco Packet Tracer'],
      resources: [
        { label: 'Linux Journey', url: 'https://linuxjourney.com/' },
        { label: 'Cloudflare Learning Center', url: 'https://www.cloudflare.com/learning/' },
      ],
      videos: [
        { title: 'Introduction to Linux - Full Course', url: 'https://www.youtube.com/watch?v=sWbUDq4S6Y8' },
        { title: 'DevOps Prerequisites Course', url: 'https://www.youtube.com/watch?v=Wvf0mBNGjXY' },
      ],
    },
    {
      phase: 'Phase 2: Cloud Fundamentals',
      title: 'Learn AWS and Azure Core Services',
      topics: 'Compute, storage, IAM, VPCs, databases, pricing, shared responsibility',
      duration: '4-5 weeks',
      outcomes: ['Launch and secure a VM', 'Set up IAM roles and policies', 'Design a basic VPC'],
      courses: ['AWS Cloud Practitioner Essentials', 'Microsoft Azure Fundamentals (AZ-900)'],
      projects: ['Static Website on S3 with CDN', 'Three-tier App on Virtual Machines'],
      platforms: ['AWS Free Tier', 'Azure for Students', 'Google Cloud Skills Boost'],
      resources: [
        { label: 'AWS Skill Builder', url: 'https://skillbuilder.aws/' },
        { label: 'Microsoft Learn: Azure Fundamentals', url: 'https://learn.microsoft.com/en-us/training/paths/microsoft-azure-fundamentals-describe-cloud-concepts/' },
      ],
      videos: [
        { title: 'AWS Certified Cloud Practitioner Course', url: 'https://www.youtube.com/watch?v=SOTamWNgDKc' },
        { title: 'Microsoft Azure Fundamentals (AZ-900) Course', url: 'https://www.youtube.com/watch?v=NKEFWyqJ5XA' },
      ],
    },
    {
      phase: 'Phase 3: Containers',
      title: 'Docker and Kubernetes',
      topics: 'Images, containers, registries, Kubernetes pods, services, deployments',
      duration: '4-6 weeks',
      outcomes: ['Containerise an application', 'Deploy to a Kubernetes cluster', 'Scale and roll back deployments'],
      courses: ['Docker Mastery', 'Kubernetes for Beginners'],
      projects: ['Containerised Microservice App', 'Kubernetes Deployment with Autoscaling'],
      platforms: ['Docker Hub', 'Minikube', 'Play with Kubernetes'],
      resources: [
        { label: 'Docker Get Started', url: 'https://docs.docker.com/get-started/' },
        { label: 'Kubernetes Basics', url: 'https://kubernetes.io/docs/tutorials/kubernetes-basics/' },
      ],
      videos: [
        { title: 'Docker Tutorial for Beginners [Full Course]', url: 'https://www.youtube.com/watch?v=3c-iBn73dDE' },
        { title: 'Kubernetes Tutorial for Beginners', url: 'https://www.youtube.com/watch?v=X48VuDVv0do' },
      ],
    },
    {
      phase: 'Phase 4: Automation',
      title: 'Infrastructure as Code and CI/CD',
      topics: 'Terraform, GitHub Actions, monitoring, security, cost control',
      duration: '4-6 weeks',
      outcomes: ['Provision infrastructure with Terraform', 'Automate deployments with CI/CD', 'Set up monitoring and alerts'],
      courses: ['Terraform Associate Prep', 'CI/CD with GitHub Actions'],
      projects: ['Terraform-built AWS Environment', 'Automated Deploy Pipeline'],
      platforms: ['Terraform Cloud', 'GitHub Actions', 'AWS CloudWatch'],
      resources: [
        { label: 'Terraform Tutorials', url: 'https://developer.hashicorp.com/terraform/tutorials' },
        { label: 'GitHub Actions Docs', url: 'https://docs.github.com/en/actions' },
      ],
      videos: [
        { title: 'Terraform Course - Automate AWS Infrastructure', url: 'https://www.youtube.com/watch?v=SLB_c_ayRMo' },
        { title: 'Complete Terraform Course - Beginner to Pro', url: 'https://www.youtube.com/watch?v=7xngnjfIlK4' },
      ],
    },
  ],
  'SQL Developer': [
    {
      phase: 'Phase 1: SQL Basics',
      title: 'Write Your First Queries',
      topics: 'SELECT, WHERE, ORDER BY, GROUP BY, joins, INSERT, UPDATE, DELETE',
      duration: '2-3 weeks',
      outcomes: ['Query any table with filters and sorting', 'Combine tables with joins', 'Summarise data with GROUP BY'],
      courses: ['SQL for Beginners', 'Introduction to Relational Databases'],
      projects: ['College Database Queries', 'Movie Library Database'],
      platforms: ['SQLBolt', 'HackerRank SQL', 'LeetCode Database'],
      resources: [
        { label: 'SQLBolt Interactive Lessons', url: 'https://sqlbolt.com/' },
        { label: 'W3Schools SQL Tutorial', url: 'https://www.w3schools.com/sql/' },
      ],
      videos: [
        { title: 'SQL Tutorial - Full Database Course for Beginners', url: 'https://www.youtube.com/watch?v=HXV3zeQKqGY' },
        { title: 'SQL Course for Beginners [Full Course]', url: 'https://www.youtube.com/watch?v=7S_tz1z_5bA' },
      ],
    },
    {
      phase: 'Phase 2: Database Design',
      title: 'Design and Normalise Databases',
      topics: 'ER diagrams, keys, normalisation (1NF-3NF), constraints, PostgreSQL',
      duration: '3-4 weeks',
      outcomes: ['Draw an ER diagram', 'Normalise a schema to 3NF', 'Enforce integrity with constraints'],
      courses: ['Database Design Fundamentals', 'PostgreSQL for Everybody'],
      projects: ['Hospital Management Schema', 'E-commerce Database Design'],
      platforms: ['dbdiagram.io', 'PostgreSQL', 'MySQL Workbench'],
      resources: [
        { label: 'PostgreSQL Tutorial', url: 'https://www.postgresql.org/docs/current/tutorial.html' },
        { label: 'dbdiagram.io', url: 'https://dbdiagram.io/' },
      ],
      videos: [
        { title: 'Database Design Course', url: 'https://www.youtube.com/watch?v=ztHopE5Wnpc' },
        { title: 'Learn PostgreSQL - Full Course for Beginners', url: 'https://www.youtube.com/watch?v=qw--VYLpxG4' },
      ],
    },
    {
      phase: 'Phase 3: Advanced SQL',
      title: 'Advanced Queries and Performance',
      topics: 'Subqueries, CTEs, window functions, indexes, query plans, stored procedures',
      duration: '4-5 weeks',
      outcomes: ['Use window functions and CTEs', 'Read and improve query plans', 'Write stored procedures and triggers'],
      courses: ['Advanced SQL for Data Professionals', 'SQL Performance Tuning'],
      projects: ['Sales Analytics with Window Functions', 'Index Tuning Case Study'],
      platforms: ['LeetCode Database', 'StrataScratch', 'DB Fiddle'],
      resources: [
        { label: 'Use The Index, Luke', url: 'https://use-the-index-luke.com/' },
        { label: 'Mode SQL Tutorial', url: 'https://mode.com/sql-tutorial/' },
      ],
      videos: [
        { title: 'Learn PostgreSQL - Full Course for Beginners', url: 'https://www.youtube.com/watch?v=qw--VYLpxG4' },
        { title: 'SQL Course for Beginners [Full Course]', url: 'https://www.youtube.com/watch?v=7S_tz1z_5bA' },
      ],
    },
    {
      phase: 'Phase 4: Data Pipelines',
      title: 'ETL, Warehousing and Reporting',
      topics: 'ETL with Python, star schemas, data warehouses, Power BI dashboards',
      duration: '4-5 weeks',
      outcomes: ['Build an ETL job', 'Design a star schema', 'Publish a dashboard on top of SQL'],
      courses: ['Data Warehousing Fundamentals', 'Power BI Data Analyst'],
      projects: ['Sales Data Warehouse', 'Automated ETL with Python'],
      platforms: ['Power BI', 'Apache Airflow', 'Snowflake Trial'],
      resources: [
        { label: 'Kimball Dimensional Modeling Techniques', url: 'https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/' },
        { label: 'Power BI Training', url: 'https://learn.microsoft.com/en-us/training/powerplatform/power-bi' },
      ],
      videos: [
        { title: 'Pandas Full Tutorial', url: 'https://www.youtube.com/watch?v=vmEHCJofslg' },
        { title: 'Learn Python - Full Course for Beginners', url: 'https://www.youtube.com/watch?v=rfscVS0vtbw' },
      ],
    },
  ],
};

const roleCertifications = {
  'Data Scientist': [
    'Google Advanced Data Analytics Certificate',
    'Microsoft Azure Data Scientist Associate (DP-100)',
    'IBM Data Science Professional Certificate',
  ],
  'AI Engineer': [
    'Microsoft Azure AI Engineer Associate (AI-102)',
    'AWS Certified Machine Learning - Specialty',
    'TensorFlow Developer Certificate',
  ],
  'Software Developer': [
    'AWS Certified Developer - Associate',
    'Microsoft Azure Developer Associate (AZ-204)',
    'Meta Front-End Developer Professional Certificate',
  ],
  'IoT Engineer': [
    'Microsoft Azure IoT Developer Specialty (AZ-220)',
    'AWS Certified Cloud Practitioner',
    'Cisco Industrial Networking Specialist',
  ],
  'Python Developer': [
    'PCEP - Certified Entry-Level Python Programmer',
    'PCAP - Certified Associate in Python Programming',
    'Microsoft Azure Developer Associate (AZ-204)',
  ],
  'Java Developer': [
    'Oracle Certified Associate, Java SE Programmer',
    'Oracle Certified Professional: Java SE 17 Developer',
    'Spring Certified Professional',
  ],
  'Machine Learning Engineer': [
    'AWS Certified Machine Learning Engineer - Associate',
    'Google Cloud Professional Machine Learning Engineer',
    'Microsoft Azure Data Scientist Associate (DP-100)',
  ],
  'Cloud Engineer': [
    'AWS Certified Solutions Architect - Associate',
    'Microsoft Azure Administrator Associate (AZ-104)',
    'Google Cloud Associate Cloud Engineer',
  ],
  'SQL Developer': [
    'Microsoft Azure Database Administrator Associate (DP-300)',
    'Oracle Database SQL Certified Associate',
    'Google Data Analytics Professional Certificate',
  ],
};

const roleOutlookSignals = {
  'Data Scientist': {
    trend: 'Hiring remains strong in analytics-heavy product and fintech teams.',
    focus: ['Responsible AI', 'Experimentation design', 'Data storytelling'],
  },
  'AI Engineer': {
    trend: 'GenAI production roles are expanding rapidly across enterprise products.',
    focus: ['LLMOps', 'RAG pipelines', 'Cost-efficient inference'],
  },
  'Software Developer': {
    trend: 'Demand is steady for full-stack developers who ship reliably at scale.',
    focus: ['System design', 'Cloud-native development', 'DevSecOps'],
  },
  'IoT Engineer': {
    trend: 'Industrial IoT and smart infrastructure projects are driving growth.',
    focus: ['Edge AI', 'IoT security', 'Device fleet observability'],
  },
  'Python Developer': {
    trend: 'Python remains one of the most hired languages for back-end, automation and data work.',
    focus: ['FastAPI services', 'Automation and scripting', 'Testing with pytest'],
  },
  'Java Developer': {
    trend: 'Banks, enterprises and large platforms keep hiring Java back-end developers.',
    focus: ['Spring Boot microservices', 'Cloud-native Java', 'Performance tuning'],
  },
  'Machine Learning Engineer': {
    trend: 'Teams need engineers who can take models from notebooks to reliable production services.',
    focus: ['MLOps pipelines', 'Model monitoring', 'Feature engineering'],
  },
  'Cloud Engineer': {
    trend: 'Cloud migration and AI workloads keep cloud engineers in high demand.',
    focus: ['Infrastructure as Code', 'Kubernetes', 'Cost optimisation (FinOps)'],
  },
  'SQL Developer': {
    trend: 'Every application and report depends on well-designed databases and fast queries.',
    focus: ['Query performance tuning', 'Cloud databases', 'Data warehousing'],
  },
};

const roleSkillTargets = {
  'Data Scientist': { python: 80, ml: 75, stats: 80, sql: 65, dl: 55 },
  'AI Engineer': { python: 78, ml: 82, stats: 60, sql: 50, dl: 85 },
  'Software Developer': { python: 70, ml: 45, stats: 40, sql: 60, dl: 35 },
  'IoT Engineer': { python: 72, ml: 40, stats: 45, sql: 52, dl: 48 },
  'Python Developer': { python: 88, ml: 35, stats: 45, sql: 65, dl: 25 },
  'Java Developer': { python: 80, ml: 40, stats: 45, sql: 65, dl: 35 },
  'Machine Learning Engineer': { python: 82, ml: 85, stats: 72, sql: 55, dl: 70 },
  'Cloud Engineer': { python: 60, ml: 30, stats: 35, sql: 50, dl: 30 },
  'SQL Developer': { python: 45, ml: 25, stats: 50, sql: 90, dl: 20 },
};

const roleDomainSkillOrder = {
  'Data Scientist': ['stats', 'ml', 'python', 'sql', 'dl'],
  'AI Engineer': ['dl', 'ml', 'python', 'stats', 'sql'],
  'Software Developer': ['python', 'sql', 'ml', 'stats', 'dl'],
  'IoT Engineer': ['python', 'sql', 'dl', 'ml', 'stats'],
  'Python Developer': ['python', 'sql', 'stats', 'ml', 'dl'],
  'Java Developer': ['python', 'sql', 'stats', 'ml', 'dl'],
  'Machine Learning Engineer': ['ml', 'python', 'stats', 'dl', 'sql'],
  'Cloud Engineer': ['python', 'sql', 'stats', 'ml', 'dl'],
  'SQL Developer': ['sql', 'stats', 'python', 'ml', 'dl'],
};

const skillDisplayNames = {
  python: 'Python',
  ml: 'Machine Learning',
  stats: 'Statistics',
  dl: 'Deep Learning',
  sql: 'SQL / Data Handling',
};

const roleSkillMap = {
  'Data Scientist': {
    python: 'Python',
    ml: 'Machine Learning',
    stats: 'Statistics',
    dl: 'Data Visualization',
    sql: 'SQL',
  },
  'AI Engineer': {
    python: 'Python',
    ml: 'Machine Learning',
    stats: 'Data Structures',
    dl: 'Deep Learning',
    sql: 'MLOps',
  },
  'Software Developer': {
    python: 'Programming Fundamentals',
    ml: 'Data Structures',
    stats: 'Algorithms',
    dl: 'System Design',
    sql: 'Git',
  },
  'IoT Engineer': {
    python: 'Python',
    ml: 'Embedded Systems',
    stats: 'Networking',
    dl: 'C/C++',
    sql: 'Cloud Integration',
  },
  'Python Developer': {
    python: 'Python',
    ml: 'REST APIs',
    stats: 'Data Structures',
    dl: 'Git',
    sql: 'SQL',
  },
  'Java Developer': {
    python: 'Java',
    ml: 'OOP',
    stats: 'Data Structures',
    dl: 'Spring Boot',
    sql: 'SQL',
  },
  'Machine Learning Engineer': {
    python: 'Python',
    ml: 'Machine Learning',
    stats: 'Statistics',
    dl: 'Deep Learning',
    sql: 'MLOps',
  },
  'Cloud Engineer': {
    python: 'Infrastructure as Code',
    ml: 'Containers',
    stats: 'Networking',
    dl: 'Linux',
    sql: 'Cloud Platforms',
  },
  'SQL Developer': {
    python: 'ETL',
    ml: 'Query Optimization',
    stats: 'Data Modeling',
    dl: 'Database Design',
    sql: 'SQL',
  },
};

const toLevel = (percent) => {
  const level = Math.round(Number(percent || 0) / 20);
  return Math.max(0, Math.min(5, level));
};

const toPercent = (level) => {
  const n = Number(level || 0);
  return Math.max(0, Math.min(100, Math.round((n / 5) * 100)));
};

const roleSkillWeights = {
  'Data Scientist': { python: 0.25, ml: 0.3, stats: 0.3, sql: 0.15 },
  'AI Engineer': { python: 0.2, ml: 0.3, dl: 0.4, stats: 0.1 },
  'Software Developer': { python: 0.35, sql: 0.2, ml: 0.1, stats: 0.1, dl: 0.05 },
  'IoT Engineer': { python: 0.3, sql: 0.15, ml: 0.1, dl: 0.1, stats: 0.05 },
  'Python Developer': { python: 0.45, sql: 0.25, stats: 0.1, ml: 0.05 },
  'Java Developer': { python: 0.4, sql: 0.25, stats: 0.15, ml: 0.05 },
  'Machine Learning Engineer': { python: 0.2, ml: 0.4, stats: 0.2, dl: 0.2 },
  'Cloud Engineer': { python: 0.35, sql: 0.25, stats: 0.05, ml: 0.05, dl: 0.05 },
  'SQL Developer': { sql: 0.5, stats: 0.15, python: 0.15 },
};

const interestRoleBoost = {
  'AI/ML': { 'AI Engineer': 22, 'Data Scientist': 16, 'Machine Learning Engineer': 24 },
  'Data Science': { 'Data Scientist': 24, 'AI Engineer': 10, 'Machine Learning Engineer': 12, 'SQL Developer': 10 },
  'Web Dev': { 'Software Developer': 24, 'Python Developer': 14, 'Java Developer': 14 },
  IoT: { 'IoT Engineer': 28 },
  Cloud: { 'AI Engineer': 10, 'Software Developer': 10, 'IoT Engineer': 12, 'Cloud Engineer': 30 },
  Security: { 'Software Developer': 8, 'IoT Engineer': 10, 'Cloud Engineer': 10 },
};

const homeJourneySteps = [
  { step: '01', title: 'Bring your material together', desc: 'Upload notes, PDFs, slides and textbook pages to your RAG library, and paste deadline messages from class groups.', icon: Upload },
  { step: '02', title: 'Let the agents plan and explain', desc: 'The planner builds your schedule around deadlines and exams, and the tutor explains anything you find difficult.', icon: Brain },
  { step: '03', title: 'Revise, test and improve', desc: 'Quizzes find your weak topics, and the planner schedules extra review for them automatically.', icon: TrendingUp },
];

function StatCard({ label, value, helper, icon: Icon, color }) {
  return (
    <div className="glass-card rounded-2xl p-6 scroll-animate visible">
      <div className="mb-4 flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <span className="text-sm text-gray-400">{label}</span>
      </div>
      <div className="text-3xl font-bold">{value}</div>
      <div className="mt-1 text-xs text-green-400">{helper}</div>
    </div>
  );
}

const normalizeAiAdvisor = (value) => {
  if (!value || typeof value !== 'object') return null;

  const toStringList = (items) =>
    Array.isArray(items) ? items.filter((item) => typeof item === 'string' && item.trim()) : [];

  const projectIdeas = Array.isArray(value.projectIdeas)
    ? value.projectIdeas
        .map((item) => {
          if (typeof item === 'string') {
            return { name: item.trim(), description: '', skills: [] };
          }

          if (!item || typeof item !== 'object') return null;

          return {
            name: typeof item.name === 'string' ? item.name.trim() : '',
            description: typeof item.description === 'string' ? item.description.trim() : '',
            skills: Array.isArray(item.skills)
              ? item.skills.filter((skill) => typeof skill === 'string' && skill.trim())
              : [],
          };
        })
        .filter((item) => item?.name)
    : [];

  const learningVideos = Array.isArray(value.learningVideos)
    ? value.learningVideos
        .map((item) => {
          if (!item || typeof item !== 'object') return null;

          const url = typeof item.url === 'string' ? item.url.trim() : '';
          if (!/^https?:\/\//i.test(url)) return null;

          return {
            title: typeof item.title === 'string' ? item.title.trim() : 'Recommended Video',
            url,
            reason: typeof item.reason === 'string' ? item.reason.trim() : '',
          };
        })
        .filter(Boolean)
    : [];

  return {
    summary: typeof value.summary === 'string' ? value.summary : '',
    strengths: toStringList(value.strengths),
    risks: toStringList(value.risks),
    roadmapEnhancements: toStringList(value.roadmapEnhancements),
    nextActions: toStringList(value.nextActions),
    projectIdeas,
    learningVideos,
    model: typeof value.model === 'string' ? value.model : '',
    provider: typeof value.provider === 'string' ? value.provider : '',
  };
};

const fallbackVideoCatalog = [
  {
    keywords: ['python', 'data science', 'pandas', 'numpy'],
    videos: [
      {
        title: 'Python for Data Science - Full Course',
        url: 'https://www.youtube.com/watch?v=LHBE6Q9XlzI',
        reason: 'Direct full-course lesson for fundamentals.',
      },
      {
        title: 'Pandas Full Tutorial',
        url: 'https://www.youtube.com/watch?v=vmEHCJofslg',
        reason: 'Hands-on walkthrough for practical data work.',
      },
    ],
  },
  {
    keywords: ['sql', 'database'],
    videos: [
      {
        title: 'SQL Full Course for Beginners',
        url: 'https://www.youtube.com/watch?v=HXV3zeQKqGY',
        reason: 'Covers SQL from basics to practical querying.',
      },
      {
        title: 'Advanced SQL Concepts',
        url: 'https://www.youtube.com/watch?v=7S_tz1z_5bA',
        reason: 'Improves real-world querying and optimization skills.',
      },
    ],
  },
  {
    keywords: [
      'machine learning', 'ml', 'deep learning', 'ai', 'ai engineer',
      'neural', 'nlp', 'transformers', 'computer vision', 'cv', 'pytorch',
      'tensorflow', 'keras', 'mlops', 'deployment', 'genai', 'generative',
      'llm', 'rag', 'dsa', 'algorithms', 'oop', 'python oop',
    ],
    videos: [
      {
        title: 'Machine Learning for Beginners',
        url: 'https://www.youtube.com/watch?v=NWONeJKn6kc',
        reason: 'Practical ML foundations from freeCodeCamp.',
      },
      {
        title: 'Neural Networks Explained',
        url: 'https://www.youtube.com/watch?v=aircAruvnKk',
        reason: 'Builds intuition for deep learning fundamentals.',
      },
    ],
  },
  {
    keywords: ['react', 'javascript', 'node', 'web'],
    videos: [
      {
        title: 'JavaScript Full Course',
        url: 'https://www.youtube.com/watch?v=PkZNo7MFNFg',
        reason: 'Core language foundations for web development.',
      },
      {
        title: 'React Course for Beginners',
        url: 'https://www.youtube.com/watch?v=bMknfKXIFA8',
        reason: 'Practical component-based UI development training.',
      },
    ],
  },
  {
    keywords: [
      'iot', 'embedded', 'arduino', 'electronics',
      'raspberry', 'firmware', 'mqtt', 'microcontroller', 'sensor',
      'sensors', 'esp32', 'hardware', 'protocols', 'iot security',
      'aws iot', 'azure iot', 'smart home', 'telemetry', 'node-red',
    ],
    videos: [
      {
        title: 'Python for Data Science - Full Course',
        url: 'https://www.youtube.com/watch?v=LHBE6Q9XlzI',
        reason: 'Python scripting foundation essential for IoT automation.',
      },
      {
        title: 'Node.js Full Course for Beginners',
        url: 'https://www.youtube.com/watch?v=Oe421EPjeBE',
        reason: 'Server-side scripting used in IoT cloud integrations.',
      },
    ],
  },
];

const defaultFallbackVideos = [
  {
    title: 'JavaScript Full Course for Beginners',
    url: 'https://www.youtube.com/watch?v=PkZNo7MFNFg',
    reason: 'Solid baseline for structured technical learning.',
  },
  {
    title: 'React Course for Beginners',
    url: 'https://www.youtube.com/watch?v=bMknfKXIFA8',
    reason: 'Project execution strategy and implementation approach.',
  },
];

const pickFallbackVideos = (selectedCourse, roleName) => {
  const text = String(selectedCourse || '').toLowerCase();
  const matched = fallbackVideoCatalog.find((entry) => entry.keywords.some((keyword) => text.includes(keyword)));
  if (matched) return matched.videos;
  if (roleName) {
    const roleText = String(roleName).toLowerCase();
    const roleMatched = fallbackVideoCatalog.find((entry) => entry.keywords.some((keyword) => roleText.includes(keyword)));
    if (roleMatched) return roleMatched.videos;
  }
  return defaultFallbackVideos;
};

const buildRoadmapFallback = ({ selectedCourse, phaseName, roleName }) => ({
  summary: `Generated a practical starter plan for ${selectedCourse}.`,
  modules: [
    {
      phaseLabel: phaseName || 'Phase 1: Foundation',
      title: `${selectedCourse} Fundamentals`,
      objective: `Build confidence in ${selectedCourse} step by step.`,
      tasks: [
        `Watch one complete lesson on ${selectedCourse}.`,
        'Take notes and list 5 key concepts.',
        'Build one mini project using what you learned.',
      ],
      videos: [
        ...pickFallbackVideos(selectedCourse, roleName),
      ],
    },
    {
      phaseLabel: 'Phase 2: Guided Practice',
      title: `${selectedCourse} Guided Practice`,
      objective: `Apply ${selectedCourse} concepts with guided exercises.`,
      tasks: [
        'Follow one guided tutorial from start to finish.',
        'Repeat the implementation without copying directly.',
        'List 3 mistakes you fixed while practicing.',
      ],
      videos: [
        ...pickFallbackVideos(selectedCourse, roleName).slice(1, 3),
      ],
    },
    {
      phaseLabel: 'Phase 3: Applied Practice',
      title: `${selectedCourse} Applied Practice`,
      objective: `Apply ${selectedCourse} concepts in ${phaseName || 'this phase'}.`,
      tasks: [
        'Implement one guided hands-on tutorial.',
        'Push your code and notes to GitHub.',
        'Write a short retrospective on improvements needed.',
      ],
      videos: [
        ...pickFallbackVideos(selectedCourse, roleName).slice(0, 1),
      ],
    },
    {
      phaseLabel: 'Phase 4: Review and Interview Prep',
      title: `${selectedCourse} Review and Interview Prep`,
      objective: `Consolidate concepts and prepare to explain them clearly.`,
      tasks: [
        'Revise your notes into a concise summary sheet.',
        'Prepare 5 interview-style questions and answers.',
        'Refactor your mini project for clarity and better naming.',
      ],
      videos: [
        ...pickFallbackVideos(selectedCourse, roleName).slice(0, 2),
      ],
    },
  ],
  provider: 'frontend-fallback',
  model: 'starter-plan',
});

const normalizeRoadmapModulesClient = ({ roadmapModules, selectedCourse, phaseName, roleName }) => {
  if (roadmapModules && Array.isArray(roadmapModules.modules) && roadmapModules.modules.length > 0) {
    return roadmapModules;
  }

  return buildRoadmapFallback({ selectedCourse, phaseName, roleName });
};

const toEmbeddedVideoSrc = (url, title = '') => {
  if (!url || typeof url !== 'string') return null;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    if (host.includes('youtube.com') || host.includes('youtu.be')) {
      if (host.includes('youtu.be')) {
        const id = parsed.pathname.replace(/^\//, '').split('/')[0];
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }

      if (parsed.pathname.includes('/watch')) {
        const id = parsed.searchParams.get('v');
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }

      if (parsed.pathname.includes('/shorts/')) {
        const id = parsed.pathname.split('/shorts/')[1]?.split('/')[0];
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }

      if (parsed.pathname.includes('/results')) {
        return null;
      }
    }

    if (host.includes('vimeo.com')) {
      const id = parsed.pathname.replace(/^\//, '').split('/')[0];
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }

    return null;
  } catch {
    return null;
  }
};

const buildLearningTranscript = ({ selectedCourse, moduleItem, video }) => {
  const tasks = Array.isArray(moduleItem?.tasks) ? moduleItem.tasks.slice(0, 3) : [];
  const objective = moduleItem?.objective || `Understand core ideas in ${selectedCourse}.`;

  return [
    `Intro: In this lesson, we focus on ${moduleItem?.title || selectedCourse}. ${objective}`,
    `Core Concepts: Watch for definitions, examples, and the end-to-end flow explained in ${video?.title || 'the video'}.`,
    tasks.length
      ? `Action Notes: ${tasks.join(' Then, ')}`
      : `Action Notes: Pause every 10-15 minutes and implement one small concept in code immediately.`,
    'Reflection: Summarize what you learned in 5 bullet points and identify one gap to improve in the next module.',
  ];
};

export default function HackathonExperience() {
  const [activePage, setActivePage] = useState('home');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [careerMenuOpen, setCareerMenuOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [authMode, setAuthMode] = useState('register');
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [signInConfirmPassword, setSignInConfirmPassword] = useState('');
  const [signedInEmail, setSignedInEmail] = useState('');
  const [signInError, setSignInError] = useState('');
  const [signInMessage, setSignInMessage] = useState('');
  const [signInLoading, setSignInLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState('Data Scientist');
  const [hoveredRadarSkill, setHoveredRadarSkill] = useState(null);
  const [aiAdvisor, setAiAdvisor] = useState(null);
  const [aiAdvisorLoading, setAiAdvisorLoading] = useState(false);
  const [aiAdvisorError, setAiAdvisorError] = useState('');
  const [selectedRoadmapCourse, setSelectedRoadmapCourse] = useState('');
  const [roadmapModules, setRoadmapModules] = useState(null);
  const [roadmapModulesLoading, setRoadmapModulesLoading] = useState(false);
  const [roadmapModulesError, setRoadmapModulesError] = useState('');
  const [playerData, setPlayerData] = useState(null);
  const [activePlayerModuleIndex, setActivePlayerModuleIndex] = useState(0);
  const [activePlayerVideoIndex, setActivePlayerVideoIndex] = useState(0);
  const [interests, setInterests] = useState([]);
  const [skills, setSkills] = useState({ python: 50, ml: 30, stats: 40, dl: 20, sql: 60 });
  const [studentName, setStudentName] = useState('');
  const [email, setEmail] = useState('');
  const [completedCourses, setCompletedCourses] = useState('');
  const [projects, setProjects] = useState('');
  const [resumeFileName, setResumeFileName] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [resumeUploadLoading, setResumeUploadLoading] = useState(false);
  const [resumeUploadError, setResumeUploadError] = useState('');
  const [profileSubmitted, setProfileSubmitted] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [memoryStats, setMemoryStats] = useState(null);
  const [analysisError, setAnalysisError] = useState('');
  const [availableRoles, setAvailableRoles] = useState([]);
  const roadmapItems = roleRoadmaps[selectedRole] || roleRoadmaps['Data Scientist'];

  const roleDisplayName = (roleName) => {
    const role = roleCards.find((item) => item.name === roleName);
    return role?.displayName || roleName;
  };

  const selectedRoleLabel = roleDisplayName(selectedRole);

  const playerModules = useMemo(() => {
    return Array.isArray(playerData?.modules) ? playerData.modules : [];
  }, [playerData]);

  const groupedPlayerModules = useMemo(() => {
    return playerModules.reduce((groups, moduleItem, index) => {
      const phaseLabel = moduleItem?.phaseLabel || playerData?.phaseName || 'Learning Modules';
      const existing = groups.find((group) => group.phaseLabel === phaseLabel);

      if (existing) {
        existing.items.push({ moduleItem, index });
        return groups;
      }

      groups.push({ phaseLabel, items: [{ moduleItem, index }] });
      return groups;
    }, []);
  }, [playerData, playerModules]);

  const activePlayerModule = useMemo(() => {
    return playerModules[activePlayerModuleIndex] || null;
  }, [playerModules, activePlayerModuleIndex]);

  const playableVideos = useMemo(() => {
    const videos = Array.isArray(activePlayerModule?.videos) ? activePlayerModule.videos : [];
    return videos.filter((video) => Boolean(toEmbeddedVideoSrc(video?.url || '', video?.title || '')));
  }, [activePlayerModule]);

  const activePlayerVideo = useMemo(() => {
    return playableVideos[activePlayerVideoIndex] || playableVideos[0] || null;
  }, [playableVideos, activePlayerVideoIndex]);

  const activePlayerTranscript = useMemo(() => {
    if (!activePlayerModule) return [];

    return buildLearningTranscript({
      selectedCourse: playerData?.selectedCourse || selectedRoadmapCourse || 'Selected Course',
      moduleItem: activePlayerModule,
      video: activePlayerVideo,
    });
  }, [activePlayerModule, activePlayerVideo, playerData, selectedRoadmapCourse]);

  const roadmapCourseOptions = useMemo(() => {
    return roadmapItems.flatMap((phaseItem) =>
      (phaseItem.courses || []).map((course) => ({
        course,
        phase: phaseItem.phase,
        phaseTitle: phaseItem.title,
      })),
    );
  }, [roadmapItems]);

  const buildStudentSkillsForRole = (roleName) => {
    const mapper = roleSkillMap[roleName] || roleSkillMap['Data Scientist'];
    return Object.entries(mapper).reduce((acc, [sliderKey, backendSkill]) => {
      acc[backendSkill] = toLevel(skills[sliderKey]);
      return acc;
    }, {});
  };

  const buildAnalyzePayload = (roleName) => ({
    studentId: profileSubmitted ? 'FORM-SUBMITTED' : 'FORM-DRAFT',
    studentName: studentName.trim() || 'Custom Student',
    targetRole: roleName,
    studentSkills: buildStudentSkillsForRole(roleName),
    careerInterests: interests,
    completedCourses: completedCourses.split(',').map((item) => item.trim()).filter(Boolean),
    projects: projects.split(',').map((item) => item.trim()).filter(Boolean),
    email: email.trim(),
    resumeFileName,
    resumeText: resumeText.trim(),
  });

  const parseApiResponse = async (response, fallbackErrorMessage) => {
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      return response.json().catch(() => ({}));
    }

    const rawText = await response.text().catch(() => '');
    const trimmedText = rawText.trim();

    if (/^<!doctype|^<html/i.test(trimmedText)) {
      return {
        error:
          'Server returned HTML instead of JSON. Ensure backend is running on port 4000 and API URL is correct.',
      };
    }

    if (!trimmedText) {
      return { error: fallbackErrorMessage };
    }

    try {
      return JSON.parse(trimmedText);
    } catch {
      return { error: trimmedText || fallbackErrorMessage };
    }
  };

  const saveProfilePayload = async (roleName) => {
    const payload = buildAnalyzePayload(roleName);
    const response = await fetch(`${API_BASE_URL}/api/profiles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await parseApiResponse(response, 'Failed to save profile.');
    if (!response.ok) {
      throw new Error(data.error || 'Failed to save profile.');
    }
  };

  const runAnalysis = async (roleName) => {
    setAnalysisLoading(true);
    setAnalysisError('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildAnalyzePayload(roleName)),
      });

      const data = await parseApiResponse(response, 'Unable to run analysis right now.');
      if (!response.ok) {
        throw new Error(data.error || 'Unable to run analysis right now.');
      }

      setAnalysisResult(data);
    } catch (error) {
      setAnalysisError(error.message || 'Unable to run analysis right now.');
      setAnalysisResult(null);
    } finally {
      setAnalysisLoading(false);
    }
  };

  const analysisInsights = useMemo(() => {
    if (analysisResult) {
      const weakFromBackend = [
        ...(analysisResult.missingSkills || []).map((item) => ({
          key: `missing-${item.skill}`,
          skill: item.skill,
          current: 0,
          required: toPercent(item.requiredLevel),
          gap: toPercent(item.requiredLevel),
        })),
        ...(analysisResult.weakSkills || []).map((item) => ({
          key: `weak-${item.skill}`,
          skill: item.skill,
          current: toPercent(item.studentLevel),
          required: toPercent(item.requiredLevel),
          gap: toPercent(item.gap),
        })),
      ];

      const strongFromBackend = (analysisResult.skillScores || [])
        .filter((item) => Number(item.studentLevel || 0) >= Number(item.requiredLevel || 0))
        .map((item) => ({
          key: `strong-${item.skill}`,
          skill: item.skill,
          current: toPercent(item.studentLevel),
          required: toPercent(item.requiredLevel),
          gap: 0,
        }));

      const recommendedLearnings = [
        ...weakFromBackend.slice(0, 3).map((item, index) => ({
          title: `Improve ${item.skill}`,
          details:
            roadmapItems[index]?.topics || `Practice projects and guided exercises focused on ${item.skill}.`,
          priority: item.gap >= 30 ? 'High' : item.gap >= 15 ? 'Medium' : 'Low',
        })),
        ...(analysisResult.recommendedSkills || []).slice(0, 2).map((skill) => ({
          title: `Add ${skill}`,
          details: `Build familiarity with ${skill} through focused projects and practical exercises.`,
          priority: 'Medium',
        })),
      ];

      const backendRoleCards = availableRoles.length
        ? availableRoles.filter((role) => roleCards.some((card) => card.name === role.roleName))
        : [];

      const roleFit = (backendRoleCards.length ? backendRoleCards : roleCards).map((role) => {
        const roleName = role.roleName || role.name;
        const roleDef = availableRoles.find((item) => item.roleName === roleName);
        if (!roleDef || !roleDef.requiredSkills) {
          const fallbackTarget = roleSkillTargets[roleName] || roleSkillTargets['Data Scientist'];
          const fallbackScore = Object.entries(fallbackTarget).reduce((sum, [key, required]) => {
            const current = Number(skills[key] ?? 0);
            const contribution = Math.min(current, required) / required;
            return sum + contribution;
          }, 0);
          const normalizedFallback = Math.round((fallbackScore / Object.keys(fallbackTarget).length) * 100);
          return { role: roleName, score: normalizedFallback };
        }

        const studentSkillMap = buildStudentSkillsForRole(roleName);
        const requiredEntries = Object.entries(roleDef.requiredSkills);
        const total = requiredEntries.reduce((sum, [skillName, requiredLevel]) => {
          const studentLevel = Number(studentSkillMap[skillName] || 0);
          const required = Number(requiredLevel || 0);
          const contribution = required > 0 ? Math.min(studentLevel, required) / required : 1;
          return sum + contribution;
        }, 0);

        const normalized = requiredEntries.length ? Math.round((total / requiredEntries.length) * 100) : 0;
        return { role: roleName, score: normalized };
      });

      return {
        weak: weakFromBackend,
        strong: strongFromBackend,
        recommendedLearnings,
        roleFit,
      };
    }

    const target = roleSkillTargets[selectedRole] || roleSkillTargets['Data Scientist'];

    const mistakes = Object.entries(target)
      .map(([key, required]) => {
        const current = Number(skills[key] ?? 0);
        const gap = Math.max(0, required - current);
        return {
          key,
          skill: skillDisplayNames[key] || key,
          current,
          required,
          gap,
        };
      })
      .sort((a, b) => b.gap - a.gap);

    const weak = mistakes.filter((item) => item.gap > 0);
    const strong = mistakes.filter((item) => item.gap <= 0);

    const recommendedLearnings = weak.slice(0, 3).map((item, index) => ({
      title: `Improve ${item.skill}`,
      details:
        roadmapItems[index]?.topics || `Practice projects and guided exercises focused on ${item.skill}.`,
      priority: item.gap >= 30 ? 'High' : item.gap >= 15 ? 'Medium' : 'Low',
    }));

    const roleFit = roleCards.map((role) => {
      const roleTarget = roleSkillTargets[role.name] || roleSkillTargets['Data Scientist'];
      const score = Object.entries(roleTarget).reduce((sum, [key, required]) => {
        const current = Number(skills[key] ?? 0);
        const contribution = Math.min(current, required) / required;
        return sum + contribution;
      }, 0);
      const normalized = Math.round((score / Object.keys(roleTarget).length) * 100);
      return { role: role.name, score: normalized };
    });

    return { weak, strong, recommendedLearnings, roleFit };
  }, [analysisResult, selectedRole, skills, roadmapItems, availableRoles]);

  const recommendedRole = useMemo(() => {
    let bestRole = selectedRole;
    let bestScore = -1;

    roleCards.forEach((role) => {
      const weightMap = roleSkillWeights[role.name] || {};
      const skillScore = Object.entries(weightMap).reduce((sum, [skillKey, weight]) => {
        const level = Number(skills[skillKey] ?? 0);
        return sum + level * weight;
      }, 0);

      const interestScore = interests.reduce((sum, interest) => {
        return sum + Number(interestRoleBoost[interest]?.[role.name] ?? 0);
      }, 0);

      const totalScore = skillScore + interestScore;
      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestRole = role.name;
      }
    });

    return bestRole;
  }, [skills, interests, selectedRole]);

  const selectedRoleMatch = useMemo(() => {
    const roleScore = analysisInsights.roleFit.find((item) => item.role === selectedRole);
    return roleScore ? roleScore.score : 0;
  }, [analysisInsights.roleFit, selectedRole]);

  const skillComparisonRows = useMemo(() => {
    if (analysisResult?.skillScores?.length) {
      return analysisResult.skillScores.map((item) => ({
        key: item.skill,
        name: item.skill,
        current: toPercent(item.studentLevel),
        required: toPercent(item.requiredLevel),
      }));
    }

    const target = roleSkillTargets[selectedRole] || roleSkillTargets['Data Scientist'];
    const orderedKeys = roleDomainSkillOrder[selectedRole] || Object.keys(target);

    return orderedKeys.map((key) => {
      const required = Number(target[key] ?? 0);
      const current = Number(skills[key] ?? 0);
      return {
        key,
        name: skillDisplayNames[key] || key,
        current,
        required,
      };
    });
  }, [analysisResult, selectedRole, skills]);

  const skillsMasteredCount = useMemo(() => {
    return analysisInsights.strong.length;
  }, [analysisInsights.strong.length]);

  const topDemandSkills = useMemo(() => {
    const target = roleSkillTargets[selectedRole] || roleSkillTargets['Data Scientist'];
    return Object.entries(target)
      .map(([key, required]) => {
        const current = Number(skills[key] ?? 0);
        const gap = Math.max(0, required - current);
        const demandScore = Math.round(required * 0.7 + gap * 0.3);
        return {
          key,
          label: skillDisplayNames[key] || key,
          required,
          current,
          gap,
          demandScore,
        };
      })
      .sort((a, b) => b.demandScore - a.demandScore)
      .slice(0, 4);
  }, [selectedRole, skills]);

  const topRolesToFocus = useMemo(() => {
    return [...analysisInsights.roleFit].sort((a, b) => b.score - a.score).slice(0, 3);
  }, [analysisInsights.roleFit]);

  const recommendedCertifications = useMemo(() => {
    return roleCertifications[selectedRole] || roleCertifications['Data Scientist'];
  }, [selectedRole]);

  const aiIndustryOutlook = useMemo(() => {
    const signal = roleOutlookSignals[selectedRole] || roleOutlookSignals['Data Scientist'];
    const biggestGap = analysisInsights.weak[0];

    const summary =
      biggestGap && biggestGap.gap > 0
        ? `AI suggests prioritizing ${biggestGap.skill} now. Closing this gap can improve your ${selectedRole} readiness faster than general practice.`
        : `AI suggests your profile is well aligned for ${selectedRole}. Focus on portfolio depth and interview-ready projects.`;

    const suggestions = [
      `Industry trend: ${signal.trend}`,
      `Most valuable focus areas this quarter: ${signal.focus.join(', ')}`,
      `Action for next 30 days: Complete one certification module and ship one domain-specific project.`,
    ];

    return { summary, suggestions };
  }, [selectedRole, analysisInsights.weak]);

  const requestAiAdvisor = async (targetRole) => {
    setAiAdvisorLoading(true);
    setAiAdvisorError('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/analyze/ai-advisor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildAnalyzePayload(targetRole)),
      });

      const data = await parseApiResponse(response, 'Failed to fetch AI advisor output.');
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch AI advisor output.');
      }

      setAiAdvisor(normalizeAiAdvisor(data.aiAdvisor));
    } catch (error) {
      setAiAdvisor(null);
      setAiAdvisorError(error.message || 'AI advisor is unavailable right now.');
    } finally {
      setAiAdvisorLoading(false);
    }
  };

  const openRoadmapPlayerTab = (payload, preOpenedTab) => {
    const playerUrl = `${window.location.origin}${window.location.pathname}#roadmap-player`;

    try {
      window.localStorage.setItem(ROADMAP_PLAYER_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      return;
    }

    if (preOpenedTab && !preOpenedTab.closed) {
      preOpenedTab.location.href = playerUrl;
      return;
    }

    window.open(playerUrl, '_blank', 'noopener,noreferrer');
  };

  const requestRoadmapModules = async () => {
    const selected = roadmapCourseOptions.find((item) => item.course === selectedRoadmapCourse);

    if (!selectedRoadmapCourse || !selected) {
      setRoadmapModulesError('Please select a course first.');
      return;
    }

    setRoadmapModulesLoading(true);
    setRoadmapModulesError('');
    const preOpenedTab = window.open('', '_blank');

    try {
      const response = await fetch(`${API_BASE_URL}/api/roadmap/modules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetRole: selectedRole,
          phaseName: selected.phase,
          selectedCourse: selected.course,
          quickMode: true,
          studentName: studentName.trim() || 'Custom Student',
          careerInterests: interests,
          completedCourses: completedCourses.split(',').map((item) => item.trim()).filter(Boolean),
          projects: projects.split(',').map((item) => item.trim()).filter(Boolean),
          resumeText: resumeText.trim(),
        }),
      });

      const data = await parseApiResponse(response, 'Unable to generate modules right now.');
      if (!response.ok) {
        throw new Error(data.error || 'Unable to generate modules right now.');
      }

      const normalizedRoadmapModules = normalizeRoadmapModulesClient({
        roadmapModules: data.roadmapModules,
        selectedCourse: selected.course,
        phaseName: selected.phase,
        roleName: selectedRole,
      });

      setRoadmapModules(normalizedRoadmapModules);

      const payload = {
        selectedCourse: selected.course,
        phaseName: selected.phase,
        roleName: selectedRole,
        generatedAt: new Date().toISOString(),
        summary: normalizedRoadmapModules.summary || '',
        modules: normalizedRoadmapModules.modules || [],
      };

      setPlayerData(payload);
      setActivePlayerModuleIndex(0);
      setActivePlayerVideoIndex(0);
      openRoadmapPlayerTab(payload, preOpenedTab);
    } catch (error) {
      if (preOpenedTab && !preOpenedTab.closed) {
        preOpenedTab.close();
      }
      setRoadmapModules(null);
      setRoadmapModulesError(error.message || 'Unable to generate modules right now.');
    } finally {
      setRoadmapModulesLoading(false);
    }
  };

  const radarChart = useMemo(() => {
    const axes = skillComparisonRows.slice(0, 6).map((item) => ({
      key: item.key,
      label: item.name,
      current: item.current,
      target: item.required,
    }));

    if (!axes.length) {
      return {
        center: 160,
        ringPolygons: [],
        axisLines: [],
        currentPolygon: '',
        targetPolygon: '',
        axisValues: [],
        axisPoints: [],
      };
    }

    const center = 160;
    const radius = 112;
    const ringLevels = [20, 40, 60, 80, 100];
    const angleStep = (Math.PI * 2) / axes.length;
    const startAngle = -Math.PI / 2;

    const toPoint = (percentage, index, extra = 0) => {
      const normalized = Math.max(0, Math.min(100, percentage));
      const r = (normalized / 100) * radius + extra;
      const angle = startAngle + index * angleStep;
      const x = center + r * Math.cos(angle);
      const y = center + r * Math.sin(angle);
      return { x, y };
    };

    const polygonFor = (getValue) =>
      axes
        .map((axis, index) => {
          const point = toPoint(getValue(axis), index);
          return `${point.x},${point.y}`;
        })
        .join(' ');

    const currentPolygon = polygonFor((axis) => Number(axis.current ?? 0));
    const targetPolygon = polygonFor((axis) => Number(axis.target ?? 0));

    const ringPolygons = ringLevels.map((level) =>
      polygonFor(() => level),
    );

    const axisLines = axes.map((axis, index) => {
      const outer = toPoint(100, index);
      const label = toPoint(100, index, 24);
      return {
        key: axis.key,
        x2: outer.x,
        y2: outer.y,
        labelX: label.x,
        labelY: label.y,
        label: axis.label,
      };
    });

    const axisValues = axes.map((axis) => ({
      key: axis.key,
      label: axis.label,
      current: Number(axis.current ?? 0),
      target: Number(axis.target ?? 0),
    }));

    const axisPoints = axisValues.map((axisValue, index) => {
      const currentPoint = toPoint(axisValue.current, index);
      const targetPoint = toPoint(axisValue.target, index);
      return {
        ...axisValue,
        currentPoint,
        targetPoint,
        gap: Math.max(0, axisValue.target - axisValue.current),
      };
    });

    return {
      center,
      ringPolygons,
      axisLines,
      currentPolygon,
      targetPolygon,
      axisValues,
      axisPoints,
    };
  }, [skillComparisonRows]);

  const particles = useMemo(
    () =>
      Array.from({ length: 20 }, (_, i) => ({
        id: i,
        left: `${(i * 19) % 100}%`,
        top: `${(i * 11) % 100}%`,
        size: 2 + (i % 6),
        color: i % 2 ? 'rgba(123, 104, 238, 0.4)' : 'rgba(0, 198, 255, 0.3)',
        delay: `${(i % 10) * 0.5}s`,
        duration: `${15 + (i % 10)}s`,
      })),
    [],
  );

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  // The Dashboard shows memory strength from the student's real quiz attempts.
  useEffect(() => {
    if (activePage !== 'dashboard') return;
    studyApi.get('/api/retention').then(setMemoryStats).catch(() => setMemoryStats(null));
  }, [activePage]);

  useEffect(() => {
    const syncPageFromHash = () => {
      const hash = (window.location.hash || '').replace(/^#/, '').trim().toLowerCase();

      if (!hash) {
        setActivePage('home');
        return;
      }

      if (hash.startsWith('roadmap-phase-')) {
        setActivePage('roadmap');

        setTimeout(() => {
          const target = document.getElementById(hash);
          if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 80);
        return;
      }

      if (hashRoutes.includes(hash)) {
        setActivePage(hash);
      }
    };

    syncPageFromHash();
    window.addEventListener('hashchange', syncPageFromHash);
    return () => window.removeEventListener('hashchange', syncPageFromHash);
  }, []);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/roles`)
      .then((response) => parseApiResponse(response, 'Failed to load roles.'))
      .then((data) => {
        if (Array.isArray(data)) {
          setAvailableRoles(data);
        }
      })
      .catch(() => {
        setAvailableRoles([]);
      });
  }, []);

  useEffect(() => {
    if (!profileSubmitted) {
      return;
    }

    if (!['analysis', 'roadmap', 'dashboard'].includes(activePage)) {
      return;
    }

    const timer = setTimeout(() => {
      runAnalysis(selectedRole);
      requestAiAdvisor(selectedRole);
    }, 250);

    return () => clearTimeout(timer);
  }, [
    activePage,
    selectedRole,
    profileSubmitted,
    skills,
    interests,
    completedCourses,
    projects,
    resumeText,
    resumeFileName,
    studentName,
    email,
  ]);

  useEffect(() => {
    setActivePlayerVideoIndex(0);
  }, [activePlayerModuleIndex]);

  useEffect(() => {
    if (activePage !== 'roadmap-player') {
      return;
    }

    try {
      const raw = window.localStorage.getItem(ROADMAP_PLAYER_STORAGE_KEY)
        || window.localStorage.getItem(LEGACY_ROADMAP_PLAYER_STORAGE_KEY);
      if (!raw) {
        setPlayerData(null);
        return;
      }

      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.modules) || !parsed.modules.length) {
        setPlayerData(null);
        return;
      }

      setPlayerData(parsed);
      setActivePlayerModuleIndex(0);
      setActivePlayerVideoIndex(0);
    } catch {
      setPlayerData(null);
    }
  }, [activePage]);

  useEffect(() => {
    if (!roadmapCourseOptions.length) {
      setSelectedRoadmapCourse('');
      setRoadmapModules(null);
      return;
    }

    setSelectedRoadmapCourse((prev) => {
      if (prev && roadmapCourseOptions.some((item) => item.course === prev)) {
        return prev;
      }
      return roadmapCourseOptions[0].course;
    });

    setRoadmapModules(null);
    setRoadmapModulesError('');
  }, [selectedRole, roadmapCourseOptions]);

  const handleResumeUpload = async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setResumeUploadLoading(true);
    setResumeUploadError('');

    try {
      const formData = new FormData();
      formData.append('resume', file);

      const response = await fetch(`${API_BASE_URL}/api/resume/parse`, {
        method: 'POST',
        body: formData,
      });

      const data = await parseApiResponse(response, 'Failed to parse resume.');
      if (!response.ok) {
        throw new Error(data.error || 'Failed to parse resume.');
      }

      setResumeFileName(data.fileName || file.name);
      setResumeText(data.text || '');
    } catch (error) {
      setResumeUploadError(error.message || 'Failed to parse resume.');
      setResumeFileName(file.name);
      setResumeText('');
    } finally {
      setResumeUploadLoading(false);
      event.target.value = '';
    }
  };

  const navigate = (page) => {
    setActivePage(page);
    setMobileOpen(false);
    setCareerMenuOpen(false);

    if ((window.location.hash || '') !== `#${page}`) {
      window.location.hash = page;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleInterest = (name) => {
    setInterests((prev) => (prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]));
  };

  const submitSignIn = async (event) => {
    event.preventDefault();
    const normalizedEmail = signInEmail.trim();

    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setSignInError('Enter a valid email address.');
      return;
    }

    if (signInPassword.length < 6) {
      setSignInError('Password must be at least 6 characters.');
      return;
    }

    if (authMode === 'register' && signInPassword !== signInConfirmPassword) {
      setSignInError('Passwords do not match.');
      return;
    }

    setSignInLoading(true);
    setSignInError('');
    setSignInMessage('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/${authMode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password: signInPassword }),
      });
      const data = await parseApiResponse(response, 'Unable to complete authentication.');
      if (response.status === 409 && authMode === 'register') {
        setAuthMode('login');
        setSignInPassword('');
        setSignInConfirmPassword('');
        setSignInError('');
        setSignInMessage('This email is already registered. Sign in with your existing password.');
        return;
      }
      if (!response.ok) {
        throw new Error(data.error || 'Unable to complete authentication.');
      }

      if (authMode === 'register') {
        setAuthMode('login');
        setSignInPassword('');
        setSignInConfirmPassword('');
        setSignInMessage('Account created. Sign in with your new account.');
      } else {
        setSignedInEmail(data.user?.email || normalizedEmail);
        setStudyUser(data.user?.email || normalizedEmail);
        setSignInOpen(false);
        setSignInPassword('');
      }
    } catch (error) {
      const message = error instanceof TypeError
        ? 'Unable to reach the backend. Start the backend with npm start in the backend folder.'
        : error.message;
      setSignInError(message || 'Unable to complete authentication.');
    } finally {
      setSignInLoading(false);
    }
  };

  const updateSkill = (key, value) => setSkills((prev) => ({ ...prev, [key]: Number(value) }));

  const submitProfile = async (e) => {
    e.preventDefault();

    setAnalysisError('');

    try {
      await saveProfilePayload(recommendedRole);
    } catch (error) {
      console.error('Profile save failed:', error.message || error);
    }

    setProfileSubmitted(true);
    setAnalysisResult(null);
    setSelectedRole(recommendedRole);
    navigate('analysis');
  };

  const onHome = activePage === 'home';
  const navIdle = 'text-slate-600';

  return (
    <div className="theme-green gradient-bg min-h-screen overflow-auto text-white">
      <div className={`loading-screen ${loading ? '' : 'hidden'}`}>
        <div className="text-center">
          <div className="ai-loader mx-auto mb-6" />
          <h2 className="glow-text text-2xl font-bold">Starting your study agents</h2>
          <p className="mt-2 text-gray-400">Preparing your personal study assistant...</p>
        </div>
      </div>

      <div className="neural-network" id="particles">
        {particles.map((p) => (
          <span
            key={p.id}
            className="particle"
            style={{
              left: p.left,
              top: p.top,
              width: p.size,
              height: p.size,
              background: p.color,
              animationDelay: p.delay,
              animationDuration: p.duration,
            }}
          />
        ))}
      </div>

      <nav className={`fixed left-0 right-0 top-0 z-50 px-4 py-2.5 sm:px-6 sm:py-4 home-nav border-b border-emerald-900/10 bg-white/95 text-slate-800 shadow-sm backdrop-blur`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl !text-white bg-[#157a4a] sm:h-10 sm:w-10`}>
              <Brain className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <span className="whitespace-nowrap text-base font-bold sm:text-xl">
              Student Study <span className={'text-[#157a4a]'}>Agent</span>
            </span>
          </div>
          <div className="hidden items-center gap-5 xl:flex">
            {studyPages.map((page) => (
              <button
                key={page}
                className={`nav-link text-sm font-medium ${activePage === page ? 'active' : navIdle}`}
                onClick={() => navigate(page)}
              >
                {pageLabels[page]}
              </button>
            ))}
            <div className="relative">
              <button
                type="button"
                className={`nav-link flex items-center gap-1 text-sm font-medium ${careerPages.includes(activePage) ? 'active' : navIdle}`}
                onClick={() => setCareerMenuOpen((open) => !open)}
                aria-expanded={careerMenuOpen}
              >
                Career <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {careerMenuOpen ? (
                <div className={`absolute right-0 top-9 z-50 w-44 rounded-xl border p-2 border-slate-200 bg-white shadow-lg`}>
                  {careerPages.map((page) => (
                    <button
                      key={page}
                      type="button"
                      className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${activePage === page ? 'bg-cyan-400/15 text-cyan-100' : 'text-slate-600 hover:bg-emerald-50'}`}
                      onClick={() => navigate(page)}
                    >
                      {pageLabels[page]}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition bg-[#157a4a] !text-white hover:bg-[#11653d]`}
              onClick={() => setSignInOpen(true)}
            >
              <LogIn className="h-4 w-4" />
              {signedInEmail ? signedInEmail : 'Sign In'}
            </button>
          </div>
          <button
            type="button"
            className={`p-1 xl:hidden text-slate-800`}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </nav>

      {mobileOpen ? (
        <div className="mobile-menu native-green fixed inset-x-0 bottom-0 top-[57px] z-40 overflow-y-auto overscroll-contain bg-white p-4 text-slate-800 sm:top-[73px] xl:hidden">
          {[['Study agents', studyPages], ['Career', careerPages]].map(([title, group]) => (
            <div key={title} className="mb-5">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">{title}</p>
              <div className="grid grid-cols-2 gap-2">
                {group.map((page) => (
                  <button
                    key={page}
                    type="button"
                    className={`rounded-xl border px-3 py-3 text-left text-sm font-medium ${activePage === page ? 'border-[#157a4a] bg-emerald-50 text-[#0f3d2b]' : 'border-slate-200'}`}
                    onClick={() => navigate(page)}
                  >
                    {pageLabels[page]}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button
            type="button"
            className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold bg-[#157a4a] text-white`}
            onClick={() => {
              setMobileOpen(false);
              setSignInOpen(true);
            }}
          >
            <LogIn className="h-4 w-4 shrink-0" />
            <span className="truncate">{signedInEmail ? signedInEmail : 'Sign In'}</span>
          </button>
        </div>
      ) : null}

      <nav aria-label="Main sections" className="mobile-tabs fixed inset-x-0 bottom-0 z-50 flex border-t border-emerald-900/10 bg-white/95 text-slate-600 backdrop-blur md:hidden">
        {mobileTabs.map(([page, Icon]) => (
          <button
            key={page}
            type="button"
            aria-current={activePage === page ? 'page' : undefined}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${activePage === page && !mobileOpen ? 'text-[#157a4a]' : ''}`}
            onClick={() => navigate(page)}
          >
            <Icon className="h-5 w-5" />
            {pageLabels[page]}
          </button>
        ))}
        <button
          type="button"
          aria-expanded={mobileOpen}
          className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${mobileOpen || !mobileTabs.some(([page]) => page === activePage) ? 'text-[#157a4a]' : ''}`}
          onClick={() => setMobileOpen((v) => !v)}
        >
          <Menu className="h-5 w-5" />
          More
        </button>
      </nav>

      <main className={`relative z-10 ${onHome ? '' : 'pt-16 sm:pt-20'}`}>
        <section className={`page ${activePage === 'roadmap-player' ? 'active' : ''}`}>
          <div className="min-h-screen px-6 py-8">
            <div className="mx-auto max-w-7xl">
              <div className="mb-6 rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4">
                <p className="text-sm font-semibold text-cyan-100">AI Learning Player</p>
                <p className="text-xs text-gray-300">
                  {playerData?.selectedCourse
                    ? `Course: ${playerData.selectedCourse} | Role: ${playerData.roleName || selectedRole}`
                    : 'Generate modules from Roadmap page to start this player view.'}
                </p>
              </div>

              {!playerModules.length ? (
                <div className="rounded-2xl border border-amber-300/30 bg-amber-500/10 p-5 text-sm text-amber-100">
                  No modules loaded for player view. Go to Roadmap and press Start Learning.
                </div>
              ) : (
                <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
                  <aside className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="mb-3 text-xs uppercase tracking-wide text-cyan-200">Modules</p>
                    <div className="space-y-4">
                      {groupedPlayerModules.map((group) => (
                        <div key={group.phaseLabel}>
                          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-cyan-300">{group.phaseLabel}</p>
                          <div className="space-y-2">
                            {group.items.map(({ moduleItem, index }) => (
                              <button
                                key={`${moduleItem.title}-${index}`}
                                type="button"
                                onClick={() => {
                                  setActivePlayerModuleIndex(index);
                                  setActivePlayerVideoIndex(0);
                                }}
                                className={`w-full rounded-xl border px-3 py-2 text-left text-xs transition ${
                                  index === activePlayerModuleIndex
                                    ? 'border-cyan-300/50 bg-cyan-500/20 text-cyan-100'
                                    : 'border-white/10 bg-white/5 text-gray-200 hover:border-cyan-300/30 hover:bg-cyan-500/10'
                                }`}
                              >
                                <p className="font-semibold">{moduleItem.title}</p>
                                {moduleItem.objective ? <p className="mt-1 text-[11px] text-gray-300">{moduleItem.objective}</p> : null}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </aside>

                  <div className="space-y-4">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-sm font-semibold text-cyan-100">{activePlayerModule?.title || 'Selected Module'}</p>
                      {activePlayerModule?.objective ? (
                        <p className="mt-1 text-xs text-gray-300">{activePlayerModule.objective}</p>
                      ) : null}

                      {playableVideos.length ? (
                        <>
                          <div className="mt-3 overflow-hidden rounded-xl border border-cyan-300/20">
                            <iframe
                              key={`${activePlayerModuleIndex}-${activePlayerVideoIndex}-${activePlayerVideo?.url || 'no-video'}`}
                              src={toEmbeddedVideoSrc(activePlayerVideo?.url || '', activePlayerVideo?.title || '') || ''}
                              title={activePlayerVideo?.title || 'Learning video'}
                              className="h-[420px] w-full"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                              referrerPolicy="strict-origin-when-cross-origin"
                              allowFullScreen
                            />
                          </div>

                          <div className="mt-3 grid gap-2 md:grid-cols-2">
                            {playableVideos.map((video, idx) => (
                              <button
                                key={`${video.url}-${idx}`}
                                type="button"
                                onClick={() => setActivePlayerVideoIndex(idx)}
                                className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
                                  idx === activePlayerVideoIndex
                                    ? 'border-cyan-300/50 bg-cyan-500/20 text-cyan-100'
                                    : 'border-white/10 bg-white/5 text-gray-200 hover:border-cyan-300/30 hover:bg-cyan-500/10'
                                }`}
                              >
                                <p className="font-semibold">{video.title}</p>
                                {video.reason ? <p className="mt-1 text-[11px] text-gray-300">{video.reason}</p> : null}
                              </button>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="mt-3 rounded-xl border border-amber-300/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
                          No embeddable direct video found for this module. Regenerate modules for direct video links.
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4">
                      <p className="mb-2 text-sm font-semibold text-emerald-100">Transcript</p>
                      <div className="space-y-2 text-xs text-emerald-50">
                        {activePlayerTranscript.map((line, idx) => (
                          <p key={`${line}-${idx}`}>
                            <span className="mr-2 inline-block rounded-full border border-emerald-300/35 px-2 py-0.5 text-[10px] text-emerald-200">
                              {String(idx * 3).padStart(2, '0')}:00
                            </span>
                            {line}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className={`page ${activePage === 'home' ? 'active' : ''}`}>
          <HomeLanding
            navigate={navigate}
            onSignIn={() => setSignInOpen(true)}
            journeySteps={homeJourneySteps}
            pageLabels={pageLabels}
            studyPages={studyPages}
            careerPages={careerPages}
          />
        </section>

        <section className={`page ${activePage === 'goal' ? 'active' : ''}`}>
          <CareerGoal navigate={navigate} roleCards={roleCards} selectedRole={selectedRole} setSelectedRole={setSelectedRole} />
        </section>

        <section className={`page ${activePage === 'profile' ? 'active' : ''}`}>
          <div className="min-h-screen px-6 py-12">
            <div className="mx-auto max-w-4xl">
              <div className="page-header mb-12 text-center scroll-animate visible">
                <h2 className="glow-text text-4xl font-black">Build Your Skill Profile</h2>
                <p className="mt-2 text-gray-400">Tell us about your technical skills, projects, and interests</p>
              </div>
              <form className="glass-card scroll-animate visible rounded-3xl p-8" onSubmit={submitProfile}>
                <div className="mb-8">
                  <h3 className="mb-4 flex items-center gap-2 text-xl font-bold"><User className="h-5 w-5 text-cyan-400" /> Personal Information</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm text-gray-400">Full Name</label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
                        <input
                          className="input-field w-full rounded-xl py-3 pl-12 pr-4 text-white"
                          placeholder="Enter your name"
                          value={studentName}
                          onChange={(e) => setStudentName(e.target.value)}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm text-gray-400">Email</label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
                        <input
                          className="input-field w-full rounded-xl py-3 pl-12 pr-4 text-white"
                          placeholder="your@email.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mb-8">
                  <h3 className="mb-4 flex items-center gap-2 text-xl font-bold"><Code className="h-5 w-5 text-purple-400" /> Technical Skills</h3>
                  {[
                    ['python', 'Python', 'text-cyan-400'],
                    ['ml', 'Machine Learning', 'text-purple-400'],
                    ['stats', 'Statistics', 'text-pink-400'],
                    ['dl', 'Deep Learning', 'text-green-400'],
                    ['sql', 'SQL/Databases', 'text-yellow-400'],
                  ].map(([key, label, color]) => (
                    <div key={key} className="mb-4">
                      <div className="mb-2 flex justify-between">
                        <span>{label}</span>
                        <span className={color}>{skills[key]}%</span>
                      </div>
                      <input type="range" min="0" max="100" value={skills[key]} onChange={(e) => updateSkill(key, e.target.value)} className="w-full" />
                    </div>
                  ))}
                </div>

                <div className="mb-8">
                  <h3 className="mb-4 flex items-center gap-2 text-xl font-bold"><BookOpen className="h-5 w-5 text-cyan-400" /> Completed Courses</h3>
                  <textarea
                    className="input-field min-h-24 w-full rounded-xl px-4 py-3 text-white"
                    placeholder="List your completed courses"
                    value={completedCourses}
                    onChange={(e) => setCompletedCourses(e.target.value)}
                  />
                </div>

                <div className="mb-8">
                  <h3 className="mb-4 flex items-center gap-2 text-xl font-bold"><FolderGit2 className="h-5 w-5 text-purple-400" /> Projects</h3>
                  <textarea
                    className="input-field min-h-24 w-full rounded-xl px-4 py-3 text-white"
                    placeholder="Describe your projects"
                    value={projects}
                    onChange={(e) => setProjects(e.target.value)}
                  />
                </div>

                <div className="mb-8">
                  <h3 className="mb-4 flex items-center gap-2 text-xl font-bold"><FileText className="h-5 w-5 text-cyan-300" /> Resume</h3>
                  <label className="mb-3 flex cursor-pointer items-center justify-between rounded-2xl border border-cyan-400/25 bg-cyan-500/5 px-4 py-4 transition hover:border-cyan-300/50 hover:bg-cyan-500/10">
                    <div>
                      <p className="text-sm font-semibold text-cyan-100">Upload your resume</p>
                      <p className="text-xs text-gray-400">PDF, TXT, or MD files are supported for AI analysis.</p>
                    </div>
                    <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 px-3 py-1 text-xs text-cyan-100">
                      <Upload className="h-4 w-4" /> Choose File
                    </span>
                    <input type="file" accept=".pdf,.txt,.md,text/plain,application/pdf,text/markdown" className="hidden" onChange={handleResumeUpload} />
                  </label>

                  {resumeUploadLoading ? <p className="mb-3 text-sm text-cyan-200">Extracting text from your resume...</p> : null}
                  {resumeUploadError ? (
                    <div className="mb-3 rounded-xl border border-amber-300/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                      {resumeUploadError}
                    </div>
                  ) : null}
                  {resumeFileName ? (
                    <div className="mb-3 inline-flex rounded-full border border-violet-300/30 bg-violet-500/10 px-3 py-1 text-xs text-violet-100">
                      Resume loaded: {resumeFileName}
                    </div>
                  ) : null}

                  <textarea
                    className="input-field min-h-32 w-full rounded-xl px-4 py-3 text-white"
                    placeholder="Paste resume text here or upload a supported file so the AI can analyze your experience."
                    value={resumeText}
                    onChange={(e) => setResumeText(e.target.value)}
                  />
                  <p className="mt-2 text-xs text-gray-400">This text is sent to the AI advisor to personalize what to learn, what to do next, and which videos to watch.</p>
                </div>

                <div className="mb-8">
                  <h3 className="mb-4 flex items-center gap-2 text-xl font-bold"><Heart className="h-5 w-5 text-pink-400" /> Career Interests</h3>
                  <div className="flex flex-wrap gap-3">
                    {['AI/ML', 'Data Science', 'Web Dev', 'IoT', 'Cloud', 'Security'].map((tag) => (
                      <button
                        type="button"
                        key={tag}
                        onClick={() => toggleInterest(tag)}
                        className={`skill-tag glass rounded-full px-4 py-2 text-sm ${interests.includes(tag) ? 'border border-purple-400 bg-purple-500/30' : ''}`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-6 rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
                  Best-fit role (auto-picked from your skills and interests):
                  <span className="ml-2 font-semibold text-white">{recommendedRole}</span>
                </div>

                <button type="submit" className="btn-primary w-full rounded-xl py-4 font-semibold">
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    <Sparkles className="h-5 w-5" /> Analyze My Skills
                  </span>
                </button>
              </form>
            </div>
          </div>
        </section>

        <section className={`page ${activePage === 'roles' ? 'active' : ''}`}>
          <div className="min-h-screen px-6 py-12">
            <div className="mx-auto max-w-6xl">
              <div className="page-header mb-12 text-center scroll-animate visible">
                <h2 className="glow-text text-4xl font-black">Industry Role Explorer</h2>
                <p className="mt-2 text-gray-400">Discover career paths and their skill requirements</p>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                {roleCards.map((role) => {
                  const Icon = role.icon;
                  return (
                    <div key={role.name} className="glass-card scroll-animate visible rounded-3xl p-6">
                      <div className="mb-6 flex items-start gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-400 to-cyan-400">
                          <Icon className="h-7 w-7" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold">{role.displayName || role.name}</h3>
                          <p className={`text-sm font-semibold ${role.demandTone || 'text-purple-300'}`}>{role.demand}</p>
                          <p className="mt-1 text-sm text-gray-400">{role.subtitle}</p>
                        </div>
                      </div>
                      <p className="mb-4 text-sm text-gray-200">{role.description}</p>
                      <div className="mb-4 space-y-1 text-sm">
                        <p className="text-gray-200"><span className="text-cyan-300">$</span> {role.salary}</p>
                        <p className="text-emerald-300">↗ {role.growth}</p>
                      </div>
                      <h4 className="mb-2 text-sm font-semibold text-gray-300">Required Skills</h4>
                      <div className="mb-4 flex flex-wrap gap-2">
                        {role.skills.slice(0, 4).map((s) => (
                          <span key={s} className="rounded-full bg-cyan-500/20 px-3 py-1 text-xs text-cyan-300">{s}</span>
                        ))}
                        {role.skills.length > 4 ? (
                          <span className="rounded-full border border-white/20 px-3 py-1 text-xs text-gray-200">+{role.skills.length - 4}</span>
                        ) : null}
                      </div>
                      <h4 className="mb-2 text-sm font-semibold text-gray-300">Tools and Technologies</h4>
                      <div className="flex flex-wrap gap-2">
                        {role.tools.map((t) => (
                          <span key={t} className="glass rounded-full px-3 py-1 text-xs">{t}</span>
                        ))}
                      </div>
                      <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
                        <div className="text-sm"><span className="text-gray-400">Avg Salary:</span> <span className="ml-1 font-semibold text-green-400">{role.salary}</span></div>
                        <button onClick={() => { setSelectedRole(role.name); navigate('analysis'); }} className="rounded-lg bg-cyan-500/20 px-4 py-2 text-sm font-medium text-cyan-300">Check Match →</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className={`page ${activePage === 'analysis' ? 'active' : ''}`}>
          <div className="min-h-screen px-6 py-12">
            <div className="mx-auto max-w-6xl">
              <div className="page-header mb-10 text-center scroll-animate visible">
                <h2 className="glow-text text-4xl font-black">Skill Gap Detection</h2>
                <p className="mt-2 text-gray-400">Comparing your profile for {selectedRoleLabel}</p>
                {analysisLoading ? <p className="mt-2 text-sm text-cyan-200">Updating analysis from backend...</p> : null}
                {analysisError ? <p className="mt-2 text-sm text-rose-300">{analysisError}</p> : null}
              </div>

              <div className="glass-card mb-8 rounded-2xl p-4 scroll-animate visible">
                <div className="flex flex-wrap justify-center gap-4">
                  {roleCards.map((r) => (
                    <button
                      key={r.name}
                      onClick={() => setSelectedRole(r.name)}
                      className={`rounded-xl px-6 py-3 font-medium transition-all ${selectedRole === r.name ? 'bg-cyan-500/20 text-cyan-300' : 'glass text-gray-300'}`}
                    >
                      {r.displayName || r.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-8 lg:grid-cols-2">
                <div className="glass-card rounded-3xl p-6 scroll-animate visible">
                  <h3 className="mb-6 flex items-center gap-2 text-xl font-bold"><BarChart3 className="h-5 w-5 text-cyan-400" /> Skill Comparison</h3>
                  {skillComparisonRows.map((item) => (
                    <div key={item.key} className="mb-5">
                      <div className="mb-2 flex justify-between">
                        <span>{item.name}</span>
                        <span className="text-sm text-gray-300">Your {item.current}% / Req {item.required}%</span>
                      </div>
                      <div className="progress-bar relative h-4 rounded-full">
                        <div className="progress-fill h-full rounded-full" style={{ width: `${item.current}%` }} />
                        <span className="absolute top-0 h-4 w-0.5 bg-white/50" style={{ left: `${item.required}%` }} />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="glass-card rounded-3xl p-6 scroll-animate visible">
                  <h3 className="mb-6 flex items-center gap-2 text-xl font-bold"><Radar className="h-5 w-5 text-purple-400" /> Skills Radar</h3>
                  <div className="radar-chart flex flex-col items-center gap-4 text-center text-sm text-gray-300">
                    <svg viewBox="0 0 320 320" className="w-full max-w-[360px] overflow-visible">
                      {radarChart.ringPolygons.map((points, idx) => (
                        <polygon
                          key={`ring-${idx}`}
                          points={points}
                          fill="none"
                          stroke="rgba(15,61,43,0.12)"
                          strokeWidth="1"
                        />
                      ))}

                      {radarChart.axisLines.map((line) => (
                        <g key={line.key}>
                          <line
                            x1={radarChart.center}
                            y1={radarChart.center}
                            x2={line.x2}
                            y2={line.y2}
                            stroke="rgba(15,61,43,0.18)"
                            strokeWidth="1"
                          />
                          <text
                            x={line.labelX}
                            y={line.labelY}
                            fill="#475569"
                            fontSize="10"
                            textAnchor="middle"
                          >
                            {line.label}
                          </text>
                        </g>
                      ))}

                      <polygon
                        points={radarChart.targetPolygon}
                        fill="rgba(100, 116, 139, 0.1)"
                        stroke="rgba(100,116,139,0.6)"
                        strokeWidth="2"
                        strokeDasharray="6 4"
                      />

                      <polygon
                        points={radarChart.currentPolygon}
                        fill="rgba(31, 157, 92, 0.22)"
                        stroke="#157a4a"
                        strokeWidth="2.5"
                      />

                      {radarChart.axisPoints.map((point) => (
                        <g key={`point-${point.key}`}>
                          <circle
                            cx={point.targetPoint.x}
                            cy={point.targetPoint.y}
                            r="7"
                            fill="rgba(100,116,139,0.15)"
                          />
                          <circle
                            cx={point.targetPoint.x}
                            cy={point.targetPoint.y}
                            r="4"
                            fill="#64748b"
                          />
                          <circle
                            cx={point.currentPoint.x}
                            cy={point.currentPoint.y}
                            r="8"
                            fill="rgba(31,157,92,0.18)"
                          />
                          <circle
                            cx={point.currentPoint.x}
                            cy={point.currentPoint.y}
                            r="4.5"
                            fill="#157a4a"
                          />
                          <circle
                            cx={point.currentPoint.x}
                            cy={point.currentPoint.y}
                            r="18"
                            fill="transparent"
                            onMouseEnter={() => setHoveredRadarSkill({ ...point, pointType: 'current' })}
                            onMouseLeave={() => setHoveredRadarSkill(null)}
                          />
                          <circle
                            cx={point.targetPoint.x}
                            cy={point.targetPoint.y}
                            r="18"
                            fill="transparent"
                            onMouseEnter={() => setHoveredRadarSkill({ ...point, pointType: 'target' })}
                            onMouseLeave={() => setHoveredRadarSkill(null)}
                          />
                        </g>
                      ))}

                      {hoveredRadarSkill ? (
                        <g pointerEvents="none">
                          <rect
                            x={
                              (hoveredRadarSkill.pointType === 'current'
                                ? hoveredRadarSkill.currentPoint.x
                                : hoveredRadarSkill.targetPoint.x) - 38
                            }
                            y={
                              (hoveredRadarSkill.pointType === 'current'
                                ? hoveredRadarSkill.currentPoint.y
                                : hoveredRadarSkill.targetPoint.y) - 28
                            }
                            width="76"
                            height="22"
                            rx="6"
                            fill="rgba(255,255,255,0.98)"
                            stroke={hoveredRadarSkill.pointType === 'current' ? '#157a4a' : 'rgba(100,116,139,0.7)'}
                            strokeWidth="1"
                          />
                          <text
                            x={
                              hoveredRadarSkill.pointType === 'current'
                                ? hoveredRadarSkill.currentPoint.x
                                : hoveredRadarSkill.targetPoint.x
                            }
                            y={
                              (hoveredRadarSkill.pointType === 'current'
                                ? hoveredRadarSkill.currentPoint.y
                                : hoveredRadarSkill.targetPoint.y) - 13
                            }
                            fill={hoveredRadarSkill.pointType === 'current' ? '#157a4a' : '#334155'}
                            fontSize="11"
                            textAnchor="middle"
                          >
                            {hoveredRadarSkill.pointType === 'current' ? hoveredRadarSkill.current : hoveredRadarSkill.target}%
                          </text>
                        </g>
                      ) : null}
                    </svg>

                    <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
                      <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-500/10 px-3 py-1 text-cyan-100">
                        <span className="h-2 w-2 rounded-full bg-cyan-300" /> Your Profile
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-gray-100">
                        <span className="h-2 w-2 rounded-full bg-white/80" /> Role Target ({selectedRoleLabel})
                      </span>
                    </div>

                    <div className="w-full rounded-xl border border-cyan-300/20 bg-cyan-500/5 p-3 text-left text-xs">
                      {hoveredRadarSkill ? (
                        <div className="space-y-1">
                          <p className="font-semibold text-cyan-100">{hoveredRadarSkill.label}</p>
                          {hoveredRadarSkill.pointType === 'current' ? (
                            <p className="text-gray-300">Hovering your profile point</p>
                          ) : (
                            <p className="text-gray-300">Hovering target point for {selectedRoleLabel}</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-gray-300">Tap or hover cyan or white points to see the exact % on radar.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 grid gap-8 lg:grid-cols-2">
                <div className="glass-card rounded-3xl p-6 scroll-animate visible">
                  <h3 className="mb-4 flex items-center gap-2 text-xl font-bold">
                    <AlertTriangle className="h-5 w-5 text-amber-300" />
                    Mistakes / Gaps Detected
                  </h3>
                  {analysisInsights.weak.length ? (
                    <div className="space-y-4">
                      {analysisInsights.weak.map((item) => (
                        <div key={item.key} className="rounded-xl border border-white/10 bg-white/5 p-3">
                          <div className="mb-2 flex items-center justify-between text-sm">
                            <span className="font-medium">{item.skill}</span>
                            <span className="text-rose-300">Gap: {item.gap}%</span>
                          </div>
                          <div className="progress-bar h-2 rounded-full">
                            <div className="h-full rounded-full bg-rose-400/70" style={{ width: `${Math.min(item.gap, 100)}%` }} />
                          </div>
                          <p className="mt-2 text-xs text-gray-300">Current {item.current}% vs Required {item.required}%</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-emerald-300">No major mistakes found for this role. Great match.</p>
                  )}

                  {analysisInsights.strong.length ? (
                    <div className="mt-5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3">
                      <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-200">
                        <CheckCircle2 className="h-4 w-4" /> Strong Areas
                      </p>
                      <p className="text-xs text-emerald-100/90">
                        {analysisInsights.strong.map((item) => item.skill).join(', ')}
                      </p>
                    </div>
                  ) : null}
                </div>

                <div className="glass-card rounded-3xl p-6 scroll-animate visible">
                  <h3 className="mb-4 flex items-center gap-2 text-xl font-bold">
                    <BookOpen className="h-5 w-5 text-cyan-300" />
                    What to Learn Next
                  </h3>
                  {aiAdvisor?.roadmapEnhancements?.length ? (
                    <div className="mb-4 rounded-xl border border-violet-400/25 bg-violet-500/10 p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-violet-200">AI Roadmap Suggestions</p>
                      <div className="space-y-2">
                        {aiAdvisor.roadmapEnhancements.slice(0, 3).map((item) => (
                          <p key={item} className="text-xs text-violet-100">• {item}</p>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {aiAdvisor?.nextActions?.length ? (
                    <div className="mb-4 rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-200">What To Do Next</p>
                      <div className="space-y-2">
                        {aiAdvisor.nextActions.slice(0, 4).map((item) => (
                          <p key={item} className="text-xs text-emerald-100">• {item}</p>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {aiAdvisor?.learningVideos?.length ? (
                    <div className="mb-4 rounded-xl border border-cyan-400/25 bg-cyan-500/10 p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-cyan-200">Video Links To Learn</p>
                      <div className="space-y-3">
                        {aiAdvisor.learningVideos.slice(0, 3).map((video) => (
                          <a
                            key={video.url}
                            href={video.url}
                            target="_blank"
                            rel="noreferrer"
                            className="block rounded-xl border border-cyan-300/20 bg-slate-950/30 p-3 transition hover:border-cyan-300/40 hover:bg-slate-950/50"
                          >
                            <p className="text-sm font-semibold text-cyan-100">{video.title}</p>
                            {video.reason ? <p className="mt-1 text-xs text-gray-300">{video.reason}</p> : null}
                            <p className="mt-2 text-xs text-cyan-200 underline underline-offset-2">Open learning video</p>
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="space-y-3">
                    {analysisInsights.recommendedLearnings.map((item) => (
                      <div key={item.title} className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-3">
                        <div className="mb-1 flex items-center justify-between">
                          <p className="text-sm font-semibold text-cyan-100">{item.title}</p>
                          <span className="rounded-full border border-cyan-300/40 px-2 py-0.5 text-xs text-cyan-200">{item.priority}</span>
                        </div>
                        <p className="text-xs text-gray-300">{item.details}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5">
                    <p className="mb-3 text-sm font-semibold text-gray-200">Role Match Visualization</p>
                    <div className="space-y-2">
                      {analysisInsights.roleFit.map((item) => (
                        <div key={item.role}>
                          <div className="mb-1 flex items-center justify-between text-xs">
                              <span>{roleDisplayName(item.role)}</span>
                            <span className="text-cyan-200">{item.score}%</span>
                          </div>
                          <div className="progress-bar h-2 rounded-full">
                            <div className="progress-fill h-full rounded-full" style={{ width: `${item.score}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 text-center">
                <button className="btn-primary rounded-xl px-8 py-4 font-semibold" onClick={() => navigate('roadmap')}>
                  <span className="relative z-10 flex items-center gap-2"><Route className="h-5 w-5" /> Generate Learning Roadmap</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className={`page ${activePage === 'roadmap' ? 'active' : ''}`}>
          <div className="min-h-screen px-6 py-12">
            <div className="mx-auto max-w-4xl">
              <div className="page-header mb-12 text-center scroll-animate visible">
                <h2 className="glow-text text-4xl font-black">Your Learning Roadmap</h2>
                <p className="mt-2 text-gray-400">Personalized path to becoming a {selectedRoleLabel}</p>
              </div>
              <div className="mb-8 grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm md:grid-cols-2">
                {roadmapItems.map((item, index) => (
                  <a key={item.title} href={`#roadmap-phase-${index + 1}`} className="rounded-lg border border-cyan-300/20 bg-cyan-500/5 px-3 py-2 text-cyan-100 transition hover:bg-cyan-500/15">
                    {item.phase}
                  </a>
                ))}
              </div>

              <div className="mb-8 rounded-2xl border border-cyan-300/25 bg-cyan-500/10 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-cyan-100">AI Roadmap Modules</p>
                    <p className="text-xs text-gray-300">Select a course and press Start Learning to generate modules, video lessons, and tasks.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
                  <select
                    className="input-field w-full min-w-0 rounded-xl px-3 py-2 text-sm text-white"
                    value={selectedRoadmapCourse}
                    onChange={(e) => setSelectedRoadmapCourse(e.target.value)}
                  >
                    {roadmapCourseOptions.map((item) => (
                      <option key={`${item.phase}-${item.course}`} value={item.course}>
                        {item.course} ({item.phase})
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={requestRoadmapModules}
                    disabled={roadmapModulesLoading || !selectedRoadmapCourse}
                    className="rounded-xl border border-cyan-300/35 bg-cyan-500/20 px-4 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {roadmapModulesLoading ? 'Generating Modules...' : 'Start Learning'}
                  </button>
                </div>

                {roadmapModulesError ? (
                  <p className="mt-3 rounded-lg border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">{roadmapModulesError}</p>
                ) : null}

                {roadmapModules?.summary ? (
                  <p className="mt-3 text-xs text-cyan-100">{roadmapModules.summary}</p>
                ) : null}

                {roadmapModules?.modules?.length ? (
                  <div className="mt-4 space-y-3">
                    {roadmapModules.modules.map((moduleItem) => (
                      <div key={moduleItem.title} className="rounded-xl border border-cyan-300/20 bg-slate-950/30 p-3">
                        <p className="text-sm font-semibold text-cyan-100">{moduleItem.title}</p>
                        {moduleItem.objective ? <p className="mt-1 text-xs text-gray-300">{moduleItem.objective}</p> : null}

                        {moduleItem.tasks?.length ? (
                          <div className="mt-2 space-y-1">
                            {moduleItem.tasks.slice(0, 3).map((task) => (
                              <p key={task} className="text-xs text-emerald-100">• {task}</p>
                            ))}
                          </div>
                        ) : null}

                        {moduleItem.videos?.length ? (
                          <div className="mt-2 space-y-2">
                            {moduleItem.videos.slice(0, 2).map((video, index) => {
                              const embedSrc = toEmbeddedVideoSrc(video.url, video.title);

                              return (
                                <div
                                  key={`${video.url}-${index}`}
                                  className="rounded-lg border border-cyan-300/20 bg-cyan-500/10 p-2"
                                >
                                  <p className="text-xs font-semibold text-cyan-100">{video.title}</p>
                                  {video.reason ? <p className="mt-1 text-[11px] text-gray-300">{video.reason}</p> : null}

                                  {embedSrc ? (
                                    <div className="mt-2 overflow-hidden rounded-md border border-cyan-300/25">
                                      <iframe
                                        src={embedSrc}
                                        title={`${moduleItem.title} video ${index + 1}`}
                                        className="h-48 w-full"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                        referrerPolicy="strict-origin-when-cross-origin"
                                        allowFullScreen
                                      />
                                    </div>
                                  ) : null}

                                  <a
                                    href={video.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-2 inline-block text-[11px] text-cyan-200 underline underline-offset-2"
                                  >
                                    Open in new tab
                                  </a>
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="relative">
                <div className="absolute bottom-0 left-4 top-0 w-0.5 sm:left-8 bg-gradient-to-b from-cyan-400 via-purple-400 to-pink-400" />
                <div className="space-y-8">
                  {roadmapItems.map((item, i) => (
                    <div id={`roadmap-phase-${i + 1}`} key={item.title} className="timeline-item relative pl-10 sm:pl-20" style={{ animationDelay: `${0.1 + i * 0.1}s` }}>
                      <div className="absolute left-2 z-10 h-5 w-5 rounded-full border-4 sm:left-6 border-slate-900 bg-cyan-400" />
                      <div className="glass-card rounded-2xl p-6">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-xs text-cyan-300">{item.phase}</span>
                          <span className="rounded-full border border-purple-300/25 bg-purple-500/10 px-2 py-0.5 text-xs text-purple-200">{item.duration}</span>
                        </div>
                        <h3 className="mt-3 text-xl font-bold">{item.title}</h3>
                        <p className="mt-2 text-sm text-gray-300">{item.topics}</p>

                        <div className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-500/10 p-3">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-200">Expected Outcomes</p>
                          <div className="space-y-1 text-xs text-emerald-100/90">
                            {item.outcomes?.map((outcome) => (
                              <p key={outcome}>• {outcome}</p>
                            ))}
                          </div>
                        </div>

                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/5 p-3">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-cyan-200">Recommended Courses</p>
                            <div className="flex flex-wrap gap-2">
                              {item.courses.map((course) => (
                                <span key={course} className="rounded-full border border-cyan-300/30 px-2 py-1 text-xs text-cyan-100">
                                  {course}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="rounded-xl border border-purple-400/20 bg-purple-500/5 p-3">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-purple-200">Recommended Projects</p>
                            <div className="flex flex-wrap gap-2">
                              {item.projects.map((project) => (
                                <span key={project} className="rounded-full border border-purple-300/30 px-2 py-1 text-xs text-purple-100">
                                  {project}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-200">Recommended Platforms to Practice</p>
                          <div className="flex flex-wrap gap-2">
                            {item.platforms?.map((platform) => (
                              <span key={platform} className="rounded-full border border-white/20 px-3 py-1 text-xs text-gray-100">{platform}</span>
                            ))}
                          </div>
                        </div>

                        <div className="mt-4 rounded-xl border border-cyan-300/20 bg-cyan-500/5 p-3">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-cyan-100">Learning Links</p>
                          <div className="space-y-2 text-sm">
                            {item.resources?.map((resource) => (
                              <a key={resource.url} href={resource.url} target="_blank" rel="noreferrer" className="block text-cyan-200 underline decoration-cyan-400/50 underline-offset-2 hover:text-cyan-100">
                                {resource.label}
                              </a>
                            ))}
                          </div>
                        </div>

                        {item.videos?.length ? (
                          <div className="mt-4 rounded-xl border border-cyan-300/20 bg-slate-950/30 p-3">
                            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-cyan-100">Video Lessons</p>
                            <div className="grid gap-3 md:grid-cols-2">
                              {item.videos.map((vid, vi) => {
                                const embedSrc = toEmbeddedVideoSrc(vid.url, vid.title);
                                return (
                                  <div key={`${vid.url}-${vi}`} className="rounded-lg border border-cyan-300/20 bg-cyan-500/10 p-2">
                                    <p className="mb-2 text-xs font-semibold text-cyan-100">{vid.title}</p>
                                    {embedSrc ? (
                                      <div className="overflow-hidden rounded-md border border-cyan-300/25">
                                        <iframe
                                          src={embedSrc}
                                          title={vid.title}
                                          className="h-40 w-full"
                                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                          referrerPolicy="strict-origin-when-cross-origin"
                                          allowFullScreen
                                        />
                                      </div>
                                    ) : null}
                                    <a
                                      href={vid.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="mt-2 inline-block text-[11px] text-cyan-200 underline underline-offset-2"
                                    >
                                      Open in new tab
                                    </a>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 glass-card rounded-2xl p-6">
                <h3 className="mb-4 flex items-center gap-2 text-xl font-bold">
                  <Award className="h-5 w-5 text-yellow-300" />
                  Recommended Certifications for {selectedRoleLabel}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {recommendedCertifications.map((cert) => (
                    <span key={cert} className="rounded-full border border-yellow-300/30 bg-yellow-400/10 px-3 py-1 text-xs text-yellow-100">
                      {cert}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={`page ${activePage === 'agent' ? 'active' : ''}`}>
          <AgentHub onNavigate={navigate} />
        </section>

        <section className={`page ${activePage === 'tutor' ? 'active' : ''}`}>
          <ConceptTutor />
        </section>

        <section className={`page ${activePage === 'quiz' ? 'active' : ''}`}>
          <QuizAgent />
        </section>

        <section className={`page ${activePage === 'notes' ? 'active' : ''}`}>
          <NotesSummarizer />
        </section>

        <section className={`page ${activePage === 'planner' ? 'active' : ''}`}>
          <StudyPlanner />
        </section>

        <section className={`page ${activePage === 'assignments' ? 'active' : ''}`}>
          <AssignmentTracker />
        </section>

        <section className={`page ${activePage === 'retrieval' ? 'active' : ''}`}>
          <RetrievalHelper />
        </section>

        <section className={`page ${activePage === 'dashboard' ? 'active' : ''}`}>
          <div className="min-h-screen px-6 py-12">
            <div className="mx-auto max-w-6xl">
              <div className="page-header mb-12 text-center scroll-animate visible">
                <h2 className="glow-text text-4xl font-black">Analytics Dashboard</h2>
                <p className="mt-2 text-gray-400">Track your progress and career readiness</p>
              </div>

              <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard label="Career Match" value={`${selectedRoleMatch}%`} helper={`Best aligned for ${selectedRoleLabel}`} icon={Briefcase} color="bg-gradient-to-br from-cyan-400 to-blue-500" />
                <StatCard label="Skills Mastered" value={`${skillsMasteredCount}/5`} helper="Role target coverage" icon={Zap} color="bg-gradient-to-br from-purple-400 to-pink-500" />
                <StatCard label="Average Recall" value={memoryStats?.topics.length ? `${memoryStats.averageRecall}%` : '–'} helper={memoryStats?.topics.length ? `Across ${memoryStats.topics.length} quiz ${memoryStats.topics.length === 1 ? 'topic' : 'topics'} today` : 'Take a quiz to start tracking'} icon={TrendingUp} color="bg-gradient-to-br from-green-400 to-emerald-500" />
                <StatCard label="Revise Now" value={memoryStats?.topics.length ? String(memoryStats.dueNow.length) : '–'} helper={memoryStats?.dueNow.length ? memoryStats.dueNow.slice(0, 2).join(', ') : 'Topics fading from memory'} icon={Award} color="bg-gradient-to-br from-orange-400 to-red-500" />
              </div>

              <div className="grid gap-8 lg:grid-cols-2">
                <div className="glass-card rounded-3xl p-6">
                  <h3 className="mb-4 text-xl font-bold">Skill Readiness Score</h3>
                  <div className="mx-auto mb-4 h-52 w-52 rounded-full accuracy-meter" style={{ '--percentage': `${selectedRoleMatch}%` }}>
                    <div className="m-2 flex h-[192px] items-center justify-center rounded-full bg-slate-900/90 text-center">
                      <div><div className="text-5xl font-black text-cyan-400">{selectedRoleMatch}</div><div className="text-sm text-gray-400">Readiness Score</div></div>
                    </div>
                  </div>
                </div>
                <div className="glass-card rounded-3xl p-6">
                  <h3 className="mb-4 text-xl font-bold">On-Demand Skills to Focus</h3>
                  {topDemandSkills.map((item) => (
                    <div key={item.key} className="glass mb-3 rounded-2xl p-4">
                      <div className="mb-1 flex items-center justify-between gap-2 font-semibold">
                        <span className="flex items-center gap-2"><Lightbulb className="h-4 w-4 text-yellow-400" /> {item.label}</span>
                        <span className="text-xs text-cyan-300">Demand {item.demandScore}</span>
                      </div>
                      <p className="text-sm text-gray-400">Current {item.current}% | Target {item.required}% | Gap {item.gap}%</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 grid gap-8 lg:grid-cols-2">
                <div className="glass-card rounded-3xl p-6">
                  <h3 className="mb-4 text-xl font-bold">Top Roles to Focus</h3>
                  <div className="space-y-3">
                    {topRolesToFocus.map((role) => (
                      <div key={role.role} className="rounded-xl border border-white/10 bg-white/5 p-3">
                        <div className="mb-1 flex items-center justify-between">
                          <span className="font-semibold">{roleDisplayName(role.role)}</span>
                          <span className="text-sm text-cyan-300">{role.score}% fit</span>
                        </div>
                        <div className="progress-bar h-2 rounded-full">
                          <div className="progress-fill h-full rounded-full" style={{ width: `${role.score}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="glass-card rounded-3xl p-6">
                  <h3 className="mb-4 text-xl font-bold">Recommended Certifications</h3>
                  <div className="space-y-3">
                    {recommendedCertifications.map((cert) => (
                      <div key={cert} className="rounded-xl border border-yellow-300/20 bg-yellow-400/5 p-3 text-sm text-yellow-100">
                        <span className="flex items-center gap-2 font-medium"><Award className="h-4 w-4 text-yellow-300" /> {cert}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-8 glass-card rounded-3xl p-6">
                <h3 className="mb-4 flex items-center gap-2 text-xl font-bold">
                  <Sparkles className="h-5 w-5 text-cyan-300" />
                  AI Suggestions for Industry Outlook
                </h3>
                {aiAdvisorLoading ? <p className="mb-3 text-sm text-cyan-200">Generating insights...</p> : null}
                {aiAdvisorError ? (
                  <div className="mb-4 rounded-xl border border-amber-300/30 bg-amber-500/10 p-3 text-xs text-amber-100">
                    AI suggestions are unavailable: {aiAdvisorError}
                  </div>
                ) : null}

                <p className="mb-4 text-sm text-cyan-100">{aiAdvisor?.summary || aiIndustryOutlook.summary}</p>

                {aiAdvisor?.projectIdeas?.length ? (
                  <div className="mb-4 rounded-xl border border-cyan-400/20 bg-cyan-500/5 p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-cyan-200">AI Recommended Projects</p>
                    <div className="space-y-2">
                      {aiAdvisor.projectIdeas.slice(0, 3).map((idea) => (
                        <div key={idea.name} className="rounded-xl border border-cyan-300/15 bg-slate-950/25 p-3">
                          <p className="text-sm font-semibold text-cyan-100">{idea.name}</p>
                          {idea.description ? <p className="mt-1 text-xs text-gray-300">{idea.description}</p> : null}
                          {idea.skills?.length ? <p className="mt-2 text-xs text-cyan-200">Skills: {idea.skills.join(', ')}</p> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {aiAdvisor?.learningVideos?.length ? (
                  <div className="mb-4 rounded-xl border border-violet-400/20 bg-violet-500/5 p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-violet-200">AI Learning Videos</p>
                    <div className="space-y-2">
                      {aiAdvisor.learningVideos.slice(0, 3).map((video) => (
                        <a key={video.url} href={video.url} target="_blank" rel="noreferrer" className="block rounded-xl border border-violet-300/15 bg-slate-950/25 p-3 text-sm text-gray-200 transition hover:border-violet-300/35">
                          <span className="font-semibold text-violet-100">{video.title}</span>
                          {video.reason ? <span className="mt-1 block text-xs text-gray-400">{video.reason}</span> : null}
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}

                {aiAdvisor?.nextActions?.length ? (
                  <div className="mb-4 rounded-xl border border-emerald-400/20 bg-emerald-500/5 p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-200">Recommended Next Actions</p>
                    <div className="space-y-2">
                      {aiAdvisor.nextActions.slice(0, 4).map((action) => (
                        <div key={action} className="rounded-xl border border-emerald-300/15 bg-slate-950/25 p-3 text-sm text-gray-200">
                          {action}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="space-y-2">
                  {(aiAdvisor?.risks?.length ? aiAdvisor.risks : aiIndustryOutlook.suggestions).map((suggestion) => (
                    <div key={suggestion} className="rounded-xl border border-cyan-400/20 bg-cyan-500/5 p-3 text-sm text-gray-200">
                      {suggestion}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {signInOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/75 px-4 py-8 backdrop-blur-md">
          <div className="glass-card relative w-full max-w-md rounded-3xl border border-cyan-300/25 p-6 shadow-2xl shadow-cyan-950/40 md:p-8">
            <button
              type="button"
              aria-label="Close sign in"
              onClick={() => setSignInOpen(false)}
              className="absolute right-4 top-4 rounded-full p-2 text-gray-400 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="mb-7 flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-cyan-400">
                <User className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
                  {authMode === 'register' ? 'Start your journey' : 'Welcome back'}
                </p>
                <h2 className="text-2xl font-bold text-white">
                  {authMode === 'register' ? 'Create your Student Study Agent account' : 'Sign in to Student Study Agent'}
                </h2>
              </div>
            </div>

            <form className="space-y-4" onSubmit={submitSignIn}>
              <label className="block text-sm text-gray-300">
                Email address
                <div className="relative mt-2">
                  <Mail className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-gray-500" />
                  <input
                    type="email"
                    value={signInEmail}
                    onChange={(event) => setSignInEmail(event.target.value)}
                    placeholder="you@example.com"
                    className="input-field w-full rounded-xl py-3 pl-10 pr-3 text-sm text-white"
                    autoComplete="email"
                  />
                </div>
              </label>
              <label className="block text-sm text-gray-300">
                Password
                <input
                  type="password"
                  value={signInPassword}
                  onChange={(event) => setSignInPassword(event.target.value)}
                  placeholder="Enter your password"
                  className="input-field mt-2 w-full rounded-xl px-3 py-3 text-sm text-white"
                  autoComplete="current-password"
                />
              </label>
              {authMode === 'register' ? (
                <label className="block text-sm text-gray-300">
                  Confirm password
                  <input
                    type="password"
                    value={signInConfirmPassword}
                    onChange={(event) => setSignInConfirmPassword(event.target.value)}
                    placeholder="Re-enter your password"
                    className="input-field mt-2 w-full rounded-xl px-3 py-3 text-sm text-white"
                    autoComplete="new-password"
                  />
                </label>
              ) : null}

              {signInError ? <p className="rounded-xl border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">{signInError}</p> : null}
              {signInMessage ? <p className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">{signInMessage}</p> : null}

              <button type="submit" disabled={signInLoading} className="btn-primary flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-60">
                <LogIn className="h-4 w-4" />
                {signInLoading ? 'Please wait...' : authMode === 'register' ? 'Create Account' : 'Sign In'}
              </button>
            </form>

            <button
              type="button"
              className="mt-5 w-full text-center text-xs font-semibold text-cyan-200 transition hover:text-cyan-100"
              onClick={() => {
                setAuthMode((mode) => (mode === 'register' ? 'login' : 'register'));
                setSignInError('');
                setSignInMessage('');
                setSignInPassword('');
                setSignInConfirmPassword('');
              }}
            >
              {authMode === 'register' ? 'Already have an account? Sign in' : 'Need an account? Register first'}
            </button>
          </div>
        </div>
      ) : null}

      <footer className="glass relative z-10 mt-12 border-t border-white/10 px-6 py-8">
        <div className="mx-auto max-w-7xl text-center">
          <div className="mb-4 flex items-center justify-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-cyan-400">
              <Brain className="h-6 w-6" />
            </div>
            <span className="text-xl font-bold">Student Study <span className="text-cyan-400">Agent</span></span>
          </div>
          <p className="mb-2 text-sm text-gray-400">Where Professional Growth Meets Academic Excellence</p>
          <p className="text-xs text-gray-500">© 2026 Student Study Agent - Agentic AI-based Personal Study Assistant</p>
        </div>
      </footer>
    </div>
  );
}
