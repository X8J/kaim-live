/**
 * Hiring roles — edit this file only.
 *
 * - open: true  → listed under “Open Positions”, appears in the apply form, shows “Apply now”.
 * - open: false → listed under “Filled positions…”, no apply button.
 *
 * Order here is display order (open roles first in file, then closed — the page splits by `open`).
 *
 * icon: must match a key in ROLE_ICONS in main.js. When adding a new visual, add the SVG key there.
 */
window.KAIM_ROLES = [
  {
    id: 'concept-artist',
    open: true,
    icon: 'concept',
    title: 'Concept Artist / Thumbnail Strategist',
    meta: 'Both channels',
    badge: 'Part-time',
    description:
      'Good drawing skills, understanding of thumbnail fundamentals, and a strong grasp of rules of composition. Translate video ideas into compelling visual concepts for both channels.',
    applyValue: 'Concept Artist / Thumbnail Strategist'
  },
  {
    id: 'channel-production-manager',
    open: true,
    icon: 'manager',
    title: 'Channel Manager',
    meta: 'Both channels',
    badge: 'Full-time',
    description:
      'Managing the team, analyzing statistics, outreach, and handling business inquiries across both channels.',
    applyValue: 'Channel Manager'
  },
  {
    id: 'community-manager',
    open: false,
    icon: 'community',
    title: 'Community Manager',
    meta: 'Discord + socials',
    badge: 'Volunteer',
    description:
      'Moderate the KaiM Discord server, engage with the community, and help manage social media presence.'
  },
  {
    id: 'thumbnail-artist',
    open: false,
    icon: 'thumbnail',
    title: 'Thumbnail Artist',
    meta: 'Both channels',
    badge: 'Full-time',
    description:
      'Create eye-catching thumbnails for both KaiM and KaiAim channels. Proficient in Blender and Photoshop.'
  },
  {
    id: 'vfx-artist',
    open: false,
    icon: 'vfx',
    title: 'Visual Effects Artist',
    meta: 'KaiM channel \u00b7 long-form',
    badge: 'Full-time',
    description:
      'Edit long-form YouTube videos for the main KaiM channel. Must be comfortable learning a new style heavy in motion graphics. Not entry level.'
  },
  {
    id: 'video-cutter',
    open: false,
    icon: 'cutter',
    title: 'Video Cutter',
    meta: 'Both channels \u00b7 long-form',
    badge: 'Full-time',
    description:
      'Needs a deep understanding of retention and how to weave a compelling story from raw footage. Responsible for structuring and cutting long-form content for the main KaiM channel.'
  }
];
