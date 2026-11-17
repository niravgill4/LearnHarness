# Teaching methods — session setup and tutor integration

## Request

Blend Cognera's existing assess → plan → predict → explain → check → repair
approach with the eight methods in the user's uploaded document. After selecting
their time budget, learners can select multiple methods for a new Teach session.

## Setup flow

1. Topic and materials, as today.
2. Existing probing and teaching time controls. Continue opens the method step
   without creating a chat.
3. A scrollable, tablet-friendly list of eight checkbox cards, with a short
   description and a visible selection count. Multiple selections are allowed.
   The page explains that the existing Cognera teaching framework is included.
4. Back retains the time values and selected methods. Cancel retains the topic.
   Start creates the session with time preferences and chosen method IDs.
   Selecting none uses Cognera's standard approach; do not silently select all.

Use the same flow from the home composer and New Teach Session page. Practice
session setup and the existing Teach/Practice navigation controls stay as they are.

## Tutor behaviors for the first integration

| Method | Behavior to incorporate into the lesson |
| --- | --- |
| Spot the Slip | Review submitted handwritten or typed working step by step; identify the first flawed step with a targeted hint. Ask about unreadable marks. |
| Feynman Mode | Ask the learner to teach the concept in plain language; use curious follow-up questions to expose unexplained links and jargon. |
| Devil's Advocate | Present a clearly labeled error-finding exercise with a deliberately flawed solution, then ask the learner to locate and justify the mistake. Reveal the correction after their attempt. |
| Socratic Lockdown | Guide through questions and graduated hints during the learner's work, withholding direct solutions. Allow the learner to explicitly request an explanation or leave the activity. |
| Blindfold Reconstruction | Present a diagram or derivation, then ask the learner to reconstruct it from memory using the drawing area and compare the submitted result in feedback. |
| The 5 Whys | Follow a formula or claim back through its assumptions and foundations, stopping when the learner has established the necessary understanding rather than forcing five repetitions. |
| Split-Board Co-Pilot | Alternate tutor and learner steps in a worked problem; require the learner to explain their own steps and finish with an independent check. |
| Blitz / Pressure Cooker | Offer short exam-fluency rounds with a stated target duration and review errors afterward. Treat speed as optional practice, not proof of mastery. |

The tutor presents a plan that incorporates the chosen methods within the time
budget. Selected methods are activities used in turn, not eight simultaneous
personalities. Clearly distinguish intentional error-finding exercises from
correct teaching. Socratic constraints apply during its activity; Co-Pilot's tutor
worked steps belong to its own activity. Never claim to have used a method that
was skipped; explain when the available time cannot accommodate every selection.

## Session persistence

Maintain one shared catalog with stable method IDs and method instructions.
Validate selected IDs at session creation; persist them in session settings.
Compose the choices into the relevant tutor's instructions on subsequent turns,
so a reload or model change does not silently lose the teaching preferences.
Keep the session title as the learner's topic. Preserve older sessions without
method settings and the existing source/override prompt composition behavior.

## Explicit scope boundary

This first integration adds the selector and real tutor guidance using current
chat, question, diagram, and handwriting submission tools. The uploaded document
also proposes new interfaces: pinned line-error badges, AI-authored canvas ink,
automatic reference concealment, diagram registration/heat maps, and enforced
45-second timers. Those are separate native tools. This version must not label
them as working, simulate enforcement in prose, or promise timed/overlay behavior
the app does not implement. Selection-card descriptions explain the behavior
available in this version.

## Usage and scope

Start Teach from Home or New Session, choose the time budget, then select any
number of methods. Start Learning stores the selection under the session's
`settings.teachingSetup`. The model-picker settings route preserves this setup;
each new prober/teacher turn composes its guidance from that saved value.
Choices also appear by name in the opening message. No new SQL migration is
required; the existing cloud `chats.record` JSON field stores session data.

Method selection guides the tutor. It does not enforce AI teaching quality, a
countdown, a diagram concealment, or a canvas overlay. Those native features
remain outside this approved integration.

## Verification

Check both Teach entry points, multiple selection, Back/Cancel behavior, no chat
creation before final confirmation, selected-ID validation, saved settings,
instruction composition after reload, conflicting-method sequencing, unchanged
Practice behavior, standard behavior with no methods, and tablet/mobile layout.
Distinguish model instruction tests from observed live teaching quality.
