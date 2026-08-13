/* ============================================================
   Coach API — structured output schemas
   ------------------------------------------------------------
   Passed to the model as output_config.format, so the response is
   constrained to this shape rather than parsed hopefully out of prose.

   The load-bearing field is `evidenceType` on every claim. The model
   cannot emit a finding without declaring whether it is:

     known    — a number we computed deterministically
     observed — seen in move-level data (smart cube, later video)
     inferred — a hypothesis consistent with the numbers, not a fact

   That turns "don't hallucinate observations" from a prompt request
   into a structural requirement, and lets the UI render an inferred
   claim differently from an observed one.

   Structured outputs do not support minLength/maxLength/minimum/
   maximum, and every object needs additionalProperties:false plus an
   explicit required list.
   ============================================================ */
'use strict';

const EVIDENCE_TYPES = ['known', 'observed', 'inferred'];

const finding = {
    type: 'object',
    additionalProperties: false,
    properties: {
        title: { type: 'string', description: 'Short label, a few words.' },
        detail: {
            type: 'string',
            description: 'One or two sentences. If evidenceType is "inferred", phrase it as a possibility, not a fact.',
        },
        evidenceType: {
            type: 'string',
            enum: EVIDENCE_TYPES,
            description: '"known" for a computed statistic, "observed" for something present in move-level data, "inferred" for a hypothesis.',
        },
        basis: {
            type: 'string',
            description: 'The specific figure or observation this rests on, e.g. "Ao100 11.82s vs best single 9.42s". For inferred claims, name what would confirm it.',
        },
    },
    required: ['title', 'detail', 'evidenceType', 'basis'],
};

const trainingRecommendation = {
    type: 'object',
    additionalProperties: false,
    properties: {
        title: { type: 'string' },
        description: { type: 'string', description: 'What the cuber actually does.' },
        objective: { type: 'string', description: 'The measurable point of the drill.' },
        focusArea: {
            type: 'string',
            enum: ['cross', 'f2l', 'lookahead', 'oll', 'pll', 'recognition',
                'consistency', 'turning_speed', 'inspection', 'competition', 'general'],
        },
        solveTarget: { type: 'integer', description: 'Number of solves; 0 if not solve-based.' },
        durationMinutes: { type: 'integer', description: 'Rough length; 0 if unbounded.' },
    },
    required: ['title', 'description', 'objective', 'focusArea', 'solveTarget', 'durationMinutes'],
};

const COACH_ASSESSMENT_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    properties: {
        summary: {
            type: 'string',
            description: 'Two or three sentences citing the actual figures. No greeting, no filler.',
        },
        strengths: { type: 'array', items: finding },
        weaknesses: { type: 'array', items: finding },
        bottleneck: {
            ...finding,
            description: 'The single most limiting factor right now.',
        },
        rationale: {
            type: 'string',
            description: 'Why that is the bottleneck, referencing the figures given.',
        },
        priority: {
            type: 'string',
            description: 'The one thing to work on next, in a short phrase.',
        },
        confidence: {
            type: 'number',
            description: '0 to 1. Lower it when the solve count is small or the trend is unclear.',
        },
        dataGaps: {
            type: 'array',
            items: { type: 'string' },
            description: 'Things that cannot be assessed from the evidence provided. State these plainly rather than guessing.',
        },
        recommendedActions: { type: 'array', items: trainingRecommendation },
    },
    required: ['summary', 'strengths', 'weaknesses', 'bottleneck', 'rationale',
        'priority', 'confidence', 'dataGaps', 'recommendedActions'],
};

const drill = {
    type: 'object',
    additionalProperties: false,
    properties: {
        id: { type: 'string', description: 'Short slug, unique within the day.' },
        title: { type: 'string' },
        objective: { type: 'string', description: 'What improvement this is aiming at.' },
        instructions: { type: 'string', description: 'How to do it, in one or two sentences.' },
        focusArea: {
            type: 'string',
            enum: ['cross', 'f2l', 'lookahead', 'oll', 'pll', 'recognition',
                'consistency', 'turning_speed', 'inspection', 'competition', 'general'],
        },
        mode: {
            type: 'string',
            enum: ['timed', 'slow', 'controlled', 'untimed', 'algorithm'],
            description: '"slow" and "controlled" are deliberate-practice paces; "timed" is normal solving.',
        },
        solveTarget: { type: 'integer' },
    },
    required: ['id', 'title', 'objective', 'instructions', 'focusArea', 'mode', 'solveTarget'],
};

const phase = {
    type: 'object',
    additionalProperties: false,
    properties: {
        id: { type: 'string' },
        name: { type: 'string', description: 'e.g. "Stability"' },
        goalLabel: { type: 'string', description: 'e.g. "Ao100 under 11.2s"' },
        targetMetric: { type: 'string', enum: ['single', 'ao5', 'ao12', 'ao50', 'ao100'] },
        targetMs: { type: 'integer', description: 'The phase target in milliseconds.' },
        focus: { type: 'array', items: { type: 'string' } },
        rationale: { type: 'string', description: 'Why this phase comes here.' },
    },
    required: ['id', 'name', 'goalLabel', 'targetMetric', 'targetMs', 'focus', 'rationale'],
};

const TRAINING_PLAN_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    properties: {
        title: { type: 'string', description: 'e.g. "Road to sub-10"' },
        overview: { type: 'string', description: 'Two sentences on the shape of the plan.' },
        phases: { type: 'array', items: phase },
        currentPhaseId: { type: 'string' },
        today: {
            type: 'object',
            additionalProperties: false,
            properties: {
                focus: { type: 'string', description: 'The single focus for today.' },
                rationale: { type: 'string', description: 'Why this today, given the data.' },
                drills: { type: 'array', items: drill },
            },
            required: ['focus', 'rationale', 'drills'],
        },
    },
    required: ['title', 'overview', 'phases', 'currentPhaseId', 'today'],
};

const PLAN_REVISION_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    properties: {
        verdict: {
            type: 'string',
            enum: ['working', 'too_early', 'not_working', 'goal_reached'],
            description: 'Whether the last training block moved the objective metric.',
        },
        assessment: {
            type: 'string',
            description: 'Two or three sentences on what the numbers did, citing them.',
        },
        changeFocus: { type: 'boolean', description: 'True only if the focus should actually change.' },
        newPhaseId: { type: 'string', description: 'Phase to move to, or the current one to stay.' },
        today: {
            type: 'object',
            additionalProperties: false,
            properties: {
                focus: { type: 'string' },
                rationale: { type: 'string' },
                drills: { type: 'array', items: drill },
            },
            required: ['focus', 'rationale', 'drills'],
        },
    },
    required: ['verdict', 'assessment', 'changeFocus', 'newPhaseId', 'today'],
};

module.exports = {
    COACH_ASSESSMENT_SCHEMA,
    TRAINING_PLAN_SCHEMA,
    PLAN_REVISION_SCHEMA,
    EVIDENCE_TYPES,
};
