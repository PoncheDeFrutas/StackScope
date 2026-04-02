import { useState, useCallback, useRef, useEffect } from 'react';
import { HostClient } from '../rpc/HostClient.js';

/** Default page size in bytes */
export const PAGE_SIZE = 4096;

/** Overscan pages to load ahead/behind visible area */
export const OVERSCAN_PAGES = 2;

/** Page state */
export interface MemoryPage {
	/** Page start offset from document base */
	offset: number;
	/** Page data (null = unreadable byte) */
	data: (number | null)[];
	/** Resolved address for this page */
	address: string;
	/** Loading state */
	loading: boolean;
	/** Error if load failed */
	error?: string;
}

/** Paged memory state */
export interface PagedMemoryState {
	/** Document ID being viewed */
	documentId: string | null;
	/** Base address of document */
	baseAddress: string;
	/** Total size to display */
	totalSize: number;
	/** Cached pages by offset */
	pages: Map<number, MemoryPage>;
	/** Pages currently being fetched */
	inFlight: Set<number>;
}

/** Return type for usePagedMemory hook */
export interface UsePagedMemoryResult {
	/** Current state */
	state: PagedMemoryState;
	/** Load pages for visible range */
	loadRange: (startOffset: number, endOffset: number) => void;
	/** Get bytes for a range (returns null for unloaded) */
	getBytes: (offset: number, count: number) => (number | null)[] | null;
	/** Reset cache for new document */
	reset: (documentId: string, baseAddress: string, totalSize: number) => void;
	/** Refresh all loaded pages */
	refreshAll: () => Promise<void>;
	/** Check if any page is loading */
	isLoading: boolean;
}

/**
 * Hook for managing paged memory with lazy loading.
 * Loads pages on demand as user scrolls.
 */
