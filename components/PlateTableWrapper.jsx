'use client';

import { useSearchParams, usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import PlateTable from './PlateTable';
import { 
  getLatestPlateReads, 
  getTags, 
  addKnownPlate as addKnownPlateAction,
  tagPlate as tagPlateAction,
  untagPlate as untagPlateAction,
  deletePlate as deletePlateAction
} from '@/app/actions';

export function PlateTableWrapper() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [availableTags, setAvailableTags] = useState([]);

  // Get current query parameters
  const page = searchParams.get('page') || '1';
  const pageSize = searchParams.get('pageSize') || '25';
  const search = searchParams.get('search') || '';
  const tag = searchParams.get('tag') || 'all';
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');

  // Load tags
  useEffect(() => {
    const loadTags = async () => {
      const result = await getTags();
      if (result.success) {
        setAvailableTags(result.data);
      }
    }
    loadTags();
  }, []);

  // URL update helper
  const createQueryString = useCallback(
    (params) => {
      const current = new URLSearchParams(Array.from(searchParams.entries()));
      Object.entries(params).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') {
          current.delete(key);
        } else {
          current.set(key, value);
        }
      });
      return current.toString();
    },
    [searchParams]
  );

//   // Update URL and fetch data
//   const updateFilters = useCallback((newParams) => {
//     const queryString = createQueryString({
//       ...Object.fromEntries(searchParams.entries()),
//       ...newParams,
//       page: '1' // Reset to first page on filter change
//     });
//     router.push(`${pathname}?${queryString}`);
//   }, [router, pathname, searchParams, createQueryString]);

  const handleAddTag = async (plateNumber, tagName) => {
    // Find the tag details from availableTags
    const tagDetails = availableTags.find(t => t.name === tagName);
    if (!tagDetails) return;

    // Store the previous state for rollback
    const previousData = [...data];

    // Optimistically update the UI
    setData(currentData => 
      currentData.map(plate => 
        plate.plate_number === plateNumber
          ? {
              ...plate,
              tags: [...(plate.tags || []), tagDetails]
            }
          : plate
      )
    );

    // Call the server action
    const formData = new FormData();
    formData.append('plateNumber', plateNumber);
    formData.append('tagName', tagName);
    
    const result = await tagPlateAction(formData);
    
    if (!result.success) {
      // Revert the optimistic update if the server call failed
      setData(previousData);
      console.error('Failed to add tag:', result.error);
    }
  };

  const handleRemoveTag = async (plateNumber, tagName) => {
    // Store the previous state for rollback
    const previousData = [...data];

    // Optimistically update the UI
    setData(currentData => 
      currentData.map(plate => 
        plate.plate_number === plateNumber
          ? {
              ...plate,
              tags: (plate.tags || []).filter(tag => tag.name !== tagName)
            }
          : plate
      )
    );

    // Call the server action
    const formData = new FormData();
    formData.append('plateNumber', plateNumber);
    formData.append('tagName', tagName);
    
    const result = await untagPlateAction(formData);
    
    if (!result.success) {
      // Revert the optimistic update if the server call failed
      setData(previousData);
      console.error('Failed to remove tag:', result.error);
    }
  };

  const handleAddKnownPlate = async (plateNumber, name, notes) => {
    // Store the previous state for rollback
    const previousData = [...data];

    // Optimistically update the UI
    setData(currentData => 
      currentData.map(plate => 
        plate.plate_number === plateNumber
          ? {
              ...plate,
              known_name: name,
              known_notes: notes
            }
          : plate
      )
    );

    // Call the server action
    const formData = new FormData();
    formData.append('plateNumber', plateNumber);
    formData.append('name', name);
    formData.append('notes', notes);
    
    const result = await addKnownPlateAction(formData);
    
    if (!result.success) {
      // Revert the optimistic update if the server call failed
      setData(previousData);
      console.error('Failed to add known plate:', result.error);
    }
  };

  const handleDeleteRecord = async (plateNumber) => {
    // Store the previous state for rollback
    const previousData = [...data];
    const previousTotal = total;

    // Optimistically update the UI
    setData(currentData => currentData.filter(plate => plate.plate_number !== plateNumber));
    setTotal(prev => prev - 1);

    // Call the server action
    const formData = new FormData();
    formData.append('plateNumber', plateNumber);
    
    const result = await deletePlateAction(formData);
    
    if (!result.success) {
      // Revert the optimistic update if the server call failed
      setData(previousData);
      setTotal(previousTotal);
      console.error('Failed to delete record:', result.error);
    }
  };

  // Fetch data based on URL parameters
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const result = await getLatestPlateReads({
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          search,
          tag,
          dateRange: dateFrom && dateTo ? {
            from: dateFrom,
            to: dateTo
          } : null
        });
        
        setData(result.data);
        setTotal(result.pagination.total);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
      setLoading(false);
    };

    fetchData();
  }, [page, pageSize, search, tag, dateFrom, dateTo]);

  const handlePageChange = (direction) => {
    const currentPage = parseInt(page);
    const newPage = direction === 'next' ? currentPage + 1 : currentPage - 1;
    
    if (newPage < 1 || (direction === 'next' && currentPage * pagination.pageSize >= total)) {
      return;
    }

    const queryString = createQueryString({
      ...Object.fromEntries(searchParams.entries()),
      page: newPage.toString()
    });
    router.push(`${pathname}?${queryString}`);
  };

  const updateFilters = useCallback((newParams) => {
    // Don't handle page changes here
    if ('page' in newParams) return;
    
    const queryString = createQueryString({
      ...Object.fromEntries(searchParams.entries()),
      ...newParams,
      page: '1' // Reset to first page on filter change
    });
    router.push(`${pathname}?${queryString}`);
  }, [router, pathname, searchParams, createQueryString]);

  return (
    <PlateTable
      data={data}
      loading={loading}
      availableTags={availableTags}
      pagination={{
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total,
        onNextPage: () => handlePageChange('next'),
        onPreviousPage: () => handlePageChange('prev')
      }}
      filters={{
        search,
        tag,
        dateRange: {
          from: dateFrom ? new Date(dateFrom) : null,
          to: dateTo ? new Date(dateTo) : null
        }
      }}
      onUpdateFilters={updateFilters}
      onAddTag={handleAddTag}
      onRemoveTag={handleRemoveTag}
      onAddKnownPlate={handleAddKnownPlate}
      onDeleteRecord={handleDeleteRecord}
    />
  );
}