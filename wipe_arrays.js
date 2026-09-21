const fs = require('fs');

let data = fs.readFileSync('lib/data.ts', 'utf8');

// The arrays to wipe out
const arraysToWipe = [
  'applications',
  'studentMemberships',
  'experienceItems',
  'events',
  'coffeeChatRequests',
  'applicants',
  'screeningApplicants',
  'interviewQuestions',
  'workspaceRounds',
  'rosterMembers',
  'clubExecutives',
  'initialBuilderQuestions',
  'scheduleLocationNames',
  'scheduleLocations',
  'notifications',
  'discoverClubs',
  'trackedApplications',
  'essayPrompts',
  'decisionHistory',
  'managedEvents',
  'savedClubs',
  'allDiscoverClubs',
  'managedEventsData',
  'candidateQueue',
  'interviewerPool',
  'rooms',
];

arraysToWipe.forEach(arrName => {
  // We want to match: export const arrName: Type[] = [ ... ]
  // or export const arrName = [ ... ]
  // But regex for balanced brackets is hard in JS. Let's do simple AST or naive regex if possible.
  // Actually, let's just use regex to match `export const arrName(: [^=]+)? = \[\n([\s\S]*?)\n\]`
  // This might match too much if there are nested top-level brackets, but for our data.ts it's mostly flat list of objects.
  const regex = new RegExp(`export const ${arrName}(:\\s*[^=]+)?\\s*=\\s*\\[\\s*[\\s\\S]*?\\n\\]`, 'g');
  data = data.replace(regex, `export const ${arrName}$1 = []`);
});

fs.writeFileSync('lib/data.ts', data);
