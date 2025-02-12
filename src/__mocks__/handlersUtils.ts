import { http, HttpResponse } from 'msw';

import { server } from '../setupTests';
import { Event } from '../types';

// ! Hard 여기 제공 안함
export const setupMockHandlerCreation = (initEvents = [] as Event[]) => {
  const mockEvents: Event[] = [...initEvents];

  server.use(
    http.get('/api/events', () => {
      return HttpResponse.json({ events: mockEvents });
    }),
    http.post('/api/events', async ({ request }) => {
      const newEvent = (await request.json()) as Event;

      // 반복 일정인 경우 처리
      if (newEvent.repeat.type !== 'none') {
        const startDate = new Date(newEvent.date);
        const endDate = newEvent.repeat.endDate ? new Date(newEvent.repeat.endDate) : new Date(startDate);
        const recurringEvents: Event[] = [];

        let currentDate = new Date(startDate);
        const repeatId = Math.random().toString(); // 반복 일정 그룹화 ID

        while (currentDate <= endDate) {
          // 주간 반복인 경우 요일 체크
          if (newEvent.repeat.type === 'weekly' && 
              newEvent.repeat.weekdays?.includes(currentDate.getDay())) {
            recurringEvents.push({
              ...newEvent,
              id: Math.random().toString(),
              date: currentDate.toISOString().split('T')[0],
              repeat: {
                ...newEvent.repeat,
                id: repeatId
              }
            });
          }

          // 다음 날짜 계산 (주간 반복)
          currentDate.setDate(currentDate.getDate() + 7);
        } 
        mockEvents.push(...recurringEvents);
        return HttpResponse.json(recurringEvents[0], { status: 201 });
      } else {
        // 단일 일정 처리
        newEvent.id = String(mockEvents.length + 1); // 간단한 ID 생성
        mockEvents.push(newEvent);
        return HttpResponse.json(newEvent, { status: 201 });
      }
    })
  );
};

export const setupMockHandlerUpdating = () => {
  const mockEvents: Event[] = [
    {
      id: '1',
      title: '기존 회의',
      date: '2024-10-15',
      startTime: '09:00',
      endTime: '10:00',
      description: '기존 팀 미팅',
      location: '회의실 B',
      category: '업무',
      repeat: { type: 'none', interval: 0 },
      notificationTime: 10,
    },
    {
      id: '2',
      title: '기존 회의2',
      date: '2024-10-15',
      startTime: '11:00',
      endTime: '12:00',
      description: '기존 팀 미팅 2',
      location: '회의실 C',
      category: '업무 회의',
      repeat: { type: 'none', interval: 0 },
      notificationTime: 5,
    },
  ];

  server.use(
    http.get('/api/events', () => {
      return HttpResponse.json({ events: mockEvents });
    }),
    http.put('/api/events/:id', async ({ params, request }) => {
      const { id } = params;
      const updatedEvent = (await request.json()) as Event;
      const index = mockEvents.findIndex((event) => event.id === id);

      mockEvents[index] = { ...mockEvents[index], ...updatedEvent };
      return HttpResponse.json(mockEvents[index]);
    })
  );
};

export const setupMockHandlerDeletion = () => {
  const mockEvents: Event[] = [
    {
      id: '1',
      title: '삭제할 이벤트',
      date: '2024-10-15',
      startTime: '09:00',
      endTime: '10:00',
      description: '삭제할 이벤트입니다',
      location: '어딘가',
      category: '기타',
      repeat: { type: 'none', interval: 0 },
      notificationTime: 10,
    },
  ];

  server.use(
    http.get('/api/events', () => {
      return HttpResponse.json({ events: mockEvents });
    }),
    http.delete('/api/events/:id', ({ params }) => {
      const { id } = params;
      const index = mockEvents.findIndex((event) => event.id === id);

      mockEvents.splice(index, 1);
      return new HttpResponse(null, { status: 204 });
    })
  );
};
