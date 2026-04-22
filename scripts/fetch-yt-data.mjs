#!/usr/bin/env node
/**
 * Fetches public YouTube stats + KaiM top 6 + KaiAim featured top video, writes public/yt-data.json.
 * Run locally: YT_API_KEY=... node scripts/fetch-yt-data.mjs
 */
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const YT_API_KEY = process.env.YT_API_KEY;
if (!YT_API_KEY) {
  process.stderr.write('Error: YT_API_KEY environment variable is not set.\n');
  process.exit(1);
}

const TOP_VIDEO_COUNT = 6;
const KAIAIM_FEATURED_COUNT = 1;

const CHANNELS = {
  kaim: {
    key: 'kaim',
    handle: 'SubToKaiM',
    topVideoLimit: TOP_VIDEO_COUNT,
  },
  kaiaim: {
    key: 'kaiaim',
    handle: 'AimKaiM',
    topVideoLimit: KAIAIM_FEATURED_COUNT,
  },
};

const OUTPUT_PATH = new URL('../public/yt-data.json', import.meta.url);
const OUTPUT_FILE = fileURLToPath(OUTPUT_PATH);
const YT_BASE = 'https://www.googleapis.com/youtube/v3/';

function formatThousands(n) {
  const v = Math.floor(Number(n));
  if (v < 1000) return String(v);
  const k = v / 1000;
  if (k >= 100) return `${Math.floor(k)}K`;
  if (k >= 10) return `${Math.floor(k)}K`;
  const one = Math.floor(k * 10) / 10;
  const s = Number.isInteger(one) ? String(one) : one.toFixed(1).replace(/\.0$/, '');
  return `${s}K`;
}

/** Channel totals, subscribers, and per-video badges — no trailing + */
function formatChannelNumber(n) {
  const v = Math.floor(Number(n));
  if (v < 1000) return String(v);
  if (v < 1_000_000) return formatThousands(v);
  if (v < 1_000_000_000) {
    const m = v / 1_000_000;
    if (m >= 100) return `${Math.floor(m)}M`;
    if (m >= 10) return `${Math.floor(m)}M`;
    const one = Math.floor(m * 10) / 10;
    const s = Number.isInteger(one) ? String(one) : one.toFixed(1).replace(/\.0$/, '');
    return `${s}M`;
  }
  const b = v / 1_000_000_000;
  if (b >= 100) return `${Math.floor(b)}B`;
  if (b >= 10) return `${Math.floor(b)}B`;
  const one = Math.floor(b * 10) / 10;
  const s = Number.isInteger(one) ? String(one) : one.toFixed(1).replace(/\.0$/, '');
  return `${s}B`;
}

function thumbnailUrl(snippet, videoId) {
  return (
    snippet?.thumbnails?.maxres?.url ??
    `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`
  );
}

function toRankedVideoJson(row, idx, previousRanks) {
  const rank = idx + 1;
  const { id, views, raw } = row;
  const sn = raw.snippet || {};
  const previousRank = previousRanks.has(id) ? previousRanks.get(id) : null;
  const isNewEntry = previousRank === null;
  const rankDelta = isNewEntry ? null : previousRank - rank;
  return {
    rank,
    previousRank,
    rankDelta,
    isNewEntry,
    isTopThree: rank <= 3,
    videoId: id,
    title: sn.title || '',
    thumbnail: thumbnailUrl(sn, id),
    viewCount: views,
    viewCountFormatted: formatChannelNumber(views),
    publishedAt: sn.publishedAt || '',
  };
}

