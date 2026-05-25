"use client";

import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { actorsApi, APIError } from "./client";
import { ListActorsQuery, ListActorsResponse, ActorDetail } from "./types";

const QUERY_KEYS = {
  actors: ["actors"],
  actorsList: (query?: ListActorsQuery) => [...QUERY_KEYS.actors, "list", query],
  actorsDetail: (slug: string) => [...QUERY_KEYS.actors, "detail", slug],
};

/**
 * Hook to fetch actors list with filters and search
 */
export function useActorsList(
  query?: ListActorsQuery,
  options?: { enabled?: boolean },
): UseQueryResult<ListActorsResponse, APIError> {
  return useQuery({
    queryKey: QUERY_KEYS.actorsList(query),
    queryFn: () => actorsApi.listActors(query),
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
    retry: 2,
    enabled: options?.enabled !== false,
  });
}

/**
 * Hook to fetch a single actor by slug
 */
export function useActorDetail(
  slug: string,
  options?: { enabled?: boolean },
): UseQueryResult<ActorDetail, APIError> {
  return useQuery({
    queryKey: QUERY_KEYS.actorsDetail(slug),
    queryFn: () => actorsApi.getActor(slug),
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
    retry: 2,
    enabled: !!slug && options?.enabled !== false,
  });
}

export { QUERY_KEYS };
