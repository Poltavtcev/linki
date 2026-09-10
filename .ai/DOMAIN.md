# DOMAIN: Campaign ↔ Lists

## Core Entities
1. **List (`lists`)**: A physical collection of targets.
2. **Target (`targets`)**: A physical lead/contact. A target can belong to multiple lists (`list_targets`).
3. **Campaign / Run (`runs`)**: An executing instance of a workflow.
4. **Campaign Enrollment (`run_profiles`)**: The physical execution state of a specific target inside a specific campaign.

## Strict Accounting Semantics
A target may physically belong to multiple Lists (e.g., Target T is in List A and List B).
However, a target can only be enrolled in a Campaign ONCE.
Therefore, the enrollment MUST be strictly attributed to the **Source List** that first introduced the target to the campaign.
- Total Campaign Enrolled = Sum of Enrolled Targets across all explicit Source Lists.
