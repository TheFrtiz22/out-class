import type { Applicant, ScreeningApplicant, ScreeningStatus, InterviewCandidate } from "@/lib/data"

const firstNames = ["James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda", "David", "Elizabeth", "William", "Barbara", "Richard", "Susan", "Joseph", "Jessica", "Thomas", "Sarah", "Charles", "Karen", "Christopher", "Nancy", "Daniel", "Margaret", "Matthew", "Lisa", "Anthony", "Betty", "Donald", "Dorothy"];
const lastNames = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson"];
const majors = ["Economics", "Finance", "Computer Science", "Commerce", "Statistics", "Mathematics", "Systems Engineering", "Government", "Media Studies", "Psychology", "Sociology", "English", "History", "Biology", "Chemistry", "Cognitive Science", "Computer Science & Mathematics", "Economics & History", "Global Studies", "Foreign Affairs"];

// 10% First-Year, 20% Sophomore, 40% Junior, 30% Senior (1=First, 2=Soph, 3=Junior, 4=Senior)
const yearDist = [1, 2, 2, 3, 3, 3, 3, 4, 4, 4]; 

const skillsArr = [
  ["Python", "Data Analysis", "SQL", "Machine Learning"], 
  ["Financial Modeling", "Excel", "Valuation", "Accounting"], 
  ["Public Speaking", "Leadership", "Event Planning", "Communication"], 
  ["React", "TypeScript", "Node.js", "Next.js"], 
  ["Research", "Writing", "Critical Thinking", "Editing"], 
  ["Marketing", "Social Media", "Canva", "SEO"],
  ["Project Management", "Agile", "Scrum", "Jira"],
  ["C++", "Java", "Algorithms", "Data Structures"]
];

const experienceArr = [
  ["Summer Analyst at Regional Bank", "President of Finance Club"],
  ["Software Engineering Intern at Tech Startup", "TA for CS 2100"],
  ["Barista at Local Coffee Shop", "Volunteer at SPCA"],
  ["Research Assistant at UVA", "Member of Student Council"],
  ["Marketing Intern at Local Agency", "Social Chair of Greek Organization"],
  ["Tutor at Math Center", "Captain of Intramural Soccer"],
  ["Data Science Intern", "Writer for Cavalier Daily"],
  ["Camp Counselor", "Member of Consulting Club"]
];

const essay1Answers = [
  "I am deeply interested in this organization because of its commitment to excellence and the community it fosters. During my time at UVA, I've looked for a group that pushes me to grow, and I believe this is the perfect fit.",
  "I want to join to develop my professional skills and meet like-minded peers who are passionate about this field. The opportunity to work on real-world projects is incredibly appealing to me.",
  "Since my first year, I have looked up to this club. The alumni network and hands-on projects are exactly what I'm looking for. I am eager to contribute my unique perspective.",
  "The collaborative environment here is unmatched. I want to surround myself with driven individuals who challenge me to think outside the box and tackle complex problems."
];

const essay2Answers = [
  "Last summer, I led a team of interns to deliver a key project ahead of schedule, learning how to manage different working styles and resolve conflicts under pressure.",
  "As treasurer of my dorm, I managed a $5000 budget and organized events for 200 students, requiring strict attention to detail and clear communication.",
  "I organized a charity fundraiser that raised $2000, coordinating with local businesses and managing a team of 15 volunteers.",
  "When our team faced a major setback in a case competition, I stepped up to reassign roles based on strengths, which ultimately led us to a second-place finish."
];

// Helper for deterministic generation
const getIndex = <T>(arr: T[], index: number): T => arr[index % arr.length];