export function usePagedMemory(): UsePagedMemoryResult {
	const [state, setState] = useState<PagedMemoryState>({
		documentId: null,
		baseAddress: '0x0',
		totalSize: 0,
		pages: new Map(),
		inFlight: new Set(),
	});

	// Track mounted state to avoid state updates after unmount
	const mountedRef = useRef(true);
	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
		};
	}, []);

	/**
	 * Calculates page-aligned offset.
	 */
	const alignToPage = useCallback((offset: number): number => {
		return Math.floor(offset / PAGE_SIZE) * PAGE_SIZE;
	}, []);

	/**
	 * Loads a single page.
	 */
	const loadPage = useCallback(
		async (documentId: string, pageOffset: number): Promise<void> => {
			// Skip if already loaded or in flight
			setState((prev) => {
				if (prev.pages.has(pageOffset) || prev.inFlight.has(pageOffset)) {
					return prev;
				}
				return {
					...prev,
					inFlight: new Set(prev.inFlight).add(pageOffset),
				};
			});

			try {
				const result = await HostClient.readMemory(documentId, pageOffset, PAGE_SIZE);

				if (!mountedRef.current) {
					return;
				}

				setState((prev) => {
					if (prev.documentId !== documentId) {
						return prev;
					}

					const resolvedBaseAddress = resolveBaseAddress(result.address, pageOffset);
					const newPages = new Map(prev.pages);
					newPages.set(pageOffset, {
						offset: pageOffset,
						data: result.data,
						address: result.address,
						loading: false,
					});

					const newInFlight = new Set(prev.inFlight);
					newInFlight.delete(pageOffset);

					return {
						...prev,
						baseAddress: resolvedBaseAddress ?? prev.baseAddress,
						pages: newPages,
						inFlight: newInFlight,
					};
				});
			} catch (err) {
				if (!mountedRef.current) {
					return;
				}

				const message = err instanceof Error ? err.message : 'Load failed';

				// Don't set error for "not stopped" - just clear inflight
				if (message.toLowerCase().includes('not stopped')) {
					setState((prev) => {
						const newInFlight = new Set(prev.inFlight);
						newInFlight.delete(pageOffset);
						return { ...prev, inFlight: newInFlight };
					});
					return;
				}

				setState((prev) => {
					if (prev.documentId !== documentId) {
						return prev;
					}

					const newPages = new Map(prev.pages);
					newPages.set(pageOffset, {
						offset: pageOffset,
						data: new Array(PAGE_SIZE).fill(null),
						address: '0x0',
						loading: false,
						error: message,
					});

					const newInFlight = new Set(prev.inFlight);
					newInFlight.delete(pageOffset);

					return {
						...prev,
						pages: newPages,
						inFlight: newInFlight,
					};
				});
			}
		},
		[]
	);

	/**
	 * Loads pages for a visible range with overscan.
	 */
	const loadRange = useCallback(
		(startOffset: number, endOffset: number): void => {
			const docId = state.documentId;
			if (!docId) {
				return;
			}

			// Add overscan
			const overscanStart = Math.max(0, startOffset - OVERSCAN_PAGES * PAGE_SIZE);
			const overscanEnd = Math.min(
				state.totalSize,
				endOffset + OVERSCAN_PAGES * PAGE_SIZE
			);

			// Find pages to load
			const pagesToLoad: number[] = [];
			for (
				let offset = alignToPage(overscanStart);
				offset < overscanEnd;
				offset += PAGE_SIZE
			) {
				if (!state.pages.has(offset) && !state.inFlight.has(offset)) {
					pagesToLoad.push(offset);
				}
			}

			// Load pages in parallel (limit concurrency)
			const MAX_CONCURRENT = 4;
			pagesToLoad.slice(0, MAX_CONCURRENT).forEach((offset) => {
				loadPage(docId, offset);
			});
		},
		[state.documentId, state.totalSize, state.pages, state.inFlight, alignToPage, loadPage]
	);

	/**
	 * Gets bytes for a range from cache.
	 * Returns null if any page in range is not loaded.
	 */
	const getBytes = useCallback(
		(offset: number, count: number): (number | null)[] | null => {
			const result: (number | null)[] = [];

			for (let i = 0; i < count; i++) {
				const byteOffset = offset + i;
				const pageOffset = alignToPage(byteOffset);
				const page = state.pages.get(pageOffset);

				if (!page) {
					return null; // Page not loaded
				}

				const indexInPage = byteOffset - pageOffset;
				result.push(page.data[indexInPage] ?? null);
			}

			return result;
		},
		[state.pages, alignToPage]
	);

	/**
	 * Resets cache for a new document.
	 */
	const reset = useCallback(
		(documentId: string, baseAddress: string, totalSize: number): void => {
			setState({
				documentId,
				baseAddress,
				totalSize,
				pages: new Map(),
				inFlight: new Set(),
			});
		},
		[]
	);

	/**
	 * Refreshes all loaded pages (for dynamic targets on stop).
	 */
	const refreshAll = useCallback(async (): Promise<void> => {
		const docId = state.documentId;
		if (!docId) {
			return;
		}

		const pageOffsets = Array.from(state.pages.keys());
		if (pageOffsets.length === 0) {
			return;
		}

		// Keep existing data visible while refreshing to avoid blank grid on race conditions.
		setState((prev) => ({
			...prev,
			inFlight: new Set([...prev.inFlight, ...pageOffsets]),
		}));

		// Reload all pages
		await Promise.all(pageOffsets.map((offset) => loadPage(docId, offset)));
	}, [state.documentId, state.pages, loadPage]);

	const isLoading = state.inFlight.size > 0;

	return {
		state,
		loadRange,
		getBytes,
		reset,
		refreshAll,
		isLoading,
	};
}

function resolveBaseAddress(address: string, pageOffset: number): string | null {
	try {
		const parsedAddress = BigInt(address);
		const base = parsedAddress - BigInt(pageOffset);
		if (base < 0n) {
			return null;
		}
		return `0x${base.toString(16)}`;
	} catch {
		return null;
	}
}

/**
 * Calculates visible row range based on scroll position.
 */
export function calculateVisibleRange(
	scrollTop: number,
	viewportHeight: number,
	rowHeight: number,
	bytesPerRow: number,
	totalSize: number
): { startOffset: number; endOffset: number; startRow: number; endRow: number } {
	const totalRows = Math.ceil(totalSize / bytesPerRow);
	const startRow = Math.floor(scrollTop / rowHeight);
	const visibleRows = Math.ceil(viewportHeight / rowHeight) + 1;
	const endRow = Math.min(startRow + visibleRows, totalRows);

	return {
		startOffset: startRow * bytesPerRow,
		endOffset: endRow * bytesPerRow,
		startRow,
		endRow,
	};
}