async function yt(pathname, params) {
  const rel = pathname.startsWith('/') ? pathname.slice(1) : pathname;
  const u = new URL(rel, YT_BASE);
  for (const [k, val] of Object.entries(params)) {
    if (val !== undefined && val !== null) u.searchParams.set(k, String(val));
  }
  u.searchParams.set('key', YT_API_KEY);
  const res = await fetch(u);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`YouTube API ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function readPreviousState() {
  const kaimRanks = new Map();
  let kaiaimFeaturedVideoId = null;
  try {
    const raw = await fs.readFile(OUTPUT_FILE, 'utf8');
    const prev = JSON.parse(raw);
    for (const v of prev.topVideos ?? []) {
      if (v && v.videoId != null && typeof v.rank === 'number') {
        kaimRanks.set(v.videoId, v.rank);
      }
    }
    if (prev.kaiaimFeaturedVideo?.videoId) {
      kaiaimFeaturedVideoId = prev.kaiaimFeaturedVideo.videoId;
    }
  } catch {
    // first run or missing file
  }
  return { kaimRanks, kaiaimFeaturedVideoId };
}

async function fetchChannelByHandle(handle) {
  const data = await yt('/channels', {
    part: 'statistics,snippet,contentDetails',
    forHandle: handle,
  });
  const item = data.items && data.items[0];
  if (!item) throw new Error(`No channel found for handle @${handle}`);
  return item;
}

async function collectUploadVideoIds(uploadsPlaylistId) {
  const ids = [];
  let pageToken = '';
  do {
    const data = await yt('/playlistItems', {
      part: 'contentDetails',
      playlistId: uploadsPlaylistId,
      maxResults: 50,
      pageToken: pageToken || undefined,
    });
    for (const it of data.items || []) {
      const vid = it.contentDetails && it.contentDetails.videoId;
      if (vid) ids.push(vid);
    }
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return ids;
}

async function fetchVideoStatsBatched(videoIds) {
  const stats = new Map();
  const chunk = 50;
  for (let i = 0; i < videoIds.length; i += chunk) {
    const slice = videoIds.slice(i, i + chunk);
    const data = await yt('/videos', {
      part: 'statistics,snippet',
      id: slice.join(','),
    });
    for (const v of data.items || []) {
      stats.set(v.id, v);
    }
  }
  return stats;
}

function buildChannelBlock(handle, item) {
  const st = item.statistics || {};
  const subsHidden =
    st.hiddenSubscriberCount === true || st.subscriberCount === undefined;
  const totalViews = Number(st.viewCount || 0);
  const subscribers = subsHidden ? null : Number(st.subscriberCount || 0);
  return {
    handle: `@${handle}`,
    totalViews,
    totalViewsFormatted: formatChannelNumber(totalViews),
    subscribers: subscribers !== null ? subscribers : null,
    subscribersFormatted: subsHidden ? 'hidden' : formatChannelNumber(subscribers),
  };
}

async function main() {
  const { kaimRanks, kaiaimFeaturedVideoId } = await readPreviousState();

  const out = {
    fetchedAt: new Date().toISOString(),
    channels: {},
    topVideos: [],
    kaiaimFeaturedVideo: null,
  };

  for (const def of Object.values(CHANNELS)) {
    const item = await fetchChannelByHandle(def.handle);
    out.channels[def.key] = buildChannelBlock(def.handle, item);

    const limit = def.topVideoLimit;
    if (!limit) continue;

    const uploadsId =
      item.contentDetails &&
      item.contentDetails.relatedPlaylists &&
      item.contentDetails.relatedPlaylists.uploads;
    if (!uploadsId) {
      throw new Error(`Missing uploads playlist for @${def.handle}`);
    }

    const allIds = await collectUploadVideoIds(uploadsId);
    const details = await fetchVideoStatsBatched(allIds);

    const scored = [];
    for (const id of allIds) {
      const v = details.get(id);
      if (!v || !v.statistics) continue;
      const views = parseInt(v.statistics.viewCount, 10) || 0;
      scored.push({ id, views, raw: v });
    }
    scored.sort((a, b) => b.views - a.views);
    const top = scored.slice(0, limit);

    if (def.key === 'kaim') {
      out.topVideos = top.map((row, idx) => toRankedVideoJson(row, idx, kaimRanks));
    } else if (def.key === 'kaiaim') {
      if (!top.length) {
        out.kaiaimFeaturedVideo = null;
      } else {
        const row = top[0];
        const id = row.id;
        const sn = row.raw.snippet || {};
        const views = row.views;
        const previousRank = kaiaimFeaturedVideoId === id ? 1 : null;
        const isNewEntry = previousRank === null;
        const rankDelta = isNewEntry ? null : previousRank - 1;
        out.kaiaimFeaturedVideo = {
          rank: 1,
          previousRank,
          rankDelta,
          isNewEntry,
          isTopThree: true,
          videoId: id,
          title: sn.title || '',
          thumbnail: thumbnailUrl(sn, id),
          viewCount: views,
          viewCountFormatted: formatChannelNumber(views),
          publishedAt: sn.publishedAt || '',
        };
      }
    }
  }

  await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log(
    `Wrote ${OUTPUT_FILE} (topVideos=${out.topVideos.length}, kaiaimFeatured=${out.kaiaimFeaturedVideo ? 'yes' : 'no'}, fetchedAt=${out.fetchedAt})`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
