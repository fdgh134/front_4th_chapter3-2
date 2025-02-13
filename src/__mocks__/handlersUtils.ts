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
        const endDate = newEvent.repeat.endDate
          ? new Date(newEvent.repeat.endDate)
          : new Date(startDate.getFullYear() + 1, startDate.getMonth(), startDate.getDate());

        const recurringEvents: Event[] = [];

        let currentDate = new Date(startDate);
        const repeatId = Math.random().toString(); // 반복 일정 그룹화 ID

        while (currentDate <= endDate) {
          // 반복 타입에 따른 이벤트 생성 처리
          switch (newEvent.repeat.type) {
            case 'weekly': {
              // 주간 반복: weekdays가 있고 해당 요일이 선택된 경우만 생성
              const weekdays = newEvent.repeat.weekdays || [];
              if (weekdays.length > 0 && weekdays.includes(currentDate.getDay())) {
                recurringEvents.push({
                  ...newEvent,
                  id: Math.random().toString(),
                  date: currentDate.toISOString().split('T')[0],
                  repeat: { ...newEvent.repeat, id: repeatId },
                });
              }
              break;
            }
            case 'monthly': {
              // 월간 반복: 해당 월의 마지막 날짜 계산
              const lastDayOfMonth = new Date(
                currentDate.getFullYear(),
                currentDate.getMonth() + 1,
                0
              );
              recurringEvents.push({
                ...newEvent,
                id: Math.random().toString(),
                date: lastDayOfMonth.toISOString().split('T')[0],
                repeat: { ...newEvent.repeat, id: repeatId },
              });
              break;
            }
            case 'daily':
            case 'yearly': {
              // 일간, 연간 반복: 매 날짜마다 생성
              recurringEvents.push({
                ...newEvent,
                id: Math.random().toString(),
                date: currentDate.toISOString().split('T')[0],
                repeat: { ...newEvent.repeat, id: repeatId },
              });
              break;
            }
          }

          // 다음 날짜 계산
          switch (newEvent.repeat.type) {
            case 'daily':
              currentDate.setDate(currentDate.getDate() + newEvent.repeat.interval);
              break;
            case 'weekly':
              currentDate.setDate(currentDate.getDate() + 7 * newEvent.repeat.interval);
              break;
            case 'monthly':
              currentDate.setMonth(currentDate.getMonth() + newEvent.repeat.interval);
              break;
            case 'yearly':
              currentDate.setFullYear(currentDate.getFullYear() + newEvent.repeat.interval);
              break;
          }
        }

        mockEvents.push(...recurringEvents);

        // 첫 번째 이벤트를 응답으로 반환
        return HttpResponse.json(recurringEvents[0], { status: 201 });
      } else {
        // 단일 일정 처리
        newEvent.id = String(mockEvents.length + 1); // 간단한 ID 생성
        mockEvents.push(newEvent);
        return HttpResponse.json(newEvent, { status: 201 });
      }
    }),
    http.put('/api/events/:id', async ({ params, request }) => {
      const { id } = params;
      const updatedEvent = (await request.json()) as Event;
      const index = mockEvents.findIndex((event) => event.id === id);

      if (index !== -1) {
        // 단일 일정으로 변경
        const modifiedEvent: Event = {
          ...mockEvents[index],
          ...updatedEvent,
          repeat: {
            type: 'none',
            interval: 1,
            endDate: undefined,
            weekdays: undefined,
          },
        };
        mockEvents[index] = { ...modifiedEvent };

        return HttpResponse.json(modifiedEvent);
      }

      return HttpResponse.json(null, { status: 404 });
    }),
    http.delete('/api/events/:id', async ({ params, request }) => {
      const { id } = params;
      const url = new URL(request.url);
      const deleteType = url.searchParams.get('deleteType') || 'single';
      const event = mockEvents.find((e) => e.id === id);

      if (!event) {
        return new HttpResponse(null, { status: 404 });
      }

      const repeatId = event.repeat?.id;

      if (repeatId && deleteType !== 'single') {
        if (deleteType === 'future') {
          const eventDate = new Date(event.date);
          const keepIndex = mockEvents.findIndex(
            (e) => !(e.repeat?.id === repeatId && new Date(e.date) >= eventDate)
          );
          mockEvents.splice(keepIndex + 1);
        } else if (deleteType === 'all') {
          const removeIndexes = mockEvents
            .map((e, i) => (e.repeat?.id === repeatId ? i : -1))
            .filter((i) => i !== -1)
            .reverse();

          removeIndexes.forEach((index) => {
            mockEvents.splice(index, 1);
          });
        }
      } else {
        // 단일 일정 삭제
        const index = mockEvents.findIndex((e) => e.id === id);
        if (index !== -1) {
          mockEvents.splice(index, 1);
        }
      }

      return new HttpResponse(null, { status: 204 });
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
