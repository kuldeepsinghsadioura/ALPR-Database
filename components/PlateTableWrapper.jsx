"use client";

import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import PlateTable from "./PlateTable";
import {
  getLatestPlateReads,
  getTags,
  addKnownPlate,
  tagPlate,
  untagPlate,
  deletePlateRead,
} from "@/app/actions";

export function PlateTableWrapper() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [availableTags, setAvailableTags] = useState([]);

  // Get current query parameters
  const page = searchParams.get("page") || "1";
  const pageSize = searchParams.get("pageSize") || "25";
  const search = searchParams.get("search") || "";
  const fuzzySearch = searchParams.get("fuzzySearch") === "true";
  const tag = searchParams.get("tag") || "all";
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  // Load initial data and tags
  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      try {
        const [platesResult, tagsResult] = await Promise.all([
          getLatestPlateReads({
            page: parseInt(page),
            pageSize: parseInt(pageSize),
            search,
            fuzzySearch,
            tag,
            dateRange:
              dateFrom && dateTo ? { from: dateFrom, to: dateTo } : null,
          }),
          getTags(),
        ]);

        // Update data if we have it (removed success check)
        if (platesResult.data) {
          setData(platesResult.data);
          setTotal(platesResult.pagination.total);
        }

        if (tagsResult.success) {
          setAvailableTags(tagsResult.data);
        }
      } catch (error) {
        console.error("Error loading initial data:", error);
      }
      setLoading(false);
    };

    loadInitialData();
  }, [page, pageSize, search, fuzzySearch, tag, dateFrom, dateTo]);

  const createQueryString = useCallback(
    (params) => {
      const current = new URLSearchParams(Array.from(searchParams.entries()));
      Object.entries(params).forEach(([key, value]) => {
        if (value === null || value === undefined || value === "") {
          current.delete(key);
        } else {
          current.set(key, value);
        }
      });
      return current.toString();
    },
    [searchParams]
  );

  const handleAddTag = async (plateNumber, tagName) => {
    const formData = new FormData();
    formData.append("plateNumber", plateNumber);
    formData.append("tagName", tagName);

    const result = await tagPlate(formData);
    if (result.success) {
      setData((prevData) =>
        prevData.map((plate) => {
          if (plate.plate_number === plateNumber) {
            const newTag = availableTags.find((t) => t.name === tagName);
            return {
              ...plate,
              tags: [...(plate.tags || []), newTag],
            };
          }
          return plate;
        })
      );
    }
  };

  const handleRemoveTag = async (plateNumber, tagName) => {
    const formData = new FormData();
    formData.append("plateNumber", plateNumber);
    formData.append("tagName", tagName);

    const result = await untagPlate(formData);
    if (result.success) {
      setData((prevData) =>
        prevData.map((plate) => {
          if (plate.plate_number === plateNumber) {
            return {
              ...plate,
              tags: (plate.tags || []).filter((tag) => tag.name !== tagName),
            };
          }
          return plate;
        })
      );
    }
  };

  const handleAddKnownPlate = async (plateNumber, name, notes) => {
    const formData = new FormData();
    formData.append("plateNumber", plateNumber);
    formData.append("name", name);
    formData.append("notes", notes);

    const result = await addKnownPlate(formData);
    if (result.success) {
      setData((prevData) =>
        prevData.map((plate) =>
          plate.plate_number === plateNumber
            ? { ...plate, known_name: name, known_notes: notes }
            : plate
        )
      );
    }
  };

  const handleDeleteRecord = async (plateNumber) => {
    const formData = new FormData();
    formData.append("plateNumber", plateNumber);

    const result = await deletePlateRead(formData);
    if (result.success) {
      setData((prevData) =>
        prevData.filter((plate) => plate.plate_number !== plateNumber)
      );
      setTotal((prev) => prev - 1);
    }
  };

  const handlePageChange = useCallback(
    (direction) => {
      const currentPage = parseInt(page);
      const newPage = direction === "next" ? currentPage + 1 : currentPage - 1;

      if (
        newPage < 1 ||
        (direction === "next" && currentPage * parseInt(pageSize) >= total)
      ) {
        return;
      }

      const queryString = createQueryString({ page: newPage.toString() });
      router.push(`${pathname}?${queryString}`);
    },
    [page, pageSize, total, router, pathname, createQueryString]
  );

  const updateFilters = useCallback(
    (newParams) => {
      if ("page" in newParams) return;

      const queryString = createQueryString({
        ...Object.fromEntries(searchParams.entries()),
        ...newParams,
        page: "1", // Reset to first page on filter change
      });
      router.push(`${pathname}?${queryString}`);
    },
    [router, pathname, searchParams, createQueryString]
  );

  return (
    <PlateTable
      data={data}
      loading={loading}
      availableTags={availableTags}
      pagination={{
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total,
        onNextPage: () => handlePageChange("next"),
        onPreviousPage: () => handlePageChange("prev"),
      }}
      filters={{
        search,
        fuzzySearch,
        tag,
        dateRange: {
          from: dateFrom ? new Date(dateFrom) : null,
          to: dateTo ? new Date(dateTo) : null,
        },
      }}
      onUpdateFilters={updateFilters}
      onAddTag={handleAddTag}
      onRemoveTag={handleRemoveTag}
      onAddKnownPlate={handleAddKnownPlate}
      onDeleteRecord={handleDeleteRecord}
    />
  );
}
