// SessionStart: injects the using-superpowers skill (as upstream superpowers does) so the skill-first discipline is in
// context from the first message. Plain Node instead of upstream's bash polyglot, so it runs the same everywhere.
const fs = require("fs");
const path = require("path");

try {
  const text = fs.readFileSync(path.join(__dirname, "..", "skills", "using-superpowers", "SKILL.md"), "utf8");
  const context = `<EXTREMELY_IMPORTANT>\nYou have superpowers.\n\n**Below is the full content of your 'agents-kit:using-superpowers' skill - your introduction to using skills. For all other skills, use the 'Skill' tool:**\n\n${text.trim()}\n</EXTREMELY_IMPORTANT>`;
  console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: context } }));
} catch {}
process.exit(0);
