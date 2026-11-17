# Reading pace and session-time recommendations

Status: approved by the user and implemented on 2026-11-17.

## Requested outcome

Measure a learner's normal reading pace in onboarding, save it to their account,
and use it with the actual lesson request to recommend a realistic learning
duration. Questions, reasoning, diagrams, simulations and feedback need their
own time; reading speed alone is not learning speed.

## Learner flow

1. Keep account, provider and strong/cheap/vision setup. Add **Your pace** before
   the existing first-topic/goal step, using the current onboarding surfaces,
   typography, ASCII landscape and responsive layout.
2. Explain: "Read at your normal pace. This helps us size your lessons."
   Start reveals an original, plain-English passage of approximately 200 words
   and starts a visible elapsed timer. There is no countdown or speed target.
3. **Finished reading** stops the timer. Compute words per minute from the exact
   passage word count and elapsed time, then show **Estimated reading pace**,
   elapsed time, **Use this pace**, **Try again**, and **Skip for now**.
   A single passage supplies a starting estimate, not a definitive ability score.
4. Invalidate an interrupted attempt when the tab becomes hidden; explain and
   offer a restart. Reloads do not continue a lost timer. Reject zero-length,
   non-finite or implausibly short measurements instead of saving a bad pace.
5. Save a confirmed result privately to the signed-in profile. Existing users
   can measure or retake it from Profile & account; they are not sent back
   through provider setup. Skipping does not block completion.

## Session setup

- In both Home and New Teach entry points, request a recommendation using the
  learner's actual prompt, learning goal if saved, and saved reading pace.
- Use the configured lightweight model to propose a bounded first-session scope,
  estimated explanatory word count, question/activity counts and time allowances,
  plus a short explanation. Validate the structured response server-side.
- Calculate explanatory reading minutes from word count / measured WPM; add
  separate allowances for thinking, questions, feedback/repair and relevant
  visual exploration or simulations. Add the selected diagnostic time separately.
- Show **Recommended: about 25 min** (illustrative) in the lesson-time group,
  with a short reason, a reading/questions/activities breakdown, and total time
  including the diagnostic. Recommendations estimate a scoped first lesson,
  not mastery of an entire broad subject.
- Selecting a different diagnostic duration updates the total. The existing
  preset and custom choices remain available. Offer **Use recommendation**;
  never overwrite an explicit learner choice when an async response arrives.
- If no measurement exists, label the reading assumption as an estimate using
  a provisional 250 WPM baseline. If the recommendation model fails, show the
  existing time choices and a clear unavailable state, not a fabricated
  personalized recommendation. Session creation remains available.

## Persistence and tutor behavior

- Add a versioned, validated reading-pace record under the existing profile
  `model_settings` JSON metadata field (the live project does not yet have
  the optional `user_settings` column): passage identifier, exact word count, elapsed
  milliseconds, derived WPM and measurement date. The server derives WPM;
  it does not trust a browser-supplied rate. Preserve other profile fields and
  isolate reads/writes by authenticated user. No new table is required.
- Snapshot the validated pace, selected budget and any accepted recommendation
  into the session setup. Supply these to the prober and teacher on subsequent
  turns, including after a reload. A recommendation is guidance, not a timer
  that ends the lesson or marks understanding complete.
- The tutor sizes explanations to the reading allowance, reserves question and
  feedback time, and adjusts scope following the initial assessment. Dense
  equations and unfamiliar material warrant extra processing time. An incorrect
  answer triggers explanation and repair rather than rushing to meet a budget.
- Explain these limits in short product copy: reading pace is a starting estimate;
  questions and exercises can change the time needed.

## Verification

- Unit tests: word counting and WPM, interruption/invalid attempts, server
  validation, separate reading/activity/diagnostic budget arithmetic and rounding.
- API tests: authenticated account persistence and isolation, preserving unrelated
  settings, optional measurement, valid bounded recommendations and model failure.
- Browser checks: Start/Finish/Retake/Skip, result confirmation and reload,
  existing-user access, phone/tablet/desktop layout, keyboard access, recommendation
  arrival and failure, preserving custom duration, both Teach entry points.
- Session regression: pace and budget survive creation/reload and reach the tutor;
  ordinary sessions without a pace remain compatible. Run typecheck, lint,
  relevant regressions and production build.