export const demoApplicants: Applicant[] = Array.from({ length: 100 }).map((_, i) => {
  const firstName = getIndex(firstNames, i);
  const lastName = getIndex(lastNames, (i * 3 + 1));
  const major = getIndex(majors, (i * 7 + 2));
  
  const yearCode = yearDist[i % 10];
  const year = yearCode === 1 ? "First-Year" : yearCode === 2 ? "Sophomore" : yearCode === 3 ? "Junior" : "Senior";
  
  // GPA: 2.80 to 4.00
  const baseGpa = 2.8 + ((i * 13) % 121) / 100;
  const gpa = (baseGpa > 4.0 ? 4.0 : baseGpa).toFixed(2);
  
  // SAT: 1200 to 1600
  const satScore = 1200 + ((i * 37) % 41) * 10;
  
  const experience = getIndex(experienceArr, (i * 5));
  
  const initials = `${firstName[0]}${lastName[0]}`;
  const computingId = `${initials.toLowerCase()}${1 + (i % 99)}`;
  const email = `${computingId}@virginia.edu`;
  
  return {
    id: `demo-student-${(i + 1).toString().padStart(3, '0')}`,
    name: `${firstName} ${lastName}`,
    email,
    initials,
    major,
    year,
    status: "Applied",
    score: 0,
    gpa,
    satScore,
    resumeFileName: `${firstName}_${lastName}_Resume.pdf`,
    resumeHighlight: experience[0],
    links: [
      { label: "LinkedIn", url: `https://linkedin.com/in/${firstName.toLowerCase()}-${lastName.toLowerCase()}-${i}` },
      { label: "GitHub", url: `https://github.com/${firstName.toLowerCase()}${lastName.toLowerCase()}` }
    ],
    essays: [
      { question: "Why are you interested?", answer: getIndex(essay1Answers, i) },
      { question: "Describe a leadership experience", answer: getIndex(essay2Answers, i * 2) }
    ]
  };
});

export const demoScreeningApplicants: ScreeningApplicant[] = demoApplicants.map((app, i) => {
  let status: ScreeningStatus;
  let flagTags: string[] = [];
  
  const statusRoll = i % 100;
  if (statusRoll < 50) {
    status = "Passed Auto-Filter";
  } else if (statusRoll < 70) {
    status = "Auto-Flagged";
    const flagOptions = ["Low GPA", "Missing Resume", "Incomplete Application", "No relevant experience"];
    flagTags = [getIndex(flagOptions, i)];
    if (i % 3 === 0) flagTags.push(getIndex(flagOptions, i + 1));
  } else if (statusRoll < 85) {
    status = "Manually Approved";
  } else {
    status = "Rejected";
  }

  return {
    id: app.id,
    name: app.name,
    initials: app.initials,
    classYear: app.year,
    major: app.major,
    satScore: app.satScore,
    gpa: parseFloat(app.gpa),
    status,
    flagTags
  };
});

export const demoInterviewCandidate: InterviewCandidate = {
  id: demoApplicants[0].id,
  name: demoApplicants[0].name,
  initials: demoApplicants[0].initials,
  targetRole: "Analyst",
  round: "First Round",
  activeRoundId: "round-1",
  location: "Rouss Hall 120",
  major: demoApplicants[0].major,
  year: demoApplicants[0].year,
  satScore: demoApplicants[0].satScore,
  gpa: demoApplicants[0].gpa,
  linkedin: demoApplicants[0].links[0].url,
  bio: "SAMPLE DATA: A highly motivated student with a passion for learning and a strong academic record, deeply involved in campus life.",
  experience: [
    "Summer Analyst at SAMPLE Firm (Summer 2025)",
    "Vice President of SAMPLE Club (2024-Present)"
  ],
  skills: ["Financial Modeling", "Excel", "Public Speaking", "Data Analysis"],
  essays: demoApplicants[0].essays,
  pastRoundNotes: [
    {
      round: "Coffee Chat",
      interviewer: "Jane Doe",
      note: "SAMPLE DATA: Great conversationalist, asked insightful questions about the club's culture and current projects."
    }
  ]
};

export const demoNextInQueue = {
  name: demoApplicants[1].name,
  time: "2:30 PM"
};
