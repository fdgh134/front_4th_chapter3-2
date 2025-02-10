import { randomUUID } from 'crypto';
import fs from 'fs';
import { readFile } from 'fs/promises';
import path from 'path';

import express from 'express';

const app = express();
const port = 3000;
const __dirname = path.resolve();

app.use(express.json());

// 특정 날짜의 요일 확인하는 함수
const getDayofWeek = (date) => {
  return new Date(date).getDay();
};

// 날짜가 선택된 요일에 해당하는지 확인하는 함수
const isSelectedDay = (date, weekdays) => {
  const dayOfWeek = getDayofWeek(date);
  return weekdays.includes(dayOfWeek)
};

// 특정한 날짜를 처리하는 함수
const adjustDate = (date, repeatType) => {
  const d = new Date(date);
  const dat = d.getDate();
  const month = d.getMonth();
  const year = d.getFullYear();

  // 월말 날짜(28일 이후) 처리
  if (day > 28) {
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    if (dat > lastDayOfMonth) {
      d.setDate(lastDayOfMonth);
    }
  }
  return d;
};

// 반복 일정 endDate 기본값
const getDefaultEndDate = (startDate) => {
  const defaultEnd = new Date(startDate);
  defaultEnd.setMonth(defaultEnd.getMonth() + 1); // 기본값 1개월 후로 설정
  return defaultEnd;
};

// JSON 파일에서 이벤트 데이터 읽어오는 함수
const getEvents = async () => {
  const data = await readFile(`${__dirname}/src/__mocks__/response/realEvents.json`, 'utf8');

  return JSON.parse(data);
};

// 이벤트 데이터 저장하는 함수
const saveEvents = (events) => {
  fs.writeFileSync(
    `${__dirname}/src/__mocks__/response/realEvents.json`,
    JSON.stringify(events, null, 2)
  );
};

// 모든 이벤트 조회 API
app.get('/api/events', async (_, res) => {
  const events = await getEvents();
  res.json(events);
});

// 새로운 이벤트 생성 API
app.post('/api/events', async (req, res) => {
  const events = await getEvents();
  const newEvent = { id: randomUUID(), ...req.body };
  
  // 반복 일정인 경우
  if (newEvent.repeat.type !== 'none') {
    const repeatId = randomUUID(); // 반복 일정 그룹화를 위한 ID
    const startDate = new Date(newEvent.date);
    const endDate = newEvent.repeat.endDate ? new Date(newEvent.repeat.endDate) : getDefaultEndDate(startDate);
    const recurringEvents = [];
    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      // 주간 반복인 경우 요일 체크
      if (newEvent.repeat.type === 'weekly' && newEvent.repeat.weekdays?.length > 0) {
        if (newEvent.repeat.weekdays.includes(currentDate.getDay())) {
          recurringEvents.push({
            ...newEvent,
            id: randomUUID(),
            date: currentDate.toISOString().split('T')[0],
            repeat: {
              ...newEvent.repeat,
              id: repeatId // 반복 일정 그룹 ID
            }
          });
        }
      } else {
        recurringEvents.push({
          ...newEvent,
          id: randomUUID(),
          date: currentDate.toISOString().split('T')[0],
          repeat: {
            ...newEvent.repeat,
            id: repeatId // 반복 일정 그룹 ID
          }
        });
      }

      // 다음 날짜 계산
      switch (newEvent.repeat.type) {
        case 'daily':
          currentDate.setDate(currentDate.getDate() + newEvent.repeat.interval);
          break;
        case 'weekly':
          currentDate.setDate(currentDate.getDate() + (7 * newEvent.repeat.interval));
          break;
        case 'monthly':
          currentDate.setMonth(currentDate.getMonth() + newEvent.repeat.interval);
          currentDate = adjustDate(currentDate, 'monthly');
          break;
        case 'yearly':
          currentDate.setFullYear(currentDate.getFullYear() + newEvent.repeat.interval);
          currentDate = adjustDate(currentDate, 'yearly');
          break;
      }
    }

    const updatedEvents = {
      events: [...events.events, ...recurringEvents]
    };
    saveEvents(updatedEvents);
    res.status(201).json(recurringEvents);
  } else {
    // 단일 일정인 경우
    const updatedEvents = {
      events: [...events.events, newEvent]
    };
    saveEvents(updatedEvents);
    res.status(201).json(newEvent);
  }
});

