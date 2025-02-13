import { useMemo, useState } from 'react';

import { Event } from '../types';
import { getFilteredEvents } from '../utils/eventUtils';

export const useSearch = (events: Event[], currentDate: Date, view: 'week' | 'month') => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredEvents = useMemo(() => {
    const filtered = getFilteredEvents(events, searchTerm, currentDate, view);
    // 날짜와 시간순으로 정렬
    return filtered.sort((a, b) => {
      const dateCompair = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateCompair !== 0) return dateCompair;

      // 날짜가 같으면 시작 시간으로 비교
      return a.startTime.localeCompare(b.startTime);
    });
  }, [events, searchTerm, currentDate, view]);

  return {
    searchTerm,
    setSearchTerm,
    filteredEvents,
  };
};
