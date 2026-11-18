import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { POPULAR_ID } from "./channels";
import { getPopularTvs, getTvCategories, getTvPage, searchTvs, type TvPage } from "./tv.functions";

export const tvCategoriesQuery = () =>
  queryOptions({
    queryKey: ["tv-categories"],
    queryFn: () => getTvCategories(),
    staleTime: 5 * 60_000,
  });

/** `idx` walks through the categories for the "All" list; a single category keeps idx 0. */
export interface TvPageParam {
  idx: number;
  page: number;
}

export type TvListPage = TvPage & { idx: number };

const EMPTY: TvListPage = { channels: [], page: 1, totalPages: 1, count: 0, error: null, idx: 0 };

/**
 * Channel list for one category, "All" (categoryId null, every category in turn),
 * or a search across the whole feed when `search` is set.
 */
export const tvChannelsQuery = (categoryId: number | null, search: string, allIds: number[]) =>
  infiniteQueryOptions({
    queryKey: ["tv-channels", categoryId, search],
    queryFn: async ({ pageParam }): Promise<TvListPage> => {
      if (search) return { ...(await searchTvs({ data: { search } })), idx: 0 };
      if (categoryId === POPULAR_ID) return { ...(await getPopularTvs()), idx: 0 };
      const id = categoryId ?? allIds[pageParam.idx];
      if (id == null) return EMPTY;
      return { ...(await getTvPage({ data: { categoryId: id, page: pageParam.page } })), idx: pageParam.idx };
    },
    initialPageParam: { idx: 0, page: 1 } as TvPageParam,
    getNextPageParam: (last): TvPageParam | undefined => {
      if (search || last.error) return undefined;
      if (last.page < last.totalPages) return { idx: last.idx, page: last.page + 1 };
      if (categoryId == null && last.idx + 1 < allIds.length) return { idx: last.idx + 1, page: 1 };
      return undefined;
    },
    staleTime: 60_000,
  });
