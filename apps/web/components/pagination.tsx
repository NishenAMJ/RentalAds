"use client";
export function Pagination({
  page,
  hasNextPage,
  loading,
  onPageChange,
}: {
  page: number;
  hasNextPage: boolean;
  loading: boolean;
  onPageChange: (page: number) => void;
}) {
  return (
    <nav className="pagination" aria-label="Pagination">
      <button
        type="button"
        className="secondary"
        disabled={loading || page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        Previous
      </button>
      <span role="status">Page {page}</span>
      <button
        type="button"
        className="secondary"
        disabled={loading || !hasNextPage}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </button>
    </nav>
  );
}