// 이벤트 수정 API
app.put('/api/events/:id', async (req, res) => {
  const events = await getEvents();
  const id = req.params.id;
  const event = events.events.find(e => e.id === id);
  
  if (!event) {
    return res.status(404).send('Event not found');
  }

  const { updateType = 'single' } = req.query;
  const repeatId = event.repeat?.id;
  let updatedEvents = [...events.events];

  if (repeatId && updateType !== 'single') {
    // 반복 일정 수정
    if (updateType === 'future') {
      // 현재 일정 이후의 모든 일정 수정
      const eventDate = new Date(event.date);
      updatedEvents = updatedEvents.map(e => {
        if (e.repeat?.id === repeatId && new Date(e.date) >= eventDate) {
          return { ...e, ...req.body };
        }
        return e;
      });
    } else if (updateType === 'all') {
      // 모든 반복 일정 수정
      updatedEvents = updatedEvents.map(e => {
        if (e.repeat?.id === repeatId) {
          return { ...e, ...req.body };
        }
        return e;
      });
    }
  } else {
    // 단일 일정 수정
    const eventIndex = updatedEvents.findIndex(e => e.id === id);
    updatedEvents[eventIndex] = { 
      ...updatedEvents[eventIndex], 
      ...req.body,
      repeat: { type: 'none', interval: 1 } // 반복 설정 제거
    };
  }

  const updatedEventData = {
    events: updatedEvents
  };
  saveEvents(updatedEventData);
  res.json(updatedEvents.find(e => e.id === id));
});

// 이벤트 삭제 API
app.delete('/api/events/:id', async (req, res) => {
  const events = await getEvents();
  const id = req.params.id;
  const event = events.events.find(e => e.id === id);

  if (!event) {
    return res.status(404).send('Event not found');
  }

  const { deleteType = 'single' } = req.query;
  const repeatId = event.repeat?.id;
  let updatedEvents = [...events.events];

  if (repeatId && deleteType !== 'single') {
    if (deleteType === 'future') {
      // 현재 일정 이후의 모든 일정 삭제
      const eventDate = new Date(event.date);
      updatedEvents = updatedEvents.filter(e => 
        !(e.repeat?.id === repeatId && new Date(e.date) >= eventDate)
      );
    } else if (deleteType === 'all') {
      // 모든 반복 일정 삭제
      updatedEvents = updatedEvents.filter(e => e.repeat?.id !== repeatId);
    }
  } else {
    // 단일 일정 삭제
    updatedEvents = updatedEvents.filter(e => e.id !== id);
  }

  const updatedEventData = {
    events: updatedEvents
  };
  saveEvents(updatedEventData);
  res.status(204).send();
});

// 여러 이벤트 일괄 수정 API
app.put('/api/events-list', async (req, res) => {
  const events = await getEvents();
  let isUpdated = false;

  const newEvents = [...events.events];
  req.body.events.forEach((event) => {
    const eventIndex = events.events.findIndex((target) => target.id === event.id);
    if (eventIndex > -1) {
      isUpdated = true;
      newEvents[eventIndex] = { ...events.events[eventIndex], ...event };
    }
  });

  if (isUpdated) {
    const updatedEvents = {
      events: newEvents
    };
    saveEvents(updatedEvents);
    res.json(newEvents);
  } else {
    res.status(404).send('Event not found');
  }
});

// 여러 이벤트 일괄 삭제 API
app.delete('/api/events-list', async (req, res) => {
  const events = await getEvents();
  const newEvents = events.events.filter((event) => !req.body.eventIds.includes(event.id));

  const updatedEvents = {
    events: newEvents
  };
  saveEvents(updatedEvents);
  res.status(204).send();
});

// 서버 시작
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

/* 기존 server.js 내용 */

// import { randomUUID } from 'crypto';
// import fs from 'fs';
// import { readFile } from 'fs/promises';
// import path from 'path';

// import express from 'express';

// const app = express();
// const port = 3000;
// const __dirname = path.resolve();

// app.use(express.json());

// const getEvents = async () => {
//   const data = await readFile(`${__dirname}/src/__mocks__/response/realEvents.json`, 'utf8');

//   return JSON.parse(data);
// };

// app.get('/api/events', async (_, res) => {
//   const events = await getEvents();
//   res.json(events);
// });

// app.post('/api/events', async (req, res) => {
//   const events = await getEvents();
//   const newEvent = { id: randomUUID(), ...req.body };

//   fs.writeFileSync(
//     `${__dirname}/src/__mocks__/response/realEvents.json`,
//     JSON.stringify({
//       events: [...events.events, newEvent],
//     })
//   );

//   res.status(201).json(newEvent);
// });

// app.put('/api/events/:id', async (req, res) => {
//   const events = await getEvents();
//   const { id } = req.params;
//   const eventIndex = events.events.findIndex((event) => event.id === id);
//   if (eventIndex > -1) {
//     const newEvents = [...events.events];
//     newEvents[eventIndex] = { ...events.events[eventIndex], ...req.body };

//     fs.writeFileSync(
//       `${__dirname}/src/__mocks__/response/realEvents.json`,
//       JSON.stringify({
//         events: newEvents,
//       })
//     );

//     res.json(events.events[eventIndex]);
//   } else {
//     res.status(404).send('Event not found');
//   }
// });

// app.delete('/api/events/:id', async (req, res) => {
//   const events = await getEvents();
//   const { id } = req.params;

//   fs.writeFileSync(
//     `${__dirname}/src/__mocks__/response/realEvents.json`,
//     JSON.stringify({
//       events: events.events.filter((event) => event.id !== id),
//     })
//   );

//   res.status(204).send();
// });

// app.listen(port, () => {
//   console.log(`Server running at http://localhost:${port}`);
// });