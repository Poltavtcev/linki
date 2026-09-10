# Deferred Investigation: Campaign Engine Scheduler Throughput

## Context
The current `actionLoop` processes targets sequentially. If an action evaluates to a cheap, zero-side-effect terminal state (e.g., missing URL, already enriched, non-applicable), it still yields the lock and consumes a tick. If there is a massive backlog of such leads, this linear, tick-by-tick processing can severely bottleneck campaign throughput.

## Investigation Requirements

This task requires a thorough architectural specification (no implementation initially) covering:

1. **Tick Behavior Analysis**: Verify if `actionLoop` truly processes a strict maximum of one lead/action per tick per account lock.
2. **Cheap Terminal Conditions**: Enumerate all states/conditions across actions (e.g., missing Sales Nav URL, already enriched, missing API keys) that currently terminate without an external platform side-effect.
3. **Queue Blocking Impact**: Determine whether these skip-able leads effectively block or delay the execution of subsequent actionable leads.
4. **Batch/Advance Feasibility**: Investigate if cheap eligibility/skip conditions can be processed in bulk, or if the cursor can advance instantly within the same tick to the next actionable target.
5. **Serialization Constraints**: Identify which account-level serializations must NOT be broken by batching.
6. **Throughput Profiling**: Document current real-world throughput (leads/tick, ticks/minute) and simulate behavior for 100, 1,000, and 100,000 leads in the pipeline.
7. **Architectural Separation**: Evaluate dividing the scheduling pipeline into three distinct phases:
   - Eligibility / Filtering (can be batched).
   - Scheduling / Pacing (queue allocation).
   - Actual External Execution (strictly sequential/locked).
8. **Safety Boundary Map**: Explicitly define where batching is safe and where it is strictly prohibited to preserve LinkedIn safety (pacing and account locks).

## Status
DEFERRED - Pending independent investigation phase.
