# Verifying a suspected vulnerability

Run this for every candidate before it goes in the report. Derived from the approach in Trail of Bits' fp-check skill (CC-BY-SA-4.0); reworded.

## Step 0: restate the claim

Write it in your own words: the vulnerability, its root cause, the trigger, the impact, the attacker, and the privilege the code runs with. If you can't state it clearly, the claim usually doesn't survive being made precise. Many false positives end here.

## Step 1: trace the real path

- Where does the input originate, and can an attacker actually control it?
- Every caller and every function on the way to the sink. What constraints do they impose?
- Is there validation, encoding, parameterization, or an authorization check upstream that you haven't read yet?
- Does the framework protect this already (ORM parameterization, auto-escaping templates, CSRF middleware)?
- Is this code reachable at all in production (dead code, test-only, behind a flag that is off)?

Unsafe-looking code is not a vulnerability until the whole path is traced. A similar bug elsewhere proves nothing about this instance; check this one.

## Step 2: check the exploit is feasible

- Can the attacker supply a value that passes every check on the way and reaches the sink?
- What do they gain that they didn't already have? If the attacker must already hold the privilege the bug would grant, there is no finding.
- Are the preconditions realistic (specific config, race window, local access)?

## Step 3: devil's advocate

Argue why it is not a vulnerability. List what would have to be true for it to be exploitable, and check each item against the code. If you still can't refute it, keep it. If the argument holds, drop it and note why in one line.

## Rationalizations to reject

| Thought | Why it's wrong |
|---|---|
| "This pattern looks dangerous" | Pattern matching is not analysis. Trace the data. |
| "Similar code was vulnerable elsewhere" | Validation and callers differ per context. Verify this instance. |
| "This is clearly critical" | Models overrate severity. Prove it with the path and the scenario. |
| "Skipping the trace to save time" | An untraced finding is a guess. |
| "Better to report it just in case" | Noise hides real issues and wastes the reader's time. |

## Verdict

Mark each candidate TRUE POSITIVE or FALSE POSITIVE with the evidence: file and line references for the source, the sink, and what you checked in between.
