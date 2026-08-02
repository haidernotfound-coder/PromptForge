/**
 * Phase 10 — Recipe Forge
 * -----------------------
 * A curated catalog of professionally structured prompt "recipes" a user
 * can drop straight into the editor. Deliberately mirrors the shape of
 * `templates.ts` (id/title/description/category/body, an "All" filter
 * category, a `xByCategory` helper) so the two features share the same
 * mental model — but they serve different jobs:
 *
 *  - Templates (`templates.ts` + `TemplateGallery`) create a brand-new
 *    *prompt record* (title, model, tags, body) from a dedicated page.
 *  - Recipes (this file + `RecipeForge`) insert just a `body` directly
 *    into whichever prompt is currently open in the editor, and can be
 *    favorited for quick access next time.
 *
 * Every recipe body uses the same `{{variable_name}}` placeholder syntax
 * the rest of the app already understands — `extractVariables` (in
 * editor-toolbar.tsx) and the Variable Fill modal pick these up with zero
 * extra wiring.
 */

export const RECIPE_CATEGORIES = [
  "All",
  "Writing",
  "Business",
  "Coding",
  "Creative",
  "Education",
  "Content",
] as const;

export type RecipeCategory = Exclude<(typeof RECIPE_CATEGORIES)[number], "All">;

export interface Recipe {
  id: string;
  title: string;
  description: string;
  category: RecipeCategory;
  body: string;
}

