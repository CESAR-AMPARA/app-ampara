---
name: ampara-agent-guider
description:
  Expertise in guiding agents through technical tasks and decision-making processes. Use
  when the user asks for assistance with implementing features, writing specifications, or documenting architectural choices.
---

# Technical Documentation and Implementation Guider 

## Description
This skill provides the AI agent with precise rules and guidelines for implementing features, writing Feature Specifications (Specs), and recording technical choices in Architecture Decision Records (ADRs) within the App Ampara ecosystem. It ensures all implementation work aligns perfectly with the established architectural standards and documentation workflows.

## Activation Triggers
Activate this skill whenever you are tasked with implementing a feature, writing or reviewing a Feature Specification (Spec) in the `todo/` directory, or documenting an architectural choice in the `adr/` directory.

## Core Directives for Feature Specifications (Specs)

### 1. Lifetime and Directory Structure
Specs are stored in the `todo/` directory with the naming convention `NNNN-kebab-case-title.md` (e.g., `0005-add-user-authentication.md`), zero-padded and sequential. The next available number is tracked exclusively in the `todo/NEXT_SPEC` file, which must be incremented in the same commit that adds the spec. Specs are temporary blueprints that must be deleted once the feature is implemented and verified by automated tests. The tests themselves become the permanent record of the behaviour.

### 2. Single-Side Scope Constraint
A spec is never fullstack. It must cover either the backend or the frontend, never both, as they are implemented independently by different developers. For features that span both sides, you must write two separate specs with consecutive numbers. Each spec must stand on its own without referencing the other for its core purpose. The shared contract (e.g., NDJSON frame, request schema) must be fully specified in the backend spec, and the frontend spec must link to it. Each spec must list the other side's work under the `## Out of Scope` section.

### 3. Structural Template
Every spec must adhere to the standard template structure, including the following sections in order: `## Problem`, `## Business Vision and Purposes`, `## Solution`, `## User Stories`, `## Implementation Decisions`, `## Testing Decisions`, `## Out of Scope`, and `## Further Notes`. Empty sections should be deleted rather than filled with placeholders like "N/A".

### 4. Precision and Language
All technical specifications, contracts, and decisions must be written in English, except for user-facing copy or LLM-facing text in Portuguese, which must be quoted verbatim. Quantitative claims must include specific numbers and units (e.g., "200 ms"). Every risk identified must be accompanied by its respective impact and mitigation strategy. Use backticks for all identifiers, files, and modules.

## Core Directives for Architecture Decision Records (ADRs)

### 1. High Gate of Relevance
Write an ADR only when a decision is hard to reverse, surprising without context, and the result of a real trade-off. Simple, obvious, or easily reversible choices do not justify an ADR. ADRs are permanent records stored in the `adr/` directory and must be kept current; if a decision changes, edit the existing file in place rather than creating a "superseded by" chain.

### 2. Precise Formulations and Present Tense
The title of an ADR must state the actual decision in force (e.g., `Domain services don't depend directly on third-party SDKs`), without prefixes like `ADR-0002:`. The first sentence must state the active rule today in the present tense, followed immediately by the justification and the associated costs. Every ADR must explicitly state its trade-offs and negative consequences alongside its benefits.

### 3. Style and Conventions
ADRs must be written in English. They should focus on high-level system shape, architectural boundaries, technology choices, and integration patterns, rather than code-level implementation details like line numbers or file inventories.

## Common Markdown Formatting Standards
Both Specs and ADRs must enforce a strict format: no manual line breaks inside paragraphs or list items, meaning each paragraph or item is written as a single continuous line. Use `#` only for the main title on the first line, and use `##` or `###` for subheadings. Expand all acronyms upon first use, use a decimal point with comma thousands separators for numbers (e.g., `1,234.56`), and format dates as `YYYY-MM-DD`.

## Doubts 
If you have any doubts about the implementation of a feature, the writing of a spec, or the documentation of an ADR, consult the `backend/DEV_WORKFLOW.md`, `adr/README.md` and `todo/README.md` files for detailed guidance on development workflows, testing conventions, and ADR writing standards.