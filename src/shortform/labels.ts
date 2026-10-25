import type { Beat, Format, Lever, Production, Voice } from "../types.js";

// What each label means, as the model reads it (docs/video-analysis.md).
export const BEAT_TEXT: Record<Beat, string> = {
  hook: "Stops the scroll in the first seconds: a bold claim, question, surprise or problem.",
  setup: "Gives context: who this is, what the problem is, why it matters.",
  value: "The body: the demo, the steps, the story unfolding, the reveal.",
  proof: "Shows it works: results, before/after, reviews, numbers.",
  payoff: "Delivers what the hook promised: the punchline, the result, the twist.",
  cta: "Asks the viewer to act: follow, comment, buy, link in bio.",
};

export const LEVER_TEXT: Record<Lever, string> = {
  curiosity: "Opens a question or gap the viewer wants closed.",
  pattern_interrupt: "A visual or audio surprise that breaks the scroll rhythm.",
  relatable: "A pain point or moment the viewer recognises from their own life.",
  demonstration: "Shows the thing working, so the viewer watches to see the result.",
  social_proof: "Others' results, reviews, numbers or popularity.",
  emotion: "Humor, awe, cuteness or outrage.",
  direct_ask: "Directly asks the viewer to follow, comment, share or buy.",
  none: "Nothing in particular; filler or transition.",
};

export const FORMAT_TEXT: Record<Format, string> = {
  meme: "A meme, joke or trend riding a sound or template; entertainment, not selling.",
  skit: "A scripted comedic or dramatic scene with characters.",
  product_demo: "Shows a product and what it does.",
  tutorial: "Teaches how to do something, step by step.",
  review: "A testimonial, review or recommendation of a product by a user.",
  storytime: "Someone tells a personal story.",
  before_after: "A transformation: the before, then the after.",
  unboxing: "Opens a package or shows a haul of products.",
  behind_the_scenes: "How something is made, packed or run behind the scenes.",
  talking_head: "Someone talking to camera with an opinion, advice or commentary.",
  other: "None of the above.",
};

export const PRODUCTION_TEXT: Record<Production, string> = {
  on_camera_person: "A person on camera carries it: their face, talking or acting.",
  screen_recording: "Mostly a recording of a phone or computer screen.",
  hands_only: "Hands and objects only; no face on camera.",
  broll_voiceover: "Footage of things or places with a voice over it; no one speaking on camera.",
  text_only: "Text or captions over footage or a background carry it.",
  animation: "Animated or generated graphics.",
  mixed: "A mix of the above, none dominant.",
};

export const VOICE_TEXT: Record<Voice, string> = {
  on_camera_speech: "Someone speaks on camera.",
  voiceover: "A voice speaks over the footage, the speaker not on camera.",
  none: "No voice and no music.",
  music_only: "Music or a sound, no one speaking.",
};

/** The hold score's levels, 0 to 4. */
export const HOLD_LEVELS = [
  { label: "scroll", description: "Most viewers would scroll away here." },
  { label: "weak", description: "Some reason to keep watching, easy to leave." },
  { label: "average", description: "Typical for short-form video." },
  { label: "strong", description: "Most viewers would keep watching." },
  { label: "gripping", description: "Nearly impossible to scroll away." },
];