export const RECIPES: Recipe[] = [
  // ---------------------------------------------------------------- Writing
  {
    id: "rcp-persuasive-essay",
    title: "Persuasive essay outline",
    description: "A structured argument with thesis, counterpoints, and evidence slots.",
    category: "Writing",
    body:
      "You are an experienced essay coach. Write a persuasive essay outline arguing that {{claim}}, aimed at {{audience}}.\n\nStructure the output as:\n1. Thesis statement\n2. Three supporting arguments, each with a place to insert evidence\n3. One strong counterargument and its rebuttal\n4. Closing call to action\n\nKeep each point to 1-2 sentences. Present the output as a numbered outline.",
  },
  {
    id: "rcp-longform-article",
    title: "Long-form article draft",
    description: "First draft of an in-depth article with headings and a strong hook.",
    category: "Writing",
    body:
      "You are a staff writer for a publication covering {{beat}}. Write a long-form article on \"{{topic}}\" for {{audience}}.\n\nOpen with a concrete hook (a scene, statistic, or question) — not a generic definition. Structure the piece with H2 headings, and close with a short takeaway paragraph. Target length: {{word_count}} words. Think through the narrative arc step by step before drafting.",
  },
  {
    id: "rcp-personal-bio",
    title: "Personal bio / About Me",
    description: "A polished short bio in first or third person, sized for a specific use.",
    category: "Writing",
    body:
      "You are a professional bio writer. Write a {{tone}} bio for {{name}}, a {{role}}, for use on {{platform}} (e.g. LinkedIn, a speaker page, a book jacket).\n\nInclude: their current focus, one standout achievement, and a personal detail that makes them memorable. Keep it to {{length}} and write in {{voice}} (first or third person).",
  },
  {
    id: "rcp-editing-pass",
    title: "Line-edit pass",
    description: "Tightens prose for clarity and rhythm without changing the voice.",
    category: "Writing",
    body:
      "You are a meticulous line editor. Edit the passage below for clarity, rhythm, and concision, while preserving the author's voice and intent — do not rewrite the ideas, only the wording.\n\nFor each change, briefly note why it helps. Present the result as: 1) the edited passage, 2) a short list of the key changes made.\n\nPassage:\n{{passage}}",
  },

  // --------------------------------------------------------------- Business
  {
    id: "rcp-cold-outreach",
    title: "Cold outreach email",
    description: "A short, specific first-touch email that earns a reply.",
    category: "Business",
    body:
      "You are a sales development rep writing a cold outreach email to {{recipient_role}} at {{company}}. Goal: {{goal}}.\n\nRequirements: reference something specific about their company or role, keep it under 120 words, one clear call to action, no generic flattery. Present the output as a subject line followed by the email body.",
  },
  {
    id: "rcp-swot-analysis",
    title: "SWOT analysis",
    description: "Strengths, weaknesses, opportunities, and threats for a business decision.",
    category: "Business",
    body:
      "You are a strategy consultant. Produce a SWOT analysis for {{company_or_product}} considering the decision to {{decision}}.\n\nFor each quadrant (Strengths, Weaknesses, Opportunities, Threats), give 3-4 bullet points, each one sentence and specific to this situation rather than generic. Present the output as a table with four columns.",
  },
  {
    id: "rcp-investor-pitch",
    title: "Investor pitch summary",
    description: "A tight one-pager covering problem, solution, market, and ask.",
    category: "Business",
    body:
      "You are an experienced startup advisor. Write a one-page investor summary for {{company_name}}, which does {{one_line_pitch}}.\n\nCover, in order: the problem, the solution, why now, market size, traction so far ({{traction}}), and the ask ({{ask}}). Keep each section to 2-3 sentences. Present the output in a clear, well-structured format with a heading per section.",
  },
  {
    id: "rcp-job-description",
    title: "Job description writer",
    description: "A candidate-friendly JD with clear responsibilities and requirements.",
    category: "Business",
    body:
      "You are a recruiter writing an inclusive, candidate-friendly job description for a {{role_title}} at {{company}}.\n\nInclude: a 2-sentence role summary, 4-6 responsibilities, 4-6 requirements split into \"must-have\" and \"nice-to-have\", and a one-line note on {{benefit_highlight}}. Avoid jargon and gendered language. Present the output in a clear, well-structured format with headings.",
  },

  // ---------------------------------------------------------------- Coding
  {
    id: "rcp-code-refactor",
    title: "Code refactor with explanation",
    description: "Refactors code for readability and explains every change.",
    category: "Coding",
    body:
      "You are a senior {{language}} engineer doing a code review. Refactor the code below for readability and maintainability without changing its behavior.\n\nThink through the refactor step by step, then present: 1) the refactored code in a code block, 2) a bullet list explaining each meaningful change and why it helps.\n\n```\n{{code}}\n```",
  },
  {
    id: "rcp-api-docs",
    title: "API documentation generator",
    description: "Turns an endpoint signature into clear reference docs.",
    category: "Coding",
    body:
      "You are a technical writer specializing in developer docs. Write reference documentation for the following {{language}} function/endpoint: {{function_signature}}.\n\nInclude: a one-line summary, parameters (name, type, description), return value, one realistic usage example in a code block, and any errors it can raise. Present the output in markdown.",
  },
  {
    id: "rcp-bug-explainer",
    title: "Bug fix explainer",
    description: "Diagnoses a bug and explains the fix in plain language for a PR description.",
    category: "Coding",
    body:
      "You are a senior engineer explaining a bug fix for a pull request description. Given the bug description and the diff below, write: 1) Root cause (in plain language), 2) What changed and why, 3) How to verify the fix, as a short step-by-step.\n\nBug description:\n{{bug_description}}\n\nDiff:\n{{diff}}",
  },
  {
    id: "rcp-code-review-checklist",
    title: "Code review checklist pass",
    description: "Runs a diff through a structured review checklist.",
    category: "Coding",
    body:
      "You are a thorough senior reviewer. Review the diff below against this checklist: correctness, edge cases, security, performance, readability, and test coverage.\n\nFor each category, either note an issue with a specific line reference or say \"No concerns.\" Present the output as a bullet list grouped by category, then a one-line overall verdict (Approve / Approve with comments / Request changes).\n\n```\n{{diff}}\n```",
  },

  // --------------------------------------------------------------- Creative
  {
    id: "rcp-short-story-starter",
    title: "Short story starter",
    description: "An evocative opening scene plus a direction to continue in.",
    category: "Creative",
    body:
      "You are a fiction writer working in the {{genre}} genre. Write the opening scene (roughly 200-300 words) of a short story involving {{premise}}, set in {{setting}}.\n\nEstablish a clear point-of-view character, a sense of place, and a hook by the final line. After the scene, add a short note (2-3 sentences) suggesting one direction the story could go next.",
  },
  {
    id: "rcp-character-bio",
    title: "Character bio generator",
    description: "A rounded character profile for fiction, games, or worldbuilding.",
    category: "Creative",
    body:
      "You are a character designer helping build a cast for {{project_type}} (e.g. novel, screenplay, tabletop game). Create a character profile for {{character_role}} in a story about {{story_premise}}.\n\nInclude: name, one-line personality summary, core motivation, a flaw that creates conflict, a defining habit or quirk, and one line of sample dialogue that captures their voice. Present the output as a labeled list.",
  },
  {
    id: "rcp-worldbuilding",
    title: "World-building brainstorm",
    description: "Generates the pillars of a fictional setting to build a story on.",
    category: "Creative",
    body:
      "You are a worldbuilding consultant for {{project_type}}. Brainstorm the foundations of a setting themed around {{theme}}.\n\nCover: one striking central concept, the rule or constraint that makes this world distinct, a source of ongoing conflict, and one small, concrete detail (an object, custom, or phrase) that would make the world feel lived-in. Keep each point to 2-3 sentences.",
  },
  {
    id: "rcp-song-concept",
    title: "Song lyric concept",
    description: "A theme, mood, and structural sketch to write lyrics from — not the lyrics themselves.",
    category: "Creative",
    body:
      "You are a songwriting collaborator working in the {{genre}} style. Sketch a concept for a song about {{theme}}, with a {{mood}} mood.\n\nOutline: the central image or metaphor the song builds around, a one-line idea for the hook (described, not written as final lyrics), and a suggested structure (e.g. verse-chorus-verse-chorus-bridge-chorus). Do not write copyrighted lyrics — describe the concept only.",
  },

  // -------------------------------------------------------------- Education
  {
    id: "rcp-lesson-plan",
    title: "Lesson plan generator",
    description: "A classroom-ready lesson plan with objectives and activities.",
    category: "Education",
    body:
      "You are an experienced {{subject}} teacher planning a lesson for {{grade_level}} students on \"{{topic}}\", for a {{duration}}-minute class.\n\nStructure the output as: 1) Learning objective (one sentence, measurable), 2) A short hook/warm-up activity, 3) Main activity with step-by-step instructions, 4) A quick formative check for understanding, 5) Materials needed.",
  },
  {
    id: "rcp-eli5",
    title: "Concept explainer (ELI5)",
    description: "Explains a complex topic simply, then adds a layer of depth.",
    category: "Education",
    body:
      "You are a patient teacher skilled at simplifying complex ideas. Explain {{concept}} first in plain language a curious {{audience_level}} could follow (use one concrete analogy), then add a short \"going deeper\" section with the important nuance a beginner explanation usually skips.\n\nAvoid jargon in the first section entirely; define any term you must use in the second.",
  },
  {
    id: "rcp-quiz-generator",
    title: "Quiz generator",
    description: "Multiple-choice questions with answers and brief explanations.",
    category: "Education",
    body:
      "You are an instructional designer. Write a {{question_count}}-question multiple-choice quiz on {{topic}} for {{grade_level}} students, ranging from recall to applied-understanding questions.\n\nFor each question, provide 4 options, mark the correct answer, and give a one-sentence explanation of why it's correct. Present the output as a numbered list.",
  },
  {
    id: "rcp-study-guide",
    title: "Study guide summarizer",
    description: "Condenses source material into a study guide with key terms and a self-test.",
    category: "Education",
    body:
      "You are a tutor creating a study guide from the material below for a student preparing for {{exam_or_topic}}.\n\nStructure the output as: 1) 5-8 key takeaways as bullet points, 2) a glossary of key terms with one-line definitions, 3) 3 self-test questions (no answers shown) to check understanding.\n\nSource material:\n{{source_material}}",
  },

  // ---------------------------------------------------------------- Content
  {
    id: "rcp-youtube-script",
    title: "YouTube video script outline",
    description: "A retention-focused outline: hook, beats, and a clear CTA.",
    category: "Content",
    body:
      "You are a YouTube scriptwriter for a channel about {{channel_topic}}. Outline a {{video_length}}-minute video titled \"{{video_title}}\" for {{audience}}.\n\nStructure as: 1) Hook (first 10 seconds — a question, bold claim, or preview of the payoff), 2) 3-5 main content beats in order, each with a one-line description, 3) Closing call to action ({{cta}}). Think through pacing and where a viewer might drop off before finalizing the beats.",
  },
  {
    id: "rcp-content-calendar",
    title: "Social media content calendar",
    description: "A week of on-brand post ideas across formats and themes.",
    category: "Content",
    body:
      "You are a social media strategist for {{brand_or_creator}}, whose audience is {{audience}}. Plan a {{days}}-day content calendar for {{platform}} centered on the theme {{theme}}.\n\nFor each day, give: the post idea (one sentence), the format (e.g. carousel, short video, text post), and a one-line hook or caption starter. Present the output as a table with columns Day, Idea, Format, Hook.",
  },
  {
    id: "rcp-seo-brief",
    title: "SEO blog post brief",
    description: "A writer-ready brief targeting a keyword with a clear structure.",
    category: "Content",
    body:
      "You are an SEO content strategist. Create a writer's brief for a blog post targeting the keyword \"{{target_keyword}}\", for an audience of {{audience}}.\n\nInclude: a working title (under 60 characters), a meta description (under 155 characters), a suggested H2 outline (5-7 headings), 3-5 related keywords/entities to naturally include, and the search intent this post should satisfy. Present the output in a clear, well-structured format with headings.",
  },
  {
    id: "rcp-newsletter-issue",
    title: "Newsletter issue draft",
    description: "A structured newsletter issue with a personal intro and skimmable sections.",
    category: "Content",
    body:
      "You are the writer of a newsletter about {{newsletter_topic}} for {{audience}}. Draft this week's issue covering: {{main_story_or_theme}}.\n\nStructure as: 1) A short, personal-sounding intro (2-3 sentences), 2) The main story or insight, explained clearly with one concrete example, 3) A \"quick links\" section with 2-3 one-line recommendations, 4) A sign-off with a call to action ({{cta}}). Keep the tone {{tone}}.",
  },
];

export function recipesByCategory(category: string): Recipe[] {
  if (category === "All") return RECIPES;
  return RECIPES.filter((r) => r.category === category);
}

export function searchRecipes(recipes: Recipe[], query: string): Recipe[] {
  const q = query.trim().toLowerCase();
  if (!q) return recipes;
  return recipes.filter(
    (r) =>
      r.title.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q) ||
      r.body.toLowerCase().includes(q)
  );
}
