create or replace function public.get_tag_counts_for_user()
returns table(tag_id text, book_count bigint)
language sql
security definer
set search_path = public
as $$
  select merged.tag_id, count(*)::bigint as book_count
  from (
    select distinct ul.id, tag_id
    from public.user_library ul
    cross join lateral jsonb_array_elements_text(
      coalesce(ul.book_data->'customTags', '[]'::jsonb) ||
      coalesce(ul.book_data->'autoTags', '[]'::jsonb)
    ) as tag_id
    where ul.user_id = (select auth.uid())
  ) merged
  group by merged.tag_id;
$$;

create or replace function public.get_books_by_tags(
  tags_to_filter text[],
  filter_by_favorites boolean
)
returns setof public.user_library
language sql
stable
security invoker
set search_path = public
as $$
  select ul.*
  from public.user_library ul
  where ul.user_id = (select auth.uid())
    and (
      coalesce(array_length(tags_to_filter, 1), 0) = 0
      or tags_to_filter <@ (
        select array_agg(distinct tag_id)
        from jsonb_array_elements_text(
          coalesce(ul.book_data->'customTags', '[]'::jsonb) ||
          coalesce(ul.book_data->'autoTags', '[]'::jsonb)
        ) as tag_id
      )
    )
    and (
      filter_by_favorites is not true
      or coalesce((ul.book_data->>'isFavorite')::boolean, false) is true
    )
  order by ul.created_at desc;
$$;
