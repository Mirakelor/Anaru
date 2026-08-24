import type { Clip, Episode, Series } from './types';

// Story order for sequential playback: every clip of a series in episode
// order, and clips within an episode in scene order. clip.order only indexes
// scenes inside one episode, so sorting by it alone would interleave episodes.
export function storyOrder(clips: Clip[], episodes: Episode[], series: Series[]): Clip[] {
  const epIndex = new Map<number, number>();
  for (const ep of episodes) epIndex.set(ep.id!, ep.index);
  const seriesOrder = new Map<number, number>();
  [...series]
    .sort((a, b) => a.addedAt - b.addedAt)
    .forEach((s, i) => seriesOrder.set(s.id!, i));
  return [...clips].sort((a, b) => {
    const sa = seriesOrder.get(a.seriesId) ?? 0;
    const sb = seriesOrder.get(b.seriesId) ?? 0;
    if (sa !== sb) return sa - sb;
    const ea = epIndex.get(a.episodeId) ?? 0;
    const eb = epIndex.get(b.episodeId) ?? 0;
    if (ea !== eb) return ea - eb;
    return a.order - b.order;
  });
}
