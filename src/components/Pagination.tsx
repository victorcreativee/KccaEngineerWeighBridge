"use client";

import { useRef } from "react";

export const DEFAULT_PAGE_SIZE = 20;

export function pageItems<T>(items: T[], page: number, pageSize = DEFAULT_PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  return { currentPage, totalPages, items: items.slice((currentPage - 1) * pageSize, currentPage * pageSize) };
}

export function Pagination({ page, totalItems, onChange, pageSize = DEFAULT_PAGE_SIZE, label = "records" }: { page: number; totalItems: number; onChange: (page: number) => void; pageSize?: number; label?: string }) {
  const navigation = useRef<HTMLElement>(null);
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1).filter((number) => number === 1 || number === totalPages || Math.abs(number - currentPage) <= 1);
  function changePage(nextPage: number) { onChange(nextPage); window.requestAnimationFrame(() => navigation.current?.closest("section")?.scrollIntoView({ behavior: "smooth", block: "start" })); }
  return <nav ref={navigation} className="pagination" aria-label={`${label} pages`}>
    <span>{totalItems} {label} · Page {currentPage} of {totalPages}</span>
    <div>
      <button type="button" onClick={() => changePage(currentPage - 1)} disabled={currentPage === 1}>← Previous</button>
      {pages.map((number, index) => <span key={number}>{index > 0 && pages[index - 1] !== number - 1 && <i aria-hidden="true">…</i>}<button type="button" className={number === currentPage ? "current" : ""} aria-current={number === currentPage ? "page" : undefined} onClick={() => changePage(number)}>{number}</button></span>)}
      <button type="button" onClick={() => changePage(currentPage + 1)} disabled={currentPage === totalPages}>Next →</button>
    </div>
  </nav>;
}
